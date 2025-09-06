import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

// Sync student across all upcoming/ongoing events
export async function syncStudentAcrossEvents(studentId, studentData, action = "add") {
  const eventsSnap = await getDocs(collection(db, "events"));

  for (const eventDoc of eventsSnap.docs) {
    const eventData = eventDoc.data();

    if (eventData.status === "upcoming" || eventData.status === "ongoing") {
      const attendanceRef = doc(db, "events", eventDoc.id, "attendance", studentId);

      if (action === "add") {
        // Add student with default slots
        const slotData = {};
        (eventData.slots || ["07AM", "12PM", "01PM", "05PM"]).forEach((slot) => {
          slotData[slot] = false;
        });

        await setDoc(attendanceRef, {
          studentId,
          ...studentData,
          ...slotData,
        });
      }

      if (action === "edit") {
        // Update only student details (keep slot values as is)
        await updateDoc(attendanceRef, {
          ...studentData,
        });
      }

      if (action === "delete") {
        await deleteDoc(attendanceRef);
      }
    }
  }
}
