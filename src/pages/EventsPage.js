import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";

function EventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // For new event form
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState("");

  // For listing events
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const slots = ["07AM", "12PM", "01PM", "05PM"];

  // Auth guard (store user state)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Subscribe to events list
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "events"),
      (snapshot) => {
        let list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        // sort by date descending
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

  // Create new event
  const createEvent = async () => {
    if (!eventName.trim() || !eventDate.trim()) {
      setStatus("⚠️ Please enter both date and name.");
      return;
    }

    const eventId = `${eventDate}_${eventName.replace(/\s+/g, "-").toLowerCase()}`;

    try {
      setStatus("⏳ Setting up event...");

      // Event metadata
      await setDoc(doc(db, "events", eventId), {
        name: eventName,
        date: eventDate,
        slots,
        createdBy: user?.uid || "system",
        createdAt: new Date(),
        status: "upcoming",
      });

      // Add baseline attendance
      const studentsSnap = await getDocs(collection(db, "students"));
      let total = 0;

      for (const studentDoc of studentsSnap.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;

        const attendanceRef = doc(
          db,
          "events",
          eventId,
          "attendance",
          studentId
        );

        const slotData = {};
        slots.forEach((slot) => {
          slotData[slot] = false;
        });

        await setDoc(attendanceRef, {
          studentId,
          ...studentData,
          ...slotData,
        });

        total++;
      }

      setStatus(`✅ Event "${eventName}" created with ${total} students.`);
      setEventName("");
      setEventDate("");
    } catch (error) {
      console.error("Error creating event:", error);
      setStatus("❌ Failed to create event.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Events</h2>

      {/* Admin-only event creation form */}
      {user && (
        <div style={{ marginBottom: "20px" }}>
          <h3>Create New Event</h3>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            style={{ marginRight: "10px", padding: "5px" }}
          />
          <input
            type="text"
            placeholder="Event Name"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            style={{ marginRight: "10px", padding: "5px" }}
          />
          <button onClick={createEvent}>Create Event</button>
          <p>{status}</p>
        </div>
      )}

      {/* Event list */}
      {loading ? (
        <p>Loading events...</p>
      ) : events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id} style={{ marginBottom: "10px" }}>
              <strong>{event.name}</strong> ({event.date})  
              <button
                style={{ marginLeft: "10px" }}
                onClick={() => navigate(`/events/${event.id}/attendance`)}
              >
                View Attendance
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default EventsPage;
