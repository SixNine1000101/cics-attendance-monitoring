import { useEffect, useState } from "react";
import { auth } from "../firebase";

// useAuth: returns { user, role, loading }
// - subscribes to Firebase auth state and extracts custom claim `role` from id token
export default function useAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const token = await u.getIdTokenResult();
          setRole(token.claims.role || null);
        } catch (err) {
          console.error("Failed to get id token result:", err);
          setRole(null);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, role, loading };
}
