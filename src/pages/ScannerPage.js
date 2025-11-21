import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate, useParams } from "react-router-dom";
import { DateTime } from "luxon";
import { 
  WifiIcon, 
  SignalSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import BackButton from "../components/BackButton";

function ScannerPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  
  // State Management
  const [eventDate, setEventDate] = useState(null);
  const [eventName, setEventName] = useState("Loading Event...");
  const [scannerState, setScannerState] = useState("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [role, setRole] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [config, setConfig] = useState({ forceSlot: null, allowOverride: false });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastScannedStudent, setLastScannedStudent] = useState(null);
  
  const lastStudentScanRef = useRef({ id: "", time: 0 });
  const configRef = useRef(config);

  // --- Event config listener ---
  useEffect(() => {
    const eventRef = doc(db, "events", eventId);
    const unsub = onSnapshot(eventRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.config) {
          setConfig(data.config);
        }
        if (data.date) {
          setEventDate(data.date);
        }
        if (data.name) {
          setEventName(data.name);
        }
      }
    });
    return () => unsub();
  }, [eventId]);

  // --- Online status listener ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (config) configRef.current = config;
  }, [config]);

  // --- Add notification with max 3 toasts ---
  const addNotification = (text, type = "info") => {
    setNotifications((prev) => {
      // Check for duplicate
      const exists = prev.some((n) => n.text === text && n.type === type);
      if (exists) return prev;

      const id = Date.now() + Math.random(); // Ensure unique ID
      const newNotif = { id, text, type };

      // Limit to 3 notifications max
      let updatedNotifs = [...prev, newNotif];
      if (updatedNotifs.length > 3) {
        updatedNotifs = updatedNotifs.slice(-3); // Keep only last 3
      }

      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        setNotifications((current) => current.filter((n) => n.id !== id));
      }, 4000);

      return updatedNotifs;
    });
  };

  // --- Auth guard ---
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
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
  }, [navigate, eventDate]);

  // --- Current slot resolver ---
  const getCurrentSlot = () => {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();

    if (totalMinutes >= 6 * 60 && totalMinutes < 8 * 60) return "07AM";
    if (totalMinutes >= 11.5 * 60 && totalMinutes < 12.5 * 60) return "12PM";
    if (totalMinutes >= 13 * 60 && totalMinutes < 14 * 60) return "01PM";
    if (totalMinutes >= 16.5 * 60 && totalMinutes < 18 * 60) return "05PM";
    return null;
  };

  // --- QR scanner setup ---
  useEffect(() => {
    if (!videoRef.current) return;

    const qrScanner = new QrScanner(
      videoRef.current,
      (result) => handleScan(result),
      { highlightScanRegion: true, preferredCamera: "environment" }
    );

    qrScanner.start().catch(async (err) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
      } catch (fallbackErr) {
        setScannerState("error");
        addNotification("Unable to access camera.", "error");
      }
    });

    return () => {
      qrScanner.stop();
    };
  }, []);

  // --- Offline queue helpers ---
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

  // --- Attendance processor ---
  const processAttendance = async (studentData) => {
    const { studentId, firstName, lastName, section, year, slot, allowOverride, forceSlot } = studentData;
    const currentConfig = configRef.current;
    let finalSlot = slot || getCurrentSlot();
    const now = Date.now();

    if (forceSlot || currentConfig.forceSlot) {
      finalSlot = forceSlot || currentConfig.forceSlot;
    }

    if (!allowOverride && !currentConfig.allowOverride && !finalSlot) {
      setScannerState("error");
      addNotification("Scanning not allowed right now.", "warning");
      return false;
    }

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
        addNotification(`${firstName} ${lastName} (${studentId}) already marked for ${finalSlot}.`, 'warning');
        setLastScannedStudent({ firstName, lastName, studentId });
        return true;
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

      addNotification(`Marked ${firstName} ${lastName} (${studentId}) present for ${finalSlot}`, 'success');
      setLastScannedStudent({ firstName, lastName, studentId });
      if ("vibrate" in navigator) navigator.vibrate(200);
      return true;
    } catch (error) {
      console.error("Error updating attendance:", error);
      addNotification("Failed to update attendance. Saving offline…", "error");

      const record = { eventId, slot: finalSlot, allowOverride, forceSlot, ...studentData };
      enqueueOfflineRecord(record);

      return false;
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
      addNotification("Invalid QR format.", "error");
      return;
    }

    const currentConfig = configRef.current;
    await processAttendance(
      { studentId, firstName, lastName, year, section: "" },
      currentConfig
    );
  };

  // --- Sync Queue Handler ---
  const handleSyncQueue = async () => {
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
  };

  // Get icon component based on notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />;
      case "error":
        return <XCircleIcon className="h-5 w-5 flex-shrink-0" />;
      case "warning":
        return <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />;
      case "info":
      default:
        return <InformationCircleIcon className="h-5 w-5 flex-shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Custom Header - Light Theme with Shadow */}
      <header className="bg-white shadow-md z-50 sticky top-0">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Back Button */}
          <BackButton />

          {/* Event Name - Centered */}
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-lg font-bold text-gray-800 truncate max-w-[200px]">
            {eventName}
          </h1>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-1">
            {isOnline ? (
              <div className="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-full">
                <WifiIcon className="h-5 w-5 text-green-600" />
                <span className="text-xs font-medium text-green-700 hidden sm:inline">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-full">
                <SignalSlashIcon className="h-5 w-5 text-red-600" />
                <span className="text-xs font-medium text-red-700 hidden sm:inline">Offline</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area (Scanner and Last Scanned) - Added bottom padding */}
      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 overflow-y-auto gap-6 pb-28">
        {/* Scanner View */}
        <div className="w-full max-w-md aspect-square relative overflow-hidden rounded-2xl shadow-2xl bg-black">
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover" 
            autoPlay 
            playsInline 
          />
          
          {/* Overlay Frame/Corners */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Center Scanning Line */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse"></div>
          </div>

          {/* Scanning Indicator */}
          {isProcessing && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
              <div className="bg-white bg-opacity-95 px-6 py-3 rounded-full shadow-lg">
                <p className="text-blue-900 font-semibold">Processing...</p>
              </div>
            </div>
          )}
        </div>

        {/* Last Scanned / Success Banner */}
        {lastScannedStudent && (
          <div className="w-full max-w-md p-4 bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500 rounded-xl shadow-md animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Last Scanned</p>
                <p className="text-lg font-bold text-gray-800 mt-1">
                  {lastScannedStudent.firstName} {lastScannedStudent.lastName}
                </p>
                <p className="text-sm text-gray-600">{lastScannedStudent.studentId}</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-green-500 rounded-full">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="w-full max-w-md px-4 text-center">
          <p className="text-sm text-gray-500">Position the QR code within the frame to scan</p>
        </div>
      </div>

      {/* Bottom Control Bar - Fixed to bottom with safe area padding */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-4 pb-safe" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            onClick={() => addNotification("Manual Entry functionality not yet implemented.", "info")}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-md"
          >
            Manual Entry
          </button>
          <button
            onClick={handleSyncQueue}
            disabled={offlineCount === 0}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 active:scale-95 transition-all shadow-md relative"
          >
            Sync Queue
            {offlineCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                {offlineCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications - Toast Style with Icons (Max 3) */}
      <div className="fixed top-20 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`px-4 py-3 rounded-xl shadow-lg font-medium animate-slide-in pointer-events-auto border flex items-center gap-3
              ${n.type === "success" ? "bg-green-50 text-green-800 border-green-200" : ""}
              ${n.type === "error" ? "bg-red-50 text-red-800 border-red-200" : ""}
              ${n.type === "info" ? "bg-blue-50 text-blue-800 border-blue-200" : ""}
              ${n.type === "warning" ? "bg-yellow-50 text-yellow-800 border-yellow-200" : ""}`}
          >
            {getNotificationIcon(n.type)}
            <span className="flex-1">{n.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScannerPage;