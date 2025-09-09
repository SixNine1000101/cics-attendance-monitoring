import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";

function AdminDashboardPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState("");

  const slots = ["07AM", "12PM", "01PM", "05PM"];

  // check if user is logged in
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  // create new event
  const createEvent = async () => {
    if (!eventName.trim() || !eventDate.trim()) {
      setStatus("⚠️ Please enter both date and name.");
      return;
    }

    const eventId = `${eventDate}_${eventName.replace(/\s+/g, "-").toLowerCase()}`; // e.g., "2023-09-01_orientation"

    try {
      setStatus("Setting up event...");

      await setDoc(doc(db, "events", eventId), {
        name: eventName,
        date: eventDate,
        slots,
        createdBy: auth.currentUser?.uid || "system",
        createdAt: new Date(),
        config: {
          "allowOverride": false,
          "forceSlot": null
        },
      });

      // for denormalized collection for faster fetching
      // get the students list
      // for denormalized collection for faster fetching
      const studentsSnap = await getDocs(collection(db, "students"));
      let total = 0;
      let batch = writeBatch(db);
      let batchCount = 0;
      // for each students, add their infos in the attendance collection with their matching id
      for (const studentDoc of studentsSnap.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;

        const attendanceRef = doc(db, "events", eventId, "attendance", studentId);

        const slotData = {};
        slots.forEach((slot) => {
          slotData[slot] = false;
        });

        batch.set(attendanceRef, {
          studentId,
          ...studentData,
          ...slotData,
        });

        total++;
        batchCount++;

        // Firestore limits batch writes to 500
        if (batchCount === 500) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      // Commit any remaining students
      if (batchCount > 0) {
        await batch.commit();
      }

      setStatus(`✅ Event "${eventName}" created with ${total} students.`);
      setEventName("");
      setEventDate("");

      // close modal after success
      setTimeout(() => {
        setShowModal(false);
        setStatus("");
      }, 1500);
    } catch (error) {
      console.error("Error creating event:", error);
      setStatus("❌ Failed to create event.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Welcome, Admin!</h1>
        <p className="text-gray-600">Choose an action:</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <button
          onClick={() => setShowModal(true)}
          className="bg-white shadow-md rounded-xl p-6 flex flex-col items-start hover:shadow-lg transition"
        >
          <div className="text-gray-500 text-3xl mb-2">➕</div>
          <h3 className="text-lg font-semibold text-gray-700">Create Event</h3>
          <p className="text-sm text-gray-500">Make a new event</p>
        </button>

        <button
          onClick={() => navigate("/admin-dashboard/students")}
          className="bg-white shadow-md rounded-xl p-6 flex flex-col items-start hover:shadow-lg transition"
        >
          <div className="text-gray-500 text-3xl mb-2">🎓</div>
          <h3 className="text-lg font-semibold text-gray-700">Manage Students</h3>
          <p className="text-sm text-gray-500">Add, edit or remove students</p>
        </button>

        {/* <button
          onClick={() => navigate("/scanner")}
          className="bg-white shadow-md rounded-xl p-6 flex flex-col items-start hover:shadow-lg transition"
        >
          <div className="text-gray-500 text-3xl mb-2">📷</div>
          <h3 className="text-lg font-semibold text-gray-700">Open Scanner</h3>
          <p className="text-sm text-gray-500">Scan student QR codes</p>
        </button> */}

        <button
          onClick={handleLogout}
          className="bg-white shadow-md rounded-xl p-6 flex flex-col items-start hover:shadow-lg transition"
        >
          <div className="text-gray-500 text-3xl mb-2">🚪</div>
          <h3 className="text-lg font-semibold text-gray-700">Logout</h3>
          <p className="text-sm text-gray-500">Sign out from the dashboard</p>
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Create New Event</h3>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="text"
              placeholder="Event Name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={createEvent}
              className="w-full bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700 transition"
            >
              Create Event
            </button>

            <div className="pt-4 flex items-center gap-2">
              {status.startsWith("Setting up event...") && (
                  <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              )}
              {status && <span className="text-sm text-gray-600">{status}</span>}
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full bg-gray-200 text-gray-700 rounded px-4 py-2 hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
