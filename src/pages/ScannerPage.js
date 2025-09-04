import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function ScannerPage() {
    const videoRef = useRef(null);
    const [scanner, setScanner] = useState(null);
    const [message, setMessage] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [offlineCount, setOfflineCount] = useState(0);
    const [role, setRole] = useState(null);
    const [notifications, setNotifications] = useState([]);

    // Utility to add a notification
    const addNotification = (text, type = "info") => {
        const id = Date.now();
        setNotifications((prev) => [...prev, { id, text, type }]);

        // Auto-remove after 4s
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 4000);
    };


    // Modal state + student form fields
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [studentForm, setStudentForm] = useState({
        studentId: "",
        firstName: "",
        lastName: "",
        section: "",
        year: "",
    });

    const eventId = "2025-09-05_test"; // TODO: make dynamic later
    const navigate = useNavigate();

    /** Auth guard */
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                const token = await user.getIdTokenResult();
                setRole(token.claims.role || null);
            } else {
                navigate("/login");
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    /** Utility: Current slot resolver */
    const getCurrentSlot = () => {
        const hour = new Date().getHours();
        if (hour < 9) return "07AM";
        if (hour < 13) return "12PM";
        if (hour < 15) return "01PM";
        return "05PM";
    };

    /** QR scanner setup */
    useEffect(() => {
        if (videoRef.current) {
            const qrScanner = new QrScanner(videoRef.current, handleScan, {
                highlightScanRegion: true,
            });
            qrScanner.start();
            setScanner(qrScanner);
            setIsScanning(true);
            return () => qrScanner.stop();
        }
    }, []);

    /** Load offline queue count */
    useEffect(() => {
        const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
        setOfflineCount(queue.length);
    }, []);

    /** Attendance processor */
    const processAttendance = async (studentData) => {
        const { studentId, firstName, lastName, section, year } = studentData;
        const slot = getCurrentSlot();

        try {
            const attendanceRef = doc(db, "events", eventId, "attendance", studentId);
            const attendanceSnap = await getDoc(attendanceRef);

            if (attendanceSnap.exists() && attendanceSnap.data()[slot]) {
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

            addNotification(`✅ Marked ${firstName} ${lastName} (${studentId}) present for ${slot}`, 'success');
        } catch (error) {
            console.error("Error updating attendance:", error);
            addNotification("❌ Failed to update attendance. Saving offline…", 'error');

            const offlineQueue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
            offlineQueue.push({ eventId, slot, ...studentData, timestamp: Date.now() });
            localStorage.setItem("offlineQueue", JSON.stringify(offlineQueue));
            setOfflineCount(offlineQueue.length);
        }
    };

    /** QR Scan callback */
    const handleScan = async (result) => {
        if (isProcessing) return;
        setIsProcessing(true);
        setTimeout(() => setIsProcessing(false), 2000);

        if (!result?.data) return;

        const rawText = result.data.trim();
        const parts = rawText.split(",");

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

    /** Handle modal form submit */
    const handleManualAdd = async () => {
        if (!studentForm.studentId.trim()) {
            addNotification("⚠️ Student ID is required.", 'warning');
            return;
        }

        await processAttendance(studentForm);

        // Reset form + close modal
        setStudentForm({ studentId: "", firstName: "", lastName: "", section: "", year: "" });
        setIsModalOpen(false);
    };

    return (
        <div className="flex flex-col items-center p-6 bg-gray-100 min-h-screen">
            {/* Notification container */}
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
                <video ref={videoRef} className="w-full rounded-md border" />
            </div>
            {/* Offline Queue Info */}
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
                                addNotification(`Synced ${synced} offline records.`, 'success);');
                            }
                        }}
                        disabled={offlineCount === 0}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                    >
                        Sync Now
                    </button>
                </div>
            </div>

            <p className="text-sm text-gray-700 mb-4">{message}</p>

            <div className="flex gap-3 mb-4">
                <button
                    onClick={() => { scanner?.start(); setIsScanning(true); }}
                    disabled={isScanning}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                >
                    ▶ Start
                </button>
                <button
                    onClick={() => { scanner?.stop(); setIsScanning(false); }}
                    disabled={!isScanning}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg disabled:opacity-50"
                >
                    ⏸ Stop
                </button>
            </div>

            {/* Manual Add Modal Trigger */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg mb-4"
            >
                + Add Student Manually
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
                        <h3 className="text-xl font-semibold mb-4">Add Student Manually</h3>

                        <div className="flex flex-col gap-3">
                            <input
                                type="text"
                                placeholder="Student ID"
                                value={studentForm.studentId}
                                onChange={(e) => setStudentForm({ ...studentForm, studentId: e.target.value })}
                                className="border rounded px-3 py-2"
                            />
                            <input
                                type="text"
                                placeholder="Last Name"
                                value={studentForm.lastName}
                                onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                                className="border rounded px-3 py-2"
                            />
                            <input
                                type="text"
                                placeholder="First Name"
                                value={studentForm.firstName}
                                onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                                className="border rounded px-3 py-2"
                            />
                            <input
                                type="text"
                                placeholder="Section"
                                value={studentForm.section}
                                onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                                className="border rounded px-3 py-2"
                            />
                            <input
                                type="text"
                                placeholder="Year"
                                value={studentForm.year}
                                onChange={(e) => setStudentForm({ ...studentForm, year: e.target.value })}
                                className="border rounded px-3 py-2"
                            />
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 bg-gray-300 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleManualAdd}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* {role === "admin" && (
                <button
                    onClick={() => navigate("/admin-dashboard")}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg"
                >
                    Back to Dashboard
                </button>
            )} */}
        </div>
    );
}

export default ScannerPage;
