import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate, useParams } from "react-router-dom";
import { DateTime } from "luxon";

function ScannerPage() {
    const { eventId } = useParams();
    //   const eventDate = eventId ? eventId.split("_")[0] : null; // change this and fetch the date from event data:
    // updated eventDate fetch to useSnapshot
    const [eventDate, setEventDate] = useState(null);
    useEffect(() => {
        if (!eventId) return;
        const eventRef = doc(db, "events", eventId);
        const unsub = onSnapshot(eventRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.date) {
                    setEventDate(data.date);
                }
            }
        });
        return () => unsub();
    }, [eventId]);
    const videoRef = useRef(null);
    const [scannerState, setScannerState] = useState("idle");
    const [isProcessing, setIsProcessing] = useState(false);
    const lastStudentScanRef = useRef({ id: "", time: 0 });
    const [offlineCount, setOfflineCount] = useState(0);
    const [role, setRole] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [config, setConfig] = useState({ forceSlot: null, allowOverride: false });
    const configRef = useRef(config);
    const navigate = useNavigate();

    // --- event config listener ---
    useEffect(() => {
        const eventRef = doc(db, "events", eventId);
        const unsub = onSnapshot(eventRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.config) {
                    setConfig(data.config);
                }
            }
        });
        return () => unsub();
    }, [eventId]);

    useEffect(() => {
        if (config) configRef.current = config;
    }, [config]);

    // --- add notification ---
    const addNotification = (text, type = "info") => {
        setNotifications((prev) => {
            const exists = prev.some((n) => n.text === text && n.type === type);
            if (exists) return prev;

            const id = Date.now();
            const newNotif = [...prev, { id, text, type }];

            setTimeout(() => {
                setNotifications((current) => current.filter((n) => n.id !== id));
            }, 4000);

            return newNotif;
        });
    };

    // --- auth guard ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                // if (DateTime.now().setZone("Asia/Manila").toISODate() !== eventDate) // fix this to use eventDate from state
                //     {
                //     navigate("/unauthorized");
                // }
                if (eventDate) {
                    const today = DateTime.now().setZone("Asia/Manila").toISODate();
                    if (today !== eventDate) {
                        navigate("/unauthorized");
                    }
                }
                const token = await user.getIdTokenResult();
                setRole(token.claims.role || null);
            } else {
                navigate("/login");
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    // --- current slot resolver ---
    const getCurrentSlot = () => {
        const now = new Date();
        const totalMinutes = now.getHours() * 60 + now.getMinutes();

        if (totalMinutes >= 6 * 60 && totalMinutes < 8 * 60) return "07AM";
        if (totalMinutes >= 11.5 * 60 && totalMinutes < 12.5 * 60) return "12PM";
        if (totalMinutes >= 13 * 60 && totalMinutes < 14 * 60) return "01PM";
        if (totalMinutes >= 16.5 * 60 && totalMinutes < 18 * 60) return "05PM";
        return null;
    };

    // --- qr scanner setup ---
    useEffect(() => {
        if (!videoRef.current) return;

        const qrScanner = new QrScanner(
            videoRef.current,
            (result) => handleScan(result),
            { highlightScanRegion: true, preferredCamera: "environment" },
            "/qr-scanner-worker.min.js"
        );

        qrScanner.start().catch(async (err) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoRef.current.srcObject = stream;
            } catch (fallbackErr) {
                setScannerState("error");
                addNotification("❌ Unable to access camera.", "error");
            }
        });

        return () => {
            qrScanner.stop();
        };
    }, []);

    // --- offline queue helpers ---
    const getOfflineQueue = () =>
        JSON.parse(localStorage.getItem("offlineQueue") || "[]");

    const saveOfflineQueue = (queue) => {
        localStorage.setItem("offlineQueue", JSON.stringify(queue));
        setOfflineCount(queue.length);
    };

    const dedupeQueue = (queue) => {
        const map = new Map();
        for (const item of queue) {
            const key = `${item.eventId}|${item.studentId}|${item.slot}`;
            if (!map.has(key)) map.set(key, item);
        }
        return Array.from(map.values());
    };

    const enqueueOfflineRecord = (record) => {
        const queue = getOfflineQueue();
        const key = `${record.eventId}|${record.studentId}|${record.slot}`;
        if (queue.some((q) => `${q.eventId}|${q.studentId}|${q.slot}` === key)) {
            return false;
        }
        queue.push(record);
        saveOfflineQueue(dedupeQueue(queue));
        return true;
    };

    useEffect(() => {
        const queue = getOfflineQueue();
        saveOfflineQueue(dedupeQueue(queue));
    }, []);

    // --- attendance processor ---
    const processAttendance = async (studentData) => {
        const { studentId, firstName, lastName, section, year, slot, allowOverride, forceSlot } = studentData;
        const currentConfig = configRef.current;
        let finalSlot = slot || getCurrentSlot(); // slot may already be set if from offline queue
        const now = Date.now();

        // if admin forced a slot -> use it
        if (forceSlot || currentConfig.forceSlot) {
            finalSlot = forceSlot || currentConfig.forceSlot;
        }

        // block if outside window and no override
        if (!allowOverride && !currentConfig.allowOverride && !finalSlot) {
            setScannerState("error");
            addNotification("⚠️ Scanning not allowed right now.", "warning");
            return false;
        }

        // prevent duplicate spam scans (only for live, not offline sync)
        if (!slot && lastStudentScanRef.current.id === studentId &&
            now - lastStudentScanRef.current.time < 4000) {
            console.log("Ignoring duplicate scan for", studentId);
            return false;
        }
        lastStudentScanRef.current = { id: studentId, time: now };

        try {
            const attendanceRef = doc(db, "events", eventId, "attendance", studentId);
            const attendanceSnap = await getDoc(attendanceRef);

            if (attendanceSnap.exists() && attendanceSnap.data()[finalSlot]) {
                addNotification(`⚠️ ${firstName} ${lastName} (${studentId}) already marked for ${finalSlot}.`, 'warning');
                return true; // ✅ it's already recorded, treat as success so queue won’t keep retrying forever
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
                    [finalSlot]: true,
                },
                { merge: true }
            );

            addNotification(`✅ Marked ${firstName} ${lastName} (${studentId}) present for ${finalSlot}`, 'success');
            if ("vibrate" in navigator) navigator.vibrate(200);
            return true; // ✅ success
        } catch (error) {
            console.error("Error updating attendance:", error);
            addNotification("❌ Failed to update attendance. Saving offline…", "error");

            const record = { eventId, slot: finalSlot, allowOverride, forceSlot, ...studentData };
            enqueueOfflineRecord(record);

            return false; // ❌ failure
        }
    };

    // --- QR scan handler ---
    const handleScan = async (result) => {
        if (isProcessing) return;
        setIsProcessing(true);
        setTimeout(() => setIsProcessing(false), 4000);
        if (!result?.data) return;

        const parts = result.data.trim().split(",");
        const lastName = parts[0]?.trim() || "";
        const firstName = parts[1]?.trim() || "";
        const studentId = parts[2]?.trim().replace(/\s+/g, "") || null;
        const year = parts[3]?.trim() || "";

        if (!studentId) {
            addNotification("⚠️ Invalid QR format.", "error");
            return;
        }

        const currentConfig = configRef.current;
        await processAttendance(
            { studentId, firstName, lastName, year, section: "" },
            currentConfig
        );
    };

    return (
        <div className="flex flex-col items-center p-6 bg-gray-100 min-h-screen">
            {/* notifications */}
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

            {/* scanner view */}
            <div className="w-full max-w-md bg-white shadow-md rounded-lg p-4 mb-4">
                <div className="w-full aspect-square overflow-hidden rounded-md border relative">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                    <div
                        className={`absolute inset-0 border-2 rounded-md pointer-events-none
              ${scannerState === "scanning" ? "border-green-500" :
                                scannerState === "error" ? "border-red-500" : "border-gray-500"}`}
                    />
                </div>
            </div>

            {/* offline queue */}
            <div className="w-full max-w-md bg-white shadow-md rounded-lg p-4 mb-6">
                <p className="mb-2">
                    Offline Queue: <strong>{offlineCount}</strong>
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            const queue = getOfflineQueue();
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
                            let success = [];
                            let failed = [];

                            for (const item of queue) {
                                const ok = await processAttendance(item);
                                if (ok) success.push(item);
                                else failed.push(item);
                            }

                            if (success.length > 0) {
                                const newQueue = failed;
                                localStorage.setItem("offlineQueue", JSON.stringify(newQueue));
                                setOfflineCount(newQueue.length);
                                addNotification(`Synced ${success.length} records. ${failed.length} still pending.`, 'info');
                            }
                        }}
                        disabled={offlineCount === 0}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                    >
                        Sync Now
                    </button>
                </div>
                <button
                    disabled={!(role === "admin" || role === "semi-admin")}
                    className={`rounded px-4 py-2 font-medium transition mt-4 w-full
            ${role === "admin" || role === "semi-admin"
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-gray-400 text-gray-200 cursor-not-allowed hover:bg-gray-500"}`}
                    onClick={() => navigate(`/events/${eventId}/attendance`)}
                >
                    View Attendance
                </button>
            </div>
        </div>
    );
}

export default ScannerPage;
