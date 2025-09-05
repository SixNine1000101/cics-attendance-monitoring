import React, { useState } from "react";
import { signInWithEmailAndPassword, getAuth, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        const token = await user.getIdTokenResult();
        const role = token.claims.role || null;
        console.log("Role:", role);

        if (role === "admin") {
          navigate("/admin-dashboard");
        } else {
          navigate("/events"); // fallback
        }
      }
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  // const handleResetPassword = () => {
  //   if (!email) {
  //     alert("Please enter your email first.");
  //     return;
  //   }
  //   const authInstance = getAuth();
  //   sendPasswordResetEmail(authInstance, email)
  //     .then(() => {
  //       alert("Password reset email sent!");
  //     })
  //     .catch((error) => {
  //       console.error("Error sending reset email:", error);
  //       alert("Failed to send reset email. Please check the email address.");
  //     });
  // };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Admin Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Forgot Password Link */}
          {/* <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={handleResetPassword}
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot Password?
            </button>
          </div> */}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors font-semibold"
          >
            Login
          </button>
        </form>

        {error && <p className="mt-4 text-red-600 text-center">{error}</p>}
      </div>
    </div>
  );
}

export default LoginPage;