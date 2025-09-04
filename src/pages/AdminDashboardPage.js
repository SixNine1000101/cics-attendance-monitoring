import React, {useEffect} from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

function AdminDashboardPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

   useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Admin Dashboard</h2>
      <p>Welcome, Admin! Choose an action:</p>
      
      <div>
        <button onClick={() => navigate("/event-setup")}>
          ➕ Create Event
        </button>
        <button onClick={() => navigate("/students")}>
          👨‍🎓 Manage Students
        </button>
        <button onClick={() => navigate("/scanner")}>
          📷 Open Scanner
        </button>
        <button onClick={handleLogout}>🚪 Logout</button>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
