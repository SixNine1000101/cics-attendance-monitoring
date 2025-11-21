import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, getDocs, doc, setDoc, writeBatch, query, where, getCountFromServer } from "firebase/firestore";
import { PlusIcon, XMarkIcon, CalendarDaysIcon, UserGroupIcon, ServerStackIcon, UsersIcon } from "@heroicons/react/24/outline";
const { DateTime } = require("luxon");

function AdminDashboardPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [status, setStatus] = useState("");
  const [attendeeScope, setAttendeeScope] = useState("all");

  const [previewDates, setPreviewDates] = useState([]);
  const [todayEventsCount, setTodayEventsCount] = useState(0);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);

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

  useEffect(() => {
    const fetchDashboardData = async () => {
          // Fetch today's events count
          const today = DateTime.now().setZone("Asia/Manila").toISODate();
          const eventsRef = collection(db, "events");
          const q = query(eventsRef, where("date", "==", today));
          const todayEventsSnapshot = await getCountFromServer(q);
          setTodayEventsCount(todayEventsSnapshot.data().count);
    
          // Fetch total students count
          const studentsRef = collection(db, "students");
          const studentsSnapshot = await getCountFromServer(studentsRef);
          setTotalStudentsCount(studentsSnapshot.data().count);
    };

    fetchDashboardData();
  }, []);

  // auth guard
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

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

      let i = 1;
      for (const date of dates) {
        const eventId = `${date}_${eventName.replace(/\s+/g, "-").toLowerCase()}`;


        await setDoc(doc(db, "events", eventId), {
          name: `${eventName} - Day ${i++}`,
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="px-4 py-2">
        <h1 className="text-4xl font-bold text-gray-800">Welcome, Admin!</h1>
      </div>

      <div className="p-4 md:p-8">
        {/* Status Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Status Overview</h2>
          <div className="md:grid md:grid-cols-3 md:gap-6 flex overflow-x-auto gap-4 py-2">
            {/* System Status Card */}
            <div className="flex-shrink-0 w-60 md:w-auto bg-white shadow-md rounded-xl p-6 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <ServerStackIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">System Status</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <span className="text-lg font-bold text-gray-800">Online</span>
                </div>
              </div>
            </div>

            {/* Today's Events Card */}
            <div className="flex-shrink-0 w-60 md:w-auto bg-white shadow-md rounded-xl p-6 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Today's Events</h3>
                <p className="text-2xl font-bold text-gray-800 mt-1">{todayEventsCount}</p>
              </div>
            </div>

            {/* Total Students Card */}
            <div className="flex-shrink-0 w-60 md:w-auto bg-white shadow-md rounded-xl p-6 flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <UsersIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total Students</h3>
                <p className="text-2xl font-bold text-gray-800 mt-1">{totalStudentsCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Event Card */}
            <button
              onClick={() => setShowModal(true)}
              className="group bg-white border border-gray-200 p-8 rounded-2xl hover:shadow-lg hover:border-blue-500 transition-all duration-200 text-left flex flex-col items-start"
              title="Create Event"
            >
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <PlusIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Create Event</h3>
              <p className="text-gray-500 mt-2 text-sm">Schedule a new attendance session, set time slots, and scan rules.</p>
            </button>

            {/* Manage Students Card */}
            <button
              onClick={() => navigate("/admin-dashboard/students")}
              className="group bg-white border border-gray-200 p-8 rounded-2xl hover:shadow-lg hover:border-purple-500 transition-all duration-200 text-left flex flex-col items-start"
              title="Manage Students"
            >
              <div className="p-4 bg-purple-50 text-purple-600 rounded-xl mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <UserGroupIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Manage Students</h3>
              <p className="text-gray-500 mt-2 text-sm">View masterlist, edit student details, or update enrollment status.</p>
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Create New Event</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto">

              {/* Event Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. College Days - Day 1"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Date Range Box */}
              <div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Duration</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block mb-1">From</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block mb-1">To</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Time Slots (Chips Layout) */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">Time Slots</label>
                  <button onClick={addSlot} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    + Add Slot
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <div key={slot.id} className="flex items-center bg-blue-50 border border-blue-100 rounded-lg p-2 gap-2 shadow-sm">
                      <input
                        type="text"
                        value={slot.label}
                        onChange={(e) => updateSlot(slot.id, "label", e.target.value)}
                        className="bg-transparent w-12 text-sm font-bold text-blue-800 focus:outline-none text-center"
                      />
                      <div className="h-4 w-px bg-blue-200"></div>
                      <div className="flex flex-col text-xs text-blue-600">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) => updateSlot(slot.id, "start", e.target.value)}
                          className="bg-transparent focus:outline-none w-[60px]"
                        />
                      </div>
                      <button onClick={() => removeSlot(slot.id)} className="text-blue-400 hover:text-red-500 ml-1">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendee Scope */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Who can attend?</label>
                <select
                  value={attendeeScope}
                  onChange={(e) => setAttendeeScope(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">All Students (Check database)</option>
                  <option value="officers">Officers Only</option>
                  <option value="empty">Open Event (Record names as they scan)</option>
                </select>
              </div>

              {/* Loading / Status */}
              {status && (
                <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg flex items-center gap-3 mb-4">
                  {status.startsWith("Setting") && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
                  <p className="text-sm font-medium">{status}</p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={createEvent}
                className="flex-[2] px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition transform active:scale-95"
              >
                Publish Event
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;