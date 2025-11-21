import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, doc, setDoc, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { auth } from "../firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import loadingGif from "../assets/gif/loading-fill.gif";

import {
  PencilSquareIcon,
  QrCodeIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

const { DateTime } = require("luxon");

function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  // for export
  const [attendance, setAttendance] = useState([]);
  const [exportEvent, setExportEvent] = useState(null);
  const [filterYear, setFilterYear] = useState("all");
  const [filterSection, setFilterSection] = useState("all");

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [allowOverride, setAllowOverride] = useState(false);
  const [allowViewing, setAllowViewing] = useState(false);
  const [forceSlot, setForceSlot] = useState("");

  // Accordion state for past events on mobile
  const [openAccordion, setOpenAccordion] = useState(null);

  // categorize based on date
  const categorizeEvent = (eventDate) => {
    if (!eventDate) return "unknown";
    const today = DateTime.now().setZone("Asia/Manila").toISODate();
    if (eventDate === today) return "ongoing";
    if (eventDate > today) return "upcoming";
    if (eventDate < today) return "finished";
    return "unknown";
  };

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        const tokenResult = await user.getIdTokenResult();
        setRole(tokenResult.claims.role || null);
      } else {
        setRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Memoize categorized events
  const { ongoingEvents, upcomingEvents, finishedEvents } = useMemo(() => {
    const ongoing = events.filter((event) => event.status === "ongoing");
    const upcoming = events.filter((event) => event.status === "upcoming");
    const finished = events.filter((event) => event.status === "finished");
    return {
      ongoingEvents: ongoing,
      upcomingEvents: upcoming,
      finishedEvents: finished,
    };
  }, [events]);

  // Fetch attendance for export
  const fetchAttendance = async (event) => {
    const snap = await getDocs(collection(db, "events", event.id, "attendance"));
    let results = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      let attended = 0;
      event.slots?.forEach((slot) => {
        if (data[slot.label]) attended++;
      });
      results.push({
        id: docSnap.id,
        ...data,
        attended,
      });
    });
    return results;
  };

  // Export logic
  const openExportModal = async (event) => {
    setExportEvent(event);
    const students = await fetchAttendance(event);
    setAttendance(students);
  };

  const handleExport = async () => {
    if (!exportEvent) return;
    let students = await fetchAttendance(exportEvent);
    let filtered = students.filter((s) => {
      if (filterYear !== "all" && s.year !== Number(filterYear)) return false;
      if (filterSection !== "all" && s.section !== filterSection) return false;
      return true;
    });
    filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));
    const excelData = filtered.map((s) => ({
      StudentID: s.id,
      LastName: s.lastName,
      FirstName: s.firstName,
      Year: s.year,
      Section: s.section,
      Attended: s.attended,
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `${exportEvent.name}_attendance.xlsx`);
    setExportEvent(null);
  };

  // Fetch events
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "events"),
      (snapshot) => {
        let list = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const status = categorizeEvent(data.date);
          list.push({ id: doc.id, ...data, status });
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        setEvents(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching events:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Open modal for event
  const openConfigModal = (event) => {
    setSelectedEvent(event);
    setAllowOverride(event.config?.allowOverride || false);
    setAllowViewing(event.config?.allowViewing || false);
    setForceSlot(event.config?.forceSlot || "");
  };

  // Save scanning config
  const saveConfig = async () => {
    if (!selectedEvent) return;
    await setDoc(
      doc(db, "events", selectedEvent.id),
      {
        config: {
          allowOverride: allowOverride,
          forceSlot: forceSlot || null,
          allowViewing: allowViewing,
        },
      },
      { merge: true }
    );
    setSelectedEvent(null);
  };

  const toggleAccordion = (eventId) => {
    setOpenAccordion(openAccordion === eventId ? null : eventId);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Events Dashboard</h2>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <img src={loadingGif} alt="Loading..." className="h-20 w-20" />
            <p className="text-gray-500 ml-4 text-lg">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-xl">No events have been created yet.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Live Now Section */}
            {ongoingEvents.length > 0 && (
              <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="relative flex h-3 w-3 mr-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  Live Now
                </h3>
                <div className="space-y-6">
                  {ongoingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="bg-white rounded-2xl shadow-lg border-2 border-green-500 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                    >
                      <div className="flex-grow">
                        <h4 className="text-xl font-bold text-gray-900">{event.name}</h4>
                        <p className="text-gray-600 mt-1">{event.date}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <button
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition"
                          onClick={() => navigate(`/events/${event.id}/scanner`)}
                        >
                          <QrCodeIcon className="h-6 w-6" />
                          Scan QR
                        </button>
                        <button
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition"
                          onClick={() => navigate(`/events/${event.id}/attendance`)}
                        >
                          <EyeIcon className="h-5 w-5" />
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Section */}
            {upcomingEvents.length > 0 && (
              <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Upcoming</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow flex flex-col p-6"
                    >
                      <div className="flex-grow">
                        <h4 className="text-lg font-semibold text-gray-800">{event.name}</h4>
                        <p className="text-sm text-gray-500 mb-4">{event.date}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          className="flex items-center justify-center gap-2 w-full px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
                          onClick={() => openConfigModal(event)}
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                          Edit Rules
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Past Events Section */}
            {finishedEvents.length > 0 && (
              <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Past Events</h3>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Name</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendees</th>
                          <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {finishedEvents.map((event) => (
                          <tr key={event.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{event.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.attendees || "N/A"}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2 flex items-center justify-between">
                              <button
                                onClick={() => openExportModal(event)}
                                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Export
                              </button>
                              <button
                                onClick={() => navigate(`/events/${event.id}/attendance`)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Mobile Accordion */}
                <div className="md:hidden space-y-3">
                  {finishedEvents.map((event) => (
                    <div key={event.id} className="bg-white rounded-lg shadow-sm">
                      <button
                        onClick={() => toggleAccordion(event.id)}
                        className="w-full flex justify-between items-center px-4 py-3 text-left"
                      >
                        <div>
                          <p className="font-semibold text-gray-800">{event.name}</p>
                          <p className="text-sm text-gray-500">{event.date}</p>
                        </div>
                        <ChevronDownIcon
                          className={`h-6 w-6 text-gray-500 transform transition-transform ${openAccordion === event.id ? "rotate-180" : ""
                            }`}
                        />
                      </button>
                      {openAccordion === event.id && (
                        <div className="px-4 pb-4 border-t border-gray-200">
                          <div className="py-3 space-y-2">
                            <p className="text-sm">
                              <span className="font-medium">Attendees:</span> {event.attendees || "N/A"}
                            </p>
                            <div className="flex gap-3 pt-2">
                              <button
                                onClick={() => navigate(`/events/${event.id}/attendance`)}
                                className="flex-1 bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md text-sm font-medium"
                              >
                                View Attendance
                              </button>
                              <button
                                onClick={() => openExportModal(event)}
                                className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Export
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Modals (unchanged) */}
      {selectedEvent && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <h3 className="text-xl font-semibold mb-4">
              Configure <i className="font-normal">{selectedEvent.name}</i>
            </h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Allow viewing for semi-admins</span>
                <input
                  type="checkbox"
                  checked={allowViewing}
                  onChange={(e) => setAllowViewing(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Allow scanning outside time slots</span>
                <input
                  type="checkbox"
                  checked={allowOverride}
                  onChange={(e) => setAllowOverride(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
              <label className="flex items-center justify-between">
                <span>Force Slot</span>
                <select
                  value={forceSlot}
                  onChange={(e) => setForceSlot(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">-- No Forced Slot --</option>
                  {selectedEvent.slots?.map((slot) => (
                    <option key={slot.id || slot.label} value={slot.label}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setSelectedEvent(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={saveConfig} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {exportEvent && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <h3 className="text-xl font-semibold mb-4">
              Export <i className="font-normal">{exportEvent.name}</i>
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <label className="block">
                Year:
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="border rounded px-2 py-1 ml-2">
                  <option value="all">All</option>
                  {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </label>
              <label className="block">
                Section:
                <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="border rounded px-2 py-1 ml-2" disabled={filterYear === "all"}>
                  <option value="all">All</option>
                  {/* Sections should be dynamically populated based on selected year */}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setExportEvent(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Export</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsPage;