import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBK4_V4EUwa36R7pDtahU6cAiQHvmwRLb4",
  authDomain: "cics-attendance-monitoring.firebaseapp.com",
  projectId: "cics-attendance-monitoring",
  storageBucket: "cics-attendance-monitoring.firebasestorage.app",
  messagingSenderId: "798555421834",
  appId: "1:798555421834:web:29a6b300b85b5edb414173",
  measurementId: "G-8WB7C52F3F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
