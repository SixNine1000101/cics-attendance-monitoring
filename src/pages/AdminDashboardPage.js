import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";

function AdminDashboardPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState("");

  const slots = ["07AM", "12PM", "01PM", "05PM"];

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

  // Create new event
  const createEvent = async () => {
    if (!eventName.trim() || !eventDate.trim()) {
      setStatus("⚠️ Please enter both date and name.");
      return;
    }

    const eventId = `${eventDate}_${eventName.replace(/\s+/g, "-").toLowerCase()}`;

    try {
      setStatus("⏳ Setting up event...");

      await setDoc(doc(db, "events", eventId), {
        name: eventName,
        date: eventDate,
        slots,
        createdBy: auth.currentUser?.uid || "system",
        createdAt: new Date(),
        status: "upcoming",
      });

      const studentsSnap = await getDocs(collection(db, "students"));
      let total = 0;

      for (const studentDoc of studentsSnap.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;

        const attendanceRef = doc(db, "events", eventId, "attendance", studentId);

        const slotData = {};
        slots.forEach((slot) => {
          slotData[slot] = false;
        });

        await setDoc(attendanceRef, {
          studentId,
          ...studentData,
          ...slotData,
        });

        total++;
      }

      setStatus(`✅ Event "${eventName}" created with ${total} students.`);
      setEventName("");
      setEventDate("");

      // Close modal after success
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
          onClick={() => navigate("/students")}
          className="bg-white shadow-md rounded-xl p-6 flex flex-col items-start hover:shadow-lg transition"
        >
          <div className="text-gray-500 text-3xl mb-2">🎓</div>
          <h3 className="text-lg font-semibold text-gray-700">Manage Students</h3>
          <p className="text-sm text-gray-500">Add or remove students</p>
        </button>

        <button
          onClick={() => navigate("/scanner")}
          className="bg-white shadow-md rounded-xl p-6 flex flex-col items-start hover:shadow-lg transition"
        >
          <div className="text-gray-500 text-3xl mb-2">📷</div>
          <h3 className="text-lg font-semibold text-gray-700">Open Scanner</h3>
          <p className="text-sm text-gray-500">Scan student QR codes</p>
        </button>

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
            {status && <p className="mt-3 text-sm text-gray-600">{status}</p>}

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
