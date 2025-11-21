import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import EventsPage from "./pages/EventsPage";
import AttendanceBoardPage from "./pages/AttendanceBoardPage";
import ScannerPage from "./pages/ScannerPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import StudentsPage from "./pages/StudentsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import "./css/AdminDashboardPage.css";


function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

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

  return (
    <Router>
      <Navbar user={user} role={role} />

      {/* Routes */}
      <div className="pb-16 md:pb-0">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute user={user} role={role} requiredRoles="admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard/students"
            element={
              <ProtectedRoute user={user} role={role} requiredRoles="admin">
                <StudentsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/events" element={<EventsPage />} />
          <Route
            path="/events/:eventId/scanner"
            element={
              <ProtectedRoute user={user} role={role} requiredRoles={["admin", "semi-admin"]}>
                <ScannerPage />
              </ProtectedRoute>
            }
          />
          {/* <Route path="/attendance" element={<AttendanceBoardPage />} /> */}
          <Route
            path="/events/:eventId/attendance"
            element={<AttendanceBoardPage />}
          />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/" element={<EventsPage />} />
        </Routes>
      </div>
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
