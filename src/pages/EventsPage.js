import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { auth } from "../firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { QrCodeIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import loadingGif from "../assets/gif/loading-fill.gif";
const { DateTime } = require('luxon');


function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true); 
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  // for export
  const [attendance, setAttendance] = useState([]);
  // selected event for export
  const [exportEvent, setExportEvent] = useState(null);
  const [groupOption, setGroupOption] = useState("yearSection");
  const [filterYear, setFilterYear] = useState("all");
  const [filterSection, setFilterSection] = useState("all");

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [allowOverride, setAllowOverride] = useState(false);
  const [forceSlot, setForceSlot] = useState("");

  // categorize based on date
  const categorizeEvent = (eventDate) => {
    if (!eventDate) return "unknown";
    const today = DateTime.now().setZone('Asia/Manila').toISODate(); // YYYY-MM-DD
    console.log(today); 

    console.log(today.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }));
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

  // Available sections based on chosen year
  const availableSections = (students) => {
    if (filterYear === "all") return [];
    const sections = students
      .filter((s) => s.year === Number(filterYear))
      .map((s) => s.section);
    return Array.from(new Set(sections)).sort();
  };

  // Fetch attendance for export
  const fetchAttendance = async (eventId) => {
    const snap = await getDocs(collection(db, "events", eventId, "attendance"));
    let results = [];
    snap.forEach((doc) => {
      const data = doc.data();
      let attended = 0;
      ["07AM", "12PM", "01PM", "05PM"].forEach((slot) => {
        if (data[slot]) attended++;
      });
      const percentage = Math.round((attended / 4) * 100);
      results.push({
        id: data.studentId,
        firstName: data.firstName,
        lastName: data.lastName,
        year: data.year,
        section: data.section,
        attended,
        percentage,
      });
    });
    return results;
  };

  // Export logic
  const openExportModal = async (event) => {
    setExportEvent(event);
    const students = await fetchAttendance(event.id);
    setAttendance(students);
  };

  // Export to Excel
  const handleExport = async () => {
    if (!exportEvent) return;
    let students = await fetchAttendance(exportEvent.id);

    // Apply filters
    let filtered = students.filter((s) => {
      if (filterYear !== "all" && s.year !== Number(filterYear)) return false;
      if (filterSection !== "all" && s.section !== filterSection) return false;
      return true;
    });

    // Always sort by lastName asc
    filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));

    // Always group by Year -> Section
    let groupedData = [];
    const years = [...new Set(filtered.map((s) => s.year))].sort();

    years.forEach((year) => {
      // groupedData.push({ Header: `Year ${year}` });
      const sections = [
        ...new Set(filtered.filter((s) => s.year === year).map((s) => s.section)),
      ].sort();

      sections.forEach((section) => {
        // groupedData.push({ Header: `Section ${section}` });
        groupedData.push(
          ...filtered.filter((s) => s.year === year && s.section === section)
        );
      });
    });

    // Flatten for Excel
    let excelData = [];
    groupedData.forEach((item) => {
      if (item.Header) {
        excelData.push({ StudentID: item.Header });
      } else {
        excelData.push({
          StudentID: item.id,
          LastName: item.lastName,
          FirstName: item.firstName,
          Year: item.year,
          Section: item.section,
          Attended: item.attended,
          Percentage: `${item.percentage}%`,
        });
      }
    });

    // Create Excel file
    const worksheet = XLSX.utils.json_to_sheet(excelData, { skipHeader: false });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
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
          const status = categorizeEvent(data.date); // categorize based on date
          list.push({ id: doc.id, ...data, status });
        });

        list.sort((a, b) => (a.date < b.date ? 1 : -1));
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
    setAllowOverride(event.config.allowOverride || false);
    setForceSlot(event.config.forceSlot || "");
  };

  // Save scanning config
  const saveConfig = async () => {
    if (!selectedEvent) return;
    await setDoc(
      doc(db, "events", selectedEvent.id), {
      config: {
        "allowOverride": allowOverride,
        "forceSlot": forceSlot || null
      },
    },
      // { allowOverride, forceSlot: forceSlot || null },
      { merge: true }
    );
    setSelectedEvent(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">Events</h2>

      {loading ? (
        <div className="flex justify-center items-center">
          <img src={loadingGif} alt="Loading..." className="h-16 w-16" />
          <p className="text-gray-500 ml-4">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <p className="text-gray-500 text-center">No events yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition flex flex-col justify-between p-6"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${event.status === "ongoing"
                      ? "bg-green-500"
                      : event.status === "upcoming"
                        ? "bg-blue-500"
                        : "bg-gray-500"
                      }`}
                  ></span>
                  <span className="text-lg font-semibold text-gray-800">{event.name}</span>
                  {role === "admin" && (
                    <button className="bg-green-600 px-2 py-1 text-white  rounded font-medium ml-auto hover:bg-green-700"
                      onClick={() => openExportModal(event)}
                    >export</button>

                  )}
                </div>
                <div className="text-sm text-gray-500 mb-4">{event.date}</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {event.slots?.map((slot) => (
                    <span
                      key={slot}
                      className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-4">
                  {/* View Attendance */}
                  <button
                    disabled={!(role === "admin" || role === "semi-admin")}
                    className={`rounded px-4 py-2 font-medium transition flex-1
        ${role === "admin" || role === "semi-admin"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-400 text-gray-200 cursor-not-allowed hover:bg-gray-500"
                      }`}
                    onClick={() => navigate(`/events/${event.id}/attendance`)}
                  >
                    View Attendance
                  </button>

                  {/* Scan */}
                  {((role === "admin" || role === "semi-admin") && event.status === "ongoing") && (
                    <button
                      className="bg-slate-600 text-white rounded px-4 py-2 font-medium hover:bg-slate-700 transition-all duration-300 ease-in-out w-32 hover:w-40"
                      onClick={() => navigate(`/events/${event.id}/scanner`)}
                    >
                      <div className="flex items-center justify-center">
                        <QrCodeIcon className="h-6 w-6 mr-2" />
                        <span>Scan</span>
                      </div>
                    </button>
                  )}
                </div>

                {/*Edit Scanning Rules (only for admins) */}
                {(role === "admin") && (
                  <button
                    className="bg-gray-600 text-white rounded px-4 py-2 font-medium hover:bg-gray-500 transition"
                    onClick={() => openConfigModal(event)}
                  >
                    <div className="flex items-center justify-center">
                      <span>Edit Rules</span>
                      <PencilSquareIcon className="h-5 w-5 ml-4" />
                    </div>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* modal for editing scanning rules */}
      {selectedEvent && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <h3 className="text-xl font-semibold mb-4">
              Scanning Rules for {selectedEvent.name}
            </h3>

            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={allowOverride}
                onChange={(e) => setAllowOverride(e.target.checked)}
              />
              Allow scanning outside time slots
            </label>

            <label className="block mb-3">
              Force Slot:
              <select
                value={forceSlot}
                onChange={(e) => setForceSlot(e.target.value)}
                className="border rounded px-2 py-1 ml-2"
              >
                <option value="">-- No Forced Slot --</option>
                <option value="07AM">07AM</option>
                <option value="12PM">12PM</option>
                <option value="01PM">01PM</option>
                <option value="05PM">05PM</option>
              </select>
            </label>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal for export */}
      {exportEvent && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <h3 className="text-xl font-semibold mb-4">
              Export {exportEvent.name} as Excel
            </h3>

            <div className="flex items-center gap-2 mb-2">
              <label className="block mr-3">
                Year:
                <select
                  value={filterYear}
                  onChange={(e) => {
                    setFilterYear(e.target.value);
                    setFilterSection("all"); // reset section when year changes
                  }}
                  className="border rounded px-2 py-1 ml-2"
                >
                  <option value="all">All</option>
                  {[1, 2, 3, 4].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block mr-3">
                Section:
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  className="border rounded px-2 py-1 ml-2"
                  disabled={filterYear === "all"}
                >
                  <option value="all">All</option>
                  {availableSections(attendance).map((s) => (
                    <option key={s} value={s}>
                      Section {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setExportEvent(null)}
                className="px-4 py-2 bg-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default EventsPage;
