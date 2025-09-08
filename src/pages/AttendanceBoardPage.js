import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useParams } from "react-router-dom";
import loadingGif from "../assets/gif/loading-fill.gif";

function AttendanceBoardPage() {
  const { eventId } = useParams();
  const [students, setStudents] = useState([]);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);

  // filters and sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("nameAsc");
  const [groupOption, setGroupOption] = useState("none");
  const [filterYear, setFilterYear] = useState("all");
  const [filterSection, setFilterSection] = useState("all");

  // For scroll to top button
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300); // Show button after 300px
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const slots = ["07AM", "12PM", "01PM", "05PM"];

  // Subscribe to attendance
  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
      try {
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          setEventName(eventSnap.data().name || "");
        }

        const unsubscribe = onSnapshot(
          collection(db, "events", eventId, "attendance"),
          (snapshot) => {
            let results = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              let attended = 0;
              slots.forEach((slot) => {
                if (data[slot]) attended++;
              });
              const percentage = Math.round((attended / slots.length) * 100);

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
            setStudents(results);
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching attendance:", error);
            setLoading(false);
          }
        );

        // cleanup
        return unsubscribe;
      } catch (err) {
        console.error("Error loading event:", err);
        setLoading(false);
      }
    };

    const unsubscribePromise = fetchData();

    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (typeof unsubscribe === "function") unsubscribe();
      });
    };
  }, [eventId]);

  // Available sections
  const availableSections = () => {
    if (filterYear === "all") return [];
    const sections = students
      .filter((s) => s.year === Number(filterYear))
      .map((s) => s.section);
    return Array.from(new Set(sections)).sort();
  };

  // Filter + search
  let filtered = students
    .filter((s) => {
      const term = (searchTerm || "").toLowerCase();
      return (
        (s.id|| "").toLowerCase().includes(term) ||
        (s.firstName && (s.firstName || "").toLowerCase().includes(term)) ||
        (s.lastName && (s.lastName || "").toLowerCase().includes(term))
      );
    })
    .filter((s) => {
      if (filterYear !== "all" && s.year !== Number(filterYear)) return false;
      if (filterSection !== "all" && s.section !== filterSection) return false;
      return true;
    });

  // Sorting
  filtered.sort((a, b) => {
    switch (sortOption) {
      case "nameAsc":
        return a.lastName.localeCompare(b.lastName); 
      case "nameDesc":
        return b.lastName.localeCompare(a.lastName);
      case "percentageAsc":
        return a.percentage - b.percentage;
      case "percentageDesc":
        return b.percentage - a.percentage;
      default:
        return a.lastName.localeCompare(b.lastName);
    }
  });

  // Table
  const renderTable = (list) => (
    <div className="overflow-x-auto rounded-lg shadow">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-200 text-gray-700">
          <tr>
            <th className="px-4 py-2 text-left">Student ID</th>
            <th className="px-4 py-2 text-left">Last Name</th>
            <th className="px-4 py-2 text-left">First Name</th>
            <th className="px-4 py-2 text-left">Year</th>
            <th className="px-4 py-2 text-left">Section</th>
            <th className="px-4 py-2 text-center">Attended</th>
            <th className="px-4 py-2 text-center">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {list.map((student) => (
            <tr
              key={student.id}
              className={`${student.percentage > 75
                ? "bg-green-100"
                : student.percentage > 50
                  ? "bg-yellow-100"
                  : student.percentage > 25
                    ? "bg-orange-100"
                    : "bg-red-100"
                } border-b`}
            >
              <td className="px-4 py-2">{student.id}</td>
              <td className="px-4 py-2">{student.lastName || "-"}</td>
              <td className="px-4 py-2">{student.firstName || "-"}</td>
              <td className="px-4 py-2">{student.year || "-"}</td>
              <td className="px-4 py-2">{student.section || "-"}</td>
              <td className="px-4 py-2 text-center">
                {student.attended}/{slots.length}
              </td>
              <td className="px-4 py-2 text-center font-semibold">
                {student.percentage}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render grouped
  const renderGrouped = () => {
    if (groupOption === "year") {
      const years = Array.from(new Set(filtered.map((s) => s.year))).sort();
      return years.map((year) => (
        <div key={year} className="mb-8">
          <h3 className="text-xl font-bold mb-3">Year {year}</h3>
          {renderTable(filtered.filter((s) => s.year === year))}
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
            <h3 className="text-xl font-bold mb-3">Year {year}</h3>
            {sections.map((section) => (
              <div key={section} className="mb-6 pl-4 border-l-4 border-blue-500">
                <h4 className="text-lg font-semibold mb-2">Section {section}</h4>
                {renderTable(
                  filtered.filter(
                    (s) => s.year === year && s.section === section
                  )
                )}
              </div>
            ))}
          </div>
        );
      });
    }

    return renderTable(filtered);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">
        Attendance Board (Event: {eventName})
      </h2>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by ID or Name..."
          className="border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
        >
          <option value="nameAsc">Sort: Last Name A–Z</option>
          <option value="nameDesc">Sort: Last Name Z–A</option>
          <option value="percentageDesc">Sort: Percentage ↓</option>
          <option value="percentageAsc">Sort: Percentage ↑</option>
        </select>

        <select
          className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          className="border border-gray-300 rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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

      {loading ? (
        <div className="text-center mt-20">
          <img
            className="mx-auto"
            src={loadingGif}
            alt="Loading..."
            width={100}
            height={50}
          />
          <p className="text-gray-500 text-center">Loading...</p>
        </div>
      ) : (
        renderGrouped()
      )}

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition"
        >
          ↑ Top
        </button>
      )}
    </div>

  );
}

export default AttendanceBoardPage;
