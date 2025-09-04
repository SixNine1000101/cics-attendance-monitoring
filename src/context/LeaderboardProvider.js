// LeaderboardProvider.js
import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

const LeaderboardContext = createContext();

export function LeaderboardProvider({ children, eventId }) {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const ref = collection(db, "events", eventId, "attendance");
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(data);
    });
    return () => unsubscribe();
  }, [eventId]);

  return (
    <LeaderboardContext.Provider value={leaderboard}>
      {children}
    </LeaderboardContext.Provider>
  );
}

export function useLeaderboard() {
  return useContext(LeaderboardContext);
}
