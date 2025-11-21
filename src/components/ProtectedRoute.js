import React from "react";
import { Navigate } from "react-router-dom";

// ProtectedRoute: Wrap route elements to enforce authentication and roles.
// Props:
// - user: firebase user object (null if not authenticated)
// - role: user's role string (e.g., 'admin')
// - requiredRoles: string or array of strings allowed to access the route
// - fallback: path to redirect unauthenticated users (default: /login)
export default function ProtectedRoute({
  user,
  role,
  requiredRoles,
  fallback = "/login",
  children,
}) {
  if (!user) {
    return <Navigate to={fallback} replace />;
  }

  if (requiredRoles) {
    const allowed = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];
    if (!allowed.includes(role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}
