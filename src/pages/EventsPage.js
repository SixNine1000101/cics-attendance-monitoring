import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";

function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "events"),
      (snapshot) => {
        let list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
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

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">Events</h2>

      {loading ? (
        <p className="text-gray-500 text-center">Loading events...</p>
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
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-lg font-semibold text-gray-800">{event.name}</span>
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
              <button
                className="mt-2 bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700 transition"
                onClick={() => navigate(`/events/${event.id}/attendance`)}
              >
                View Attendance
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventsPage;
