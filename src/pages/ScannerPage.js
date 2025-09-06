import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate, useParams } from "react-router-dom";



function ScannerPage() {
    const { eventId } = useParams();
    const eventDate = eventId ? eventId.split("_")[0] : null;
    const videoRef = useRef(null);
    const [scannerState, setScannerState] = useState("idle"); // idle, scanning, error
    // const [message, setMessage] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [offlineCount, setOfflineCount] = useState(0);
    const [role, setRole] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [config, setConfig] = useState({ allowOverride: false, forceSlot: null });
    // const eventId = "2025-09-05_testing"; // TODO: make dynamic later
    const navigate = useNavigate();

    // get the event's config
    useEffect(() => {
        const configRef = doc(db, "events", eventId, "config", "scanning");
        const unsub = onSnapshot(configRef, (snap) => {
            if (snap.exists()) {
                setConfig(snap.data());
            }
        });
        return () => unsub();
    }, [eventId]);

    // utility to add a notification
    const addNotification = (text, type = "info") => {
        setNotifications((prev) => {
            // prevent duplicate text of same type
            const exists = prev.some((n) => n.text === text && n.type === type);
            if (exists) return prev;

            const id = Date.now();
            const newNotif = [...prev, { id, text, type }];

            // auto remove after 4s
            setTimeout(() => {
                setNotifications((current) =>
                    current.filter((n) => n.id !== id)
                );
            }, 4000);

            return newNotif;
        });
    };

    /** Auth guard */
    // get user role
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                if (new Date().toISOString().split("T")[0] !== eventDate) {
                    console.log(eventDate, new Date().toISOString().split("T")[0]);
                    navigate("/unauthorized");
                }
                const token = await user.getIdTokenResult();
                setRole(token.claims.role || null);
            }
            else {
                navigate("/login");
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    // utility: current slot resolver 
    const getCurrentSlot = () => {
        const now = new Date();
        console.log("Current time:", now.toTimeString());
        const hour = now.getHours();
        const minute = now.getMinutes();
        const totalMinutes = hour * 60 + minute;

        if (totalMinutes >= 6 * 60 && totalMinutes < 8 * 60) return "07AM"; // 7AM slot is 6:00 - 8:00
        if (totalMinutes >= 12 * 60 && totalMinutes < 13 * 60) return "12PM"; // 12PM slot is 12:00 - 13:00
        if (totalMinutes >= 13 * 60 && totalMinutes < 14 * 60) return "01PM"; // 1PM slot is 13:00 - 14:00
        if (totalMinutes >= 17 * 60 && totalMinutes < 18 * 60) return "05PM"; // 5PM slot is 17:00 - 18:00

        return null; // outside slots
    };


    // QR scanner setup 
    useEffect(() => {
        if (!videoRef.current) return;

        const qrScanner = new QrScanner(
            videoRef.current,
            (result) => {
                handleScan(result);
            },
            {
                highlightScanRegion: true,
                preferredCamera: "environment", // rear first
            }
        );

        qrScanner.start().catch(async (err) => {
            console.warn("Rear camera not available, falling back:", err);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoRef.current.srcObject = stream;
            } catch (fallbackErr) {
                setScannerState("error");
                addNotification("❌ Unable to access camera. Please allow access in your browser.", "error");
                console.error("No camera available at all:", fallbackErr);
                // handleError(fallbackErr);
            }
        });

        return () => {
            qrScanner.stop();
        };
    }, []);


    // load offline queue count on mount
    useEffect(() => {
        const queue = getOfflineQueue();
        const deduped = dedupeQueue(queue); // clean duplicates just in case 
        if (deduped.length !== queue.length) {
            saveOfflineQueue(deduped);
        } else {
            setOfflineCount(deduped.length);
        }
    }, []);


    // --- Offline-queue helpers ---
    const getOfflineQueue = () =>
        JSON.parse(localStorage.getItem("offlineQueue") || "[]");

    // save the queue to localStorage
    const saveOfflineQueue = (queue) => {
        localStorage.setItem("offlineQueue", JSON.stringify(queue));
        setOfflineCount(queue.length);
    };

    // dedupe by eventId|studentId|slot keeping the first occurrence
    const dedupeQueue = (queue) => {
        const map = new Map(); // key -> record
        for (const item of queue) {
            const key = `${item.eventId}|${item.studentId}|${item.slot}`; // unique key
            if (!map.has(key)) map.set(key, item); // keep first occurrence
        }
        return Array.from(map.values()); //
    };

    // returns true if added, false if already exists
    // to prevent duplicates in the queue
    const enqueueOfflineRecord = (record) => {
        const queue = getOfflineQueue();
        const key = `${record.eventId}|${record.studentId}|${record.slot}`;
        const exists = queue.some(
            (q) => `${q.eventId}|${q.studentId}|${q.slot}` === key
        );
        if (exists) return false;

        queue.push(record);
        const deduped = dedupeQueue(queue);
        saveOfflineQueue(deduped);
        return true;
    };


    // attendance processor
    const processAttendance = async (studentData) => {
        const { studentId, firstName, lastName, section, year } = studentData;
        let slot = getCurrentSlot();

        // block if outside window and no override
        if (!slot && !config.allowOverride) {
            setScannerState("error");
            addNotification("⚠️ Scanning not allowed right now.", "warning");
            return;
        }

        // if admin forced a slot -> use it
        if (config.forceSlot) {
            slot = config.forceSlot;
        }

        if (!slot) {
            setScannerState("error");
            addNotification("⚠️ No active slot to record.", "warning");
            return;
        }

        try {
            const attendanceRef = doc(db, "events", eventId, "attendance", studentId); // doc ref for the student in this event 
            const attendanceSnap = await getDoc(attendanceRef);
            // prevent double-marking
            if (attendanceSnap.exists() && attendanceSnap.data()[slot]) {
                setScannerState("error");
                addNotification(`⚠️ ${firstName} ${lastName} (${studentId}) already marked for ${slot}.`, 'warning');
                return;
            }

            const baseStudentData = {
                studentId,
                firstName,
                lastName,
                section,
                year,
                "07AM": false,
                "12PM": false,
                "01PM": false,
                "05PM": false,
            };

            await setDoc(
                attendanceRef,
                {
                    ...(!attendanceSnap.exists() ? baseStudentData : {}),
                    [slot]: true,
                },
                { merge: true }
            );
            setScannerState("scanning");
            addNotification(`✅ Marked ${firstName} ${lastName} (${studentId}) present for ${slot}`, 'success');
        } catch (error) {
            console.error("Error updating attendance:", error);
            addNotification("❌ Failed to update attendance. Saving offline…", "error");

            const record = { eventId, slot, ...studentData, timestamp: Date.now() }; // add timestamp for reference
            const wasQueued = enqueueOfflineRecord(record);

            if (!wasQueued) {
                // optional: notify that it's already in the queue 
                addNotification(`⚠️ ${studentId} already queued for ${slot}.`, "warning");
            }
        }

    };

    // QR scan handler
    const handleScan = async (result) => {
        // prevent overlapping processing
        if (isProcessing) return;
        setIsProcessing(true);
        setTimeout(() => setIsProcessing(false), 2000);
        if (!result?.data) return;

        const rawText = result.data.trim();
        const parts = rawText.split(",");

        // expect format: "LASTNAME,FIRSTNAME,ID,YEAR"
        const lastName = parts[0]?.trim() || "";
        const firstName = parts[1]?.trim() || "";
        const studentId = parts[2] ? parts[2].trim().replace(/\s+/g, "") : null;
        const year = parts[3]?.trim() || "";

        if (!studentId) {
            addNotification("⚠️ Could not extract student ID from QR code.", 'error');
            return;
        }

        await processAttendance({ studentId, firstName, lastName, year, section: "" });
    };

    return (
        <div className="flex flex-col items-center p-6 bg-gray-100 min-h-screen">
            {/* notification container */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        className={`px-4 py-2 rounded shadow-md text-white animate-fade-in-out
        ${n.type === "success" ? "bg-green-600" : ""}
        ${n.type === "error" ? "bg-red-600" : ""}
        ${n.type === "info" ? "bg-blue-600" : ""}
        ${n.type === "warning" ? "bg-yellow-500" : ""}`}
                    >
                        {n.text}
                    </div>
                ))}
            </div>

            <h2 className="text-2xl font-bold mb-4">QR Scanner</h2>

            <div className="w-full max-w-md bg-white shadow-md rounded-lg p-4 mb-4">
                <div className="w-full aspect-square overflow-hidden rounded-md border relative">
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                    />
                    {/* Scanner overlay */}
                    <div className={`absolute inset-0 border-2 rounded-md pointer-events-none
                        ${scannerState === "scanning" ? "border-green-500" :
                            scannerState === "error" ? "border-red-500" : "border-gray-500"} `} />
                </div>
            </div>

            {/* offline queue info */}
            <div className="w-full max-w-md bg-white shadow-md rounded-lg p-4 mb-6">
                <p className="mb-2">
                    Offline Queue: <strong>{offlineCount}</strong>
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
                            alert(
                                queue.length
                                    ? queue.map((q) => `${q.studentId} (${q.slot})`).join("\n")
                                    : "No pending offline records."
                            );
                        }}
                        disabled={offlineCount === 0}
                        className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg disabled:opacity-50"
                    >
                        View Queue
                    </button>
                    <button
                        onClick={async () => {
                            const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
                            let synced = 0;
                            for (const item of queue) {
                                try {
                                    await processAttendance(item);
                                    synced++;
                                } catch { }
                            }
                            if (synced > 0) {
                                localStorage.setItem("offlineQueue", JSON.stringify([]));
                                setOfflineCount(0);
                                addNotification(`Synced ${synced} offline records.`, 'success');
                            }
                        }}
                        disabled={offlineCount === 0}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                    >
                        Sync Now
                    </button>
                </div>
            </div>

            {/* <p className="text-sm text-gray-700 mb-4">{message}</p> */}
            {/*}
            <div className="flex gap-3 mb-4">
                <button
                    onClick={async () => {
                        try {
                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                            videoRef.current.srcObject = stream;
                            await scanner?.start();
                            setIsScanning(true);
                            // addNotification("📷 Camera started successfully", "success");
                        } catch (err) {
                            console.error("Camera access error:", err);
                            addNotification("⚠️ Unable to access camera. Please allow access in your browser.", "error");
                        }
                    }}
                    disabled={isScanning}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                >
                    ▶ Start
                </button>



                <button
                    onClick={() => {
                        try {
                            scanner?.stop();
                            setIsScanning(false);
                            addNotification("⏸ Camera stopped", "info");
                        } catch (err) {
                            console.warn("Error stopping camera:", err);
                        }
                    }}
                    disabled={!isScanning}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg disabled:opacity-50"
                >
                    ⏸ Stop
                </button>
            </div>
            */}
        </div>
    );
}

export default ScannerPage;
