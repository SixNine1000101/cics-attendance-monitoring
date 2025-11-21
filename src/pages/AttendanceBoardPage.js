import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, query, orderBy, limit, startAfter, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useParams } from "react-router-dom";
import loadingGif from "../assets/gif/loading-fill.gif";
import Tooltip from "../components/Tooltip";
import { useNavigate } from "react-router-dom";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import BackButton from "../components/BackButton";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function AttendanceBoardPage() {
  const { eventId } = useParams();
  const [students, setStudents] = useState([]);
  const [eventName, setEventName] = useState("");

  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const recordsPerPage = 50;

  // Filters and sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("percentageDesc");
  const [groupOption, _setGroupOption] = useState("none");
  const [filterYear, setFilterYear] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [slots, setSlots] = useState([]);

  // Mobile filter drawer
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // For scroll to top button
  const [showScrollTop, setShowScrollTop] = useState(false);

  /** Auth guard */
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdTokenResult();
        setRole(token.claims.role || "");
      } else {
        setRole("");
      }
      setLoadingRole(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 1. Load event and slots
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) return;

      setSlots(eventSnap.data().slots || []);
      setEventName(eventSnap.data().name || "");
    })();
  }, [eventId]);

  // Initial load and filter changes
  useEffect(() => {
    let isMounted = true;

    const loadAttendance = async () => {
      if (!eventId || !role || slots.length === 0) return;
      if (!isMounted) return;

      setLoading(true);
      setStudents([]);
      setLastVisible(null);
      setHasMore(true);

      try {
        let attendanceRef = collection(db, "events", eventId, "attendance");
        let attendanceQuery;

        if (searchTerm) {
          // Search mode: fetch all matching records without pagination
          attendanceQuery = query(
            attendanceRef,
            orderBy("lastName", "asc"),
            where("lastName", ">=", searchTerm.toUpperCase()),
            where("lastName", "<=", searchTerm.toUpperCase() + "\uf8ff")
          );

          if (filterYear !== "all") {
            attendanceQuery = query(
              attendanceRef,
              orderBy("lastName", "asc"),
              where("lastName", ">=", searchTerm.toUpperCase()),
              where("lastName", "<=", searchTerm.toUpperCase() + "\uf8ff"),
              where("year", "==", Number(filterYear))
            );
          }

          const querySnapshot = await getDocs(attendanceQuery);
          let results = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let attended = 0;
            slots.forEach((slot) => {
              const key = slot.label || slot;
              if (data[key]) attended++;
            });
            const percentage = Math.round((attended / slots.length) * 100);
            results.push({ id: docSnap.id, ...data, attended, percentage });
          });

          if (isMounted) {
            setStudents(results);
            setHasMore(false);
            setLoading(false);
          }
        } else {
          // Pagination mode
          let baseQuery = [attendanceRef];

          if (filterYear !== "all") {
            baseQuery.push(where("year", "==", Number(filterYear)));
          }

          // Apply sorting
          switch (sortOption) {
            case "percentageDesc":
            case "percentageAsc":
              baseQuery.push(orderBy("lastName", "asc")); // We'll sort by percentage client-side
              break;
            case "nameAsc":
              baseQuery.push(orderBy("lastName", "asc"));
              break;
            case "nameDesc":
              baseQuery.push(orderBy("lastName", "desc"));
              break;
            default:
              baseQuery.push(orderBy("lastName", "asc"));
          }

          baseQuery.push(limit(recordsPerPage));

          attendanceQuery = query(...baseQuery);

          const querySnapshot = await getDocs(attendanceQuery);
          let results = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let attended = 0;
            slots.forEach((slot) => {
              const key = slot.label || slot;
              if (data[key]) attended++;
            });
            const percentage = Math.round((attended / slots.length) * 100);
            results.push({ id: docSnap.id, ...data, attended, percentage });
          });

          if (isMounted) {
            const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
            setLastVisible(lastDoc);
            setStudents(results);
            setHasMore(results.length === recordsPerPage);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching attendance:", error);
        if (isMounted) {
          setStudents([]);
          setHasMore(false);
          setLoading(false);
        }
      }
    };

    loadAttendance();

    return () => {
      isMounted = false;
    };
  }, [eventId, role, slots, searchTerm, filterYear, sortOption]);

  // Load more function
  const handleLoadMore = async () => {
    if (!lastVisible || loading) return;

    setLoading(true);
    try {
      let attendanceRef = collection(db, "events", eventId, "attendance");
      let baseQuery = [attendanceRef];

      if (filterYear !== "all") {
        baseQuery.push(where("year", "==", Number(filterYear)));
      }

      // Apply sorting
      switch (sortOption) {
        case "percentageDesc":
        case "percentageAsc":
          baseQuery.push(orderBy("lastName", "asc"));
          break;
        case "nameAsc":
          baseQuery.push(orderBy("lastName", "asc"));
          break;
        case "nameDesc":
          baseQuery.push(orderBy("lastName", "desc"));
          break;
        default:
          baseQuery.push(orderBy("lastName", "asc"));
      }

      baseQuery.push(startAfter(lastVisible));
      baseQuery.push(limit(recordsPerPage));

      const attendanceQuery = query(...baseQuery);
      const querySnapshot = await getDocs(attendanceQuery);

      let newResults = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let attended = 0;
        slots.forEach((slot) => {
          const key = slot.label || slot;
          if (data[key]) attended++;
        });
        const percentage = Math.round((attended / slots.length) * 100);
        newResults.push({ id: docSnap.id, ...data, attended, percentage });
      });

      setStudents((prev) => [...prev, ...newResults]);
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(newResults.length === recordsPerPage);
    } catch (error) {
      console.error("Error loading more attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  // Available sections
  const availableSections = () => {
    if (filterYear === "all") return [];
    const sections = students
      .filter((s) => s.year === Number(filterYear))
      .map((s) => s.section);
    return Array.from(new Set(sections)).sort();
  };

  // Client-side filtering for section only (year and search handled by Firestore)
  let filtered = students.filter((s) => {
    if (filterSection !== "all" && s.section !== filterSection) return false;
    return true;
  });

  // Client-side sorting for percentage (other sorting handled by Firestore)
  if (sortOption === "percentageDesc" || sortOption === "percentageAsc") {
    filtered.sort((a, b) => {
      return sortOption === "percentageDesc"
        ? b.percentage - a.percentage
        : a.percentage - b.percentage;
    });
  }

  // Export logic
  const handleExport = () => {
    let excelData = filtered.map((s) => {
      const studentRecord = {
        StudentID: s.id,
        LastName: s.lastName,
        FirstName: s.firstName,
        Year: s.year,
        Section: s.section,
      };
      // Add attendance for each slot
      slots.forEach((slot) => {
        const key = slot.label || slot;
        studentRecord[key] = s[key] ? "Present" : "Absent";
      });
      studentRecord["Total Attended"] = s.attended;
      studentRecord["Percentage"] = `${s.percentage}%`;
      return studentRecord;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `${eventName}_attendance.xlsx`);
  };

  // Get percentage color class
  const getPercentageColor = (percentage) => {
    if (percentage > 75) return "bg-green-500";
    if (percentage > 50) return "bg-yellow-500";
    if (percentage > 25) return "bg-orange-500";
    return "bg-red-500";
  };

  const getPercentageRowColor = (percentage) => {
    if (percentage > 75) return "bg-green-50";
    if (percentage > 50) return "bg-yellow-50";
    if (percentage > 25) return "bg-orange-50";
    return "bg-red-50";
  };

  // Render Student Card (Mobile)
  const renderStudentCard = (student) => (
    <div
      key={student.id}
      className={`${getPercentageRowColor(student.percentage)} border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        {/* Left: Student Info */}
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 text-lg">
            {student.lastName}, {student.firstName}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{student.id}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <span className="bg-white px-2 py-1 rounded border border-gray-200">
              Year {student.year}
            </span>
            <span className="bg-white px-2 py-1 rounded border border-gray-200">
              Sec {student.section}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Attended: <span className="font-semibold">{student.attended}/{slots.length}</span>
          </p>
        </div>

        {/* Right: Percentage Badge */}
        <div className="flex flex-col items-end">
          <div className={`${getPercentageColor(student.percentage)} text-white font-bold text-xl px-4 py-2 rounded-lg shadow-md`}>
            {student.percentage}%
          </div>
        </div>
      </div>
    </div>
  );

  // Table (Desktop)
  const renderTable = (list) => (
    <div className="overflow-x-auto rounded-xl shadow-md border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-800 text-white">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Student ID</th>
            <th className="px-4 py-3 text-left font-semibold">Last Name</th>
            <th className="px-4 py-3 text-left font-semibold">First Name</th>
            <th className="px-4 py-3 text-left font-semibold">Year</th>
            <th className="px-4 py-3 text-left font-semibold">Section</th>
            <th className="px-4 py-3 text-center font-semibold">Attended</th>
            <th className="px-4 py-3 text-center font-semibold">Percentage</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {list.map((student, index) => (
            <tr
              key={student.id}
              className={`${getPercentageRowColor(student.percentage)} ${index % 2 === 0 ? 'bg-opacity-50' : ''} border-b border-gray-200 hover:bg-opacity-75 transition-colors`}
            >
              <td className="px-4 py-3 font-medium text-gray-800">{student.id}</td>
              <td className="px-4 py-3 text-gray-700">{student.lastName || "-"}</td>
              <td className="px-4 py-3 text-gray-700">{student.firstName || "-"}</td>
              <td className="px-4 py-3 text-gray-600">{student.year || "-"}</td>
              <td className="px-4 py-3 text-gray-600">{student.section || "-"}</td>
              <td className="px-4 py-3 text-center font-medium text-gray-800">
                {student.attended}/{slots.length}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`${getPercentageColor(student.percentage)} text-white font-bold px-3 py-1 rounded-lg`}>
                  {student.percentage}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render Card List (Mobile)
  const renderCardList = (list) => (
    <div className="space-y-3">
      {list.map((student) => renderStudentCard(student))}
    </div>
  );

  // Render grouped
  const renderGrouped = () => {
    if (groupOption === "year") {
      const years = Array.from(new Set(filtered.map((s) => s.year))).sort();
      return years.map((year) => (
        <div key={year} className="mb-8">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Year {year}</h3>
          {/* Desktop Table */}
          <div className="hidden md:block">
            {renderTable(filtered.filter((s) => s.year === year))}
          </div>
          {/* Mobile Cards */}
          <div className="block md:hidden">
            {renderCardList(filtered.filter((s) => s.year === year))}
          </div>
        </div>
      ));
    }

    if (groupOption === "yearSection") {
      const years = Array.from(new Set(filtered.map((s) => s.year))).sort();
      return years.map((year) => {
        const sections = Array.from(
          new Set(filtered.filter((s) => s.year === year).map((s) => s.section))
        ).sort();
        return (
          <div key={year} className="mb-8">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Year {year}</h3>
            {sections.map((section) => (
              <div key={section} className="mb-6 pl-4 border-l-4 border-blue-500">
                <h4 className="text-lg font-semibold mb-3 text-gray-700">Section {section}</h4>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  {renderTable(
                    filtered.filter(
                      (s) => s.year === year && s.section === section
                    )
                  )}
                </div>
                {/* Mobile Cards */}
                <div className="block md:hidden">
                  {renderCardList(
                    filtered.filter(
                      (s) => s.year === year && s.section === section
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      });
    }

    // No grouping - render both table and cards
    return (
      <>
        {/* Desktop Table */}
        <div className="hidden md:block">
          {renderTable(filtered)}
        </div>
        {/* Mobile Cards */}
        <div className="block md:hidden">
          {renderCardList(filtered)}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-white shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Back Button + Event Name */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Back Button */}
            <BackButton />
            <h2 className="text-lg md:text-xl font-bold text-gray-800 truncate">
              {eventName}
            </h2>
          </div>

          {/* Right: Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            {/* Download SVG Icon */}
              <Tooltip text="Export as XLSX">
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden md:inline font-semibold">Export</span>
                </>
              </Tooltip>
          </button>
        </div>
      </header>

      {/* Toolbar - Matches StudentsPage styling */}
      <div className="sticky top-[60px] z-20 bg-white/80 backdrop-blur-sm p-4 shadow-sm border-b border-gray-200">
        {/* Mobile Toolbar */}
        <div className="flex md:hidden gap-2">
          <div className="relative flex-grow">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name or ID..."
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsFilterDrawerOpen(true)}
            className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition"
          >
            <FunnelIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Desktop Toolbar */}
        <div className="hidden md:flex flex-wrap gap-4">
          <div className="relative flex-grow">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name or ID..."
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="percentageDesc">Sort: Percentage ↓</option>
            <option value="percentageAsc">Sort: Percentage ↑</option>
            <option value="nameAsc">Sort: Last Name A–Z</option>
            <option value="nameDesc">Sort: Last Name Z–A</option>
          </select>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterYear}
            onChange={(e) => {
              setFilterYear(e.target.value);
              setFilterSection("all");
            }}
          >
            <option value="all">All Years</option>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>

          <select
            className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            disabled={filterYear === "all" || availableSections().length === 0}
          >
            <option value="all">All Sections</option>
            {availableSections().map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold">{filtered.length}</span> students
            {hasMore && <span className="text-gray-400"> (Load more to see all)</span>}
          </p>
        </div>

        {/* Loading State */}
        {loading && students.length === 0 ? (
          <div className="text-center mt-20">
            <img
              className="mx-auto"
              src={loadingGif}
              alt="Loading..."
              width={100}
              height={50}
            />
            <p className="text-gray-500 text-center mt-4">Loading attendance data...</p>
          </div>
        ) : (
          <>
            {renderGrouped()}

            {/* Load More Button */}
            {hasMore && !searchTerm && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleLoadMore}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}

        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 bg-blue-600 text-white w-12 h-12 rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center z-20"
          >
            {/* Arrow Up SVG */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile Filter Drawer - Matches StudentsPage styling */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-40 flex justify-end">
          <div className="bg-white w-80 h-full shadow-lg p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Filter & Sort</h3>
              <button onClick={() => setIsFilterDrawerOpen(false)}>
                <XMarkIcon className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            {/* Sort Option */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="percentageDesc">Percentage ↓</option>
                <option value="percentageAsc">Percentage ↑</option>
                <option value="nameAsc">Last Name A–Z</option>
                <option value="nameDesc">Last Name Z–A</option>
              </select>
            </div>

            {/* Year Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
                value={filterYear}
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  setFilterSection("all");
                }}
              >
                <option value="all">All Years</option>
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                disabled={filterYear === "all" || availableSections().length === 0}
              >
                <option value="all">All Sections</option>
                {availableSections().map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Apply Button */}
            <button
              onClick={() => setIsFilterDrawerOpen(false)}
              className="mt-auto bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceBoardPage;