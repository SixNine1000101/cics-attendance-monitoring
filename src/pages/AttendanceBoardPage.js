import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useParams } from "react-router-dom";
import "../css/AttendanceBoardPage.css";

function AttendanceBoardPage() {
  const { eventId } = useParams(); // 👈 get eventId from route
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("percentageDesc");
  const [groupOption, setGroupOption] = useState("none");
  const [filterYear, setFilterYear] = useState("all");
  const [filterSection, setFilterSection] = useState("all");

  const slots = ["07AM", "12PM", "01PM", "05PM"];

  // Subscribe to attendance for this event
  useEffect(() => {
    if (!eventId) return;

    const unsubscribe = onSnapshot(
      collection(db, "events", eventId, "attendance"),
      (snapshot) => {
        let results = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

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

    return () => unsubscribe();
  }, [eventId]);

  // Get sections available for selected year
  const availableSections = () => {
    if (filterYear === "all") return [];
    const sections = students
      .filter((s) => s.year === Number(filterYear))
      .map((s) => s.section);
    return Array.from(new Set(sections)).sort();
  };

  // Apply filtering/searching
  let filtered = students
    .filter((s) => {
      const term = searchTerm.toLowerCase();
      return (
        s.id.toLowerCase().includes(term) ||
        (s.firstName && s.firstName.toLowerCase().includes(term)) ||
        (s.lastName && s.lastName.toLowerCase().includes(term))
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
      default:
        return b.percentage - a.percentage;
    }
  });

  // Render table
  const renderTable = (list) => (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>Student ID</th>
          <th>Last Name</th>
          <th>First Name</th>
          <th>Year</th>
          <th>Section</th>
          <th>Attended</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        {list.map((student) => (
          <tr
            key={student.id}
            className={
              student.percentage > 75
                ? "row-green"
                : student.percentage > 50
                ? "row-yellow"
                : student.percentage > 25
                ? "row-orange"
                : "row-red"
            }
          >
            <td>{student.id}</td>
            <td>{student.lastName || "-"}</td>
            <td>{student.firstName || "-"}</td>
            <td>{student.year || "-"}</td>
            <td>{student.section || "-"}</td>
            <td>
              {student.attended}/{slots.length}
            </td>
            <td>{student.percentage}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Render grouped
  const renderGrouped = () => {
    if (groupOption === "year") {
      const years = Array.from(new Set(filtered.map((s) => s.year))).sort();
      return years.map((year) => (
        <div key={year} className="group-block">
          <h3 className="group-header">Year {year}</h3>
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
          <div key={year} className="group-block">
            <h3 className="group-header">Year {year}</h3>
            {sections.map((section) => (
              <div key={section} className="subgroup-block">
                <h4 className="subgroup-header">Section {section}</h4>
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
    <div className="leaderboard-container">
      <h2 className="leaderboard-title">Attendance Board (Event: {eventId})</h2>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search by ID or Name..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="toolbar-select"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
        >
          <option value="percentageDesc">Sort: Percentage ↓</option>
          <option value="percentageAsc">Sort: Percentage ↑</option>
          <option value="nameAsc">Sort: Last Name A–Z</option>
          <option value="nameDesc">Sort: Last Name Z–A</option>
        </select>

        <select
          className="toolbar-select"
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
          className="toolbar-select"
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

      {loading ? <p className="loading-text">Loading...</p> : renderGrouped()}
    </div>
  );
}

export default AttendanceBoardPage;
