import React, { useEffect } from "react";
import { collection, addDoc, getDocs , doc, setDoc} from "firebase/firestore";
import { db } from "./firebase";
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import EventsPage from "./pages/EventsPage";
import AttendanceBoardPage from "./pages/AttendanceBoardPage";
import ScannerPage from "./pages/ScannerPage";



function App() {
  return (
    <Router>
      <nav style={{ padding: "10px", background: "#eee" }}>
        <Link to="/login" style={{ marginRight: "10px" }}>Login</Link>
        <Link to="/admin-dashboard" style={{ marginRight: "10px" }}>Admin</Link>
        <Link to="/events" style={{ marginRight: "10px" }}>Events</Link>
        {/* <Link to="/scanner" style={{ marginRight: "10px" }}>Scanner</Link> */}
        {/* <Link to="/attendance">Event Attendance</Link> */}
      </nav>

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/attendance" element={<AttendanceBoardPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId/attendance" element={<AttendanceBoardPage />} />
        <Route path="/" element={<EventsPage/>} /> {/* default page */}
      </Routes>
    </Router>
  );
}

export default App;

// function App() {
//   useEffect(() => {
//     // Sample test
//     addStudent("23-22524", "Jane Doe", "2nd Year", "B");
//   }, []);
//   return <h1>Firebase Test</h1>;
// }

// // Add student with custom ID
// async function addStudent(studentId, Name, Year, Section) {
//   try {
//     await setDoc(doc(db, "students", studentId), {
//       name: Name,
//       year: Year,
//       section: Section,
//       totalScans: 0,
//       attendance: {}
//     });
//   } catch (error) {
//     console.error("Error adding student:", error);
//   }
// }


// export default App;
