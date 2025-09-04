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
      {/* Navbar */}
      <nav className="bg-gray-800 text-white px-6 py-3 shadow-md">
        <div className="flex justify-between items-center">
          {/* Left side: navigation */}
          <div className="flex items-center gap-4">
            {!user && (
              <Link
                to="/login"
                className="hover:bg-gray-700 px-3 py-2 rounded transition"
              >
                Login
              </Link>
            )}
            {role === "admin" && (
              <Link
                to="/admin-dashboard"
                className="hover:bg-gray-700 px-3 py-2 rounded transition"
              >
                Admin
              </Link>
            )}
            {(role === "semi-admin" || role === "admin") && (
              <Link
                to="/scanner"
                className="hover:bg-gray-700 px-3 py-2 rounded transition"
              >
                Scanner
              </Link>
            )}
            <Link
              to="/events"
              className="hover:bg-gray-700 px-3 py-2 rounded transition"
            >
              Events
            </Link>
          </div>

          {/* Right side: logout */}
          {user && (
            <button
              onClick={() => signOut(auth)}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded transition"
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin-dashboard"
          element={!user ? (
            <LoginPage />
          ) : role === "admin" ? (
            <AdminDashboardPage />
          ) : (
            <UnauthorizedPage />
          )}
        />
        <Route path="/events" element={<EventsPage />} />
        <Route
          path="/scanner"
          element={
            role === "admin" || role === "semi-admin" ? (
              <ScannerPage />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route path="/attendance" element={<AttendanceBoardPage />} />
        <Route
          path="/events/:eventId/attendance"
          element={<AttendanceBoardPage />}
        />
        <Route path="/" element={<EventsPage />} />
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
