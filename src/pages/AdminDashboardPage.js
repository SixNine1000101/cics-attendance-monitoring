import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";

function AdminDashboardPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [status, setStatus] = useState("");
  const [attendeeScope, setAttendeeScope] = useState("all");

  const [previewDates, setPreviewDates] = useState([]);

  // default slots
  const [slots, setSlots] = useState([
    { id: "07AM", label: "07AM", start: "06:00", end: "08:00" },
    { id: "12PM", label: "12PM", start: "12:00", end: "13:00" },
    { id: "01PM", label: "01PM", start: "13:00", end: "14:00" },
    { id: "05PM", label: "05PM", start: "16:30", end: "18:00" },
  ]);
  const [slotsOpen, setSlotsOpen] = useState(false);

  // slot management
  const addSlot = () => {
    setSlots([...slots, { id: crypto.randomUUID(), label: "", start: "", end: "" }]);
  };

  const updateSlot = (id, field, value) => {
    setSlots(slots.map(slot =>
      slot.id === id ? { ...slot, [field]: value } : slot
    ));
  };

  const removeSlot = (id) => {
    setSlots(slots.filter(slot => slot.id !== id));
  };

  useEffect(() => {
    if (startDate && endDate) {
      setPreviewDates(getDateRange(startDate, endDate));
    } else {
      setPreviewDates([]);
    }
  }, [startDate, endDate, slots]);

  // auth guard
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

  // helper: generate date range
  function getDateRange(start, end) {
    const result = [];
    let curr = new Date(start);
    const last = new Date(end);
    while (curr <= last) {
      result.push(curr.toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return result;
  }

  // create multi-day event (creates one event per day)
  const createEvent = async () => {
    if (!eventName.trim() || !startDate.trim() || !endDate.trim()) {
      setStatus("⚠️ Please enter event name and date range.");
      return;
    }

    const dates = getDateRange(startDate, endDate);

    try {
      setStatus("Setting up multi-day event...");

      let totalCreated = 0;

      for (const date of dates) {
        const eventId = `${date}_${eventName.replace(/\s+/g, "-").toLowerCase()}`;

        await setDoc(doc(db, "events", eventId), {
          name: eventName,
          date,
          slots,
          createdBy: auth.currentUser?.uid || "system",
          createdAt: new Date(),
          config: {
            allowOverride: false,
            forceSlot: null,
          },
        });

        // attendees
        if (attendeeScope === "empty") {
          // no attendees preloaded
        } else {
          let snap;
          if (attendeeScope === "all") {
            snap = await getDocs(collection(db, "students"));
          } else if (attendeeScope === "officers") {
            snap = await getDocs(collection(db, "officers"));
          }

          let batch = writeBatch(db);
          let batchCount = 0;

          for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const id = docSnap.id;

            const attendanceRef = doc(db, "events", eventId, "attendance", id);

            const slotData = {};
            slots.forEach((slot) => {
              slotData[slot.label] = false;
            });

            batch.set(attendanceRef, {
              studentId: id,
              ...data,
              ...slotData,
            });

            batchCount++;
            if (batchCount === 500) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }

          if (batchCount > 0) {
            await batch.commit();
          }
        }

        totalCreated++;
      }

      setStatus(`✅ Created ${totalCreated} event(s) for "${eventName}".`);
      setEventName("");
      setStartDate("");
      setEndDate("");

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
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 max-h-screen">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Create Event</h3>

            <input
              type="text"
              placeholder="Event Name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {/* Date Inputs */}
            <div className="flex gap-2 mb-4">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Time Slots */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setSlotsOpen(!slotsOpen)}
                className="flex justify-between w-full bg-gray-100 px-3 py-2 rounded"
              >
                <span className="font-semibold text-gray-700">Time Slots</span>
                <span>{slotsOpen ? "▲" : "▼"}</span>
              </button>

              {slotsOpen && (
                <div className="mt-3 space-y-3  overflow-y-auto">
                  {slots.map((slot) => (
                    <div key={slot.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Label"
                        value={slot.label}
                        onChange={(e) => updateSlot(slot.id, "label", e.target.value)}
                        className="flex-1 border rounded px-2 py-1 w-16"
                      />
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => updateSlot(slot.id, "start", e.target.value)}
                        className="border rounded px-2 py-1"
                      />
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateSlot(slot.id, "end", e.target.value)}
                        className="border rounded px-2 py-1"
                      />
                      <button
                        onClick={() => removeSlot(slot.id)}
                        className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSlot}
                    className="w-30 bg-green-500 text-white rounded px-3 py-1 hover:bg-green-600"
                  >
                    ➕ Add Slot
                  </button>
                </div>
              )}
            </div>

            {/* Attendees */}
            <select
              value={attendeeScope}
              onChange={(e) => setAttendeeScope(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Students</option>
              <option value="officers">Officers Only</option>
              <option value="empty">Empty (manual add later)</option>
            </select>

            {/* Preview Section */}
            {previewDates.length > 0 && (
              <div className="mb-4 border rounded bg-gray-50 p-3 max-h-40 overflow-y-auto">
                <p className="font-semibold text-gray-700 mb-2">
                  Preview ({previewDates.length} event{previewDates.length > 1 ? "s" : ""}):
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {previewDates.map((d) => (
                    <li key={d}>
                      📅 {d} — {slots.length} slot{slots.length > 1 ? "s" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={createEvent}
              className="w-full bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700 transition"
            >
              Create Event(s)
            </button>

            <div className="pt-4 flex items-center gap-2">
              {status.startsWith("Setting up") && (
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
