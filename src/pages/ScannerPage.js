import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function ScannerPage() {
  const videoRef = useRef(null);
  const [scanner, setScanner] = useState(null);
  const [message, setMessage] = useState("");
  const eventId = "2025-09-05_test"; // hardcoded for now
  const navigate = useNavigate();

  // Slot resolver
  const getCurrentSlot = () => {
    const hour = new Date().getHours();
    if (hour < 9) return "07AM";
    if (hour < 13) return "12PM";
    if (hour < 15) return "01PM";
    return "05PM";
  };

  // Auth guard
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  // QR scanner setup
  useEffect(() => {
    if (videoRef.current) {
      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => handleScan(result),
        { highlightScanRegion: true }
      );
      qrScanner.start();
      setScanner(qrScanner);
      return () => qrScanner.stop();
    }
  }, []);

  // Handle QR Scan
  const handleScan = async (result) => {
    if (!result?.data) return;
    // sample data: Acebedo, Roxanne May, 22- 21483, 4th Year
    const rawText = result.data.trim();
    const parts = rawText.split(",");

    let lastName = parts[0]?.trim() || "";
    let firstName = parts[1]?.trim() || "";
    let studentId = parts[2] ? parts[2].trim().replace(/\s+/g, "") : null;
    let year = parts[3]?.trim() || "";
    // let section = parts[4]?.trim() || "";

    if (!studentId) {
      setMessage("Could not extract student ID from QR code.");
      return;
    }

    const slot = getCurrentSlot();

    try {
      const attendanceRef = doc(db, "events", eventId, "attendance", studentId);
      const attendanceSnap = await getDoc(attendanceRef);

      // baseline student record for this event
      const baseStudentData = {
        studentId,
        firstName,
        lastName,
        year,
        // section,
        "07AM": false,
        "12PM": false,
        "01PM": false,
        "05PM": false,
      };

      if (!attendanceSnap.exists()) {
        // New student for this event -> create full doc
        await setDoc(attendanceRef, {
          ...baseStudentData,
          [slot]: true, // mark as present
        });
      } else {
        // Already exists -> update the slot
        await setDoc(
          attendanceRef,
          { [slot]: true },
          { merge: true }
        );
      }

      setMessage(
        `Marked ${firstName} ${lastName} (${studentId}) present for ${slot}`
      );
    } catch (error) {
      console.error("Error updating attendance:", error);
      setMessage("Failed to update attendance.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>QR Scanner</h2>
      <video ref={videoRef} style={{ width: "40%" }}></video>
      <p>{message}</p>
      <button onClick={() => navigate("/admin")}>Back to Dashboard</button>
    </div>
  );
}

export default ScannerPage;
