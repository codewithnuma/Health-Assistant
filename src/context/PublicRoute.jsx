"use client";

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PublicRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  // Extract role checking both uppercase 'Role' and lowercase 'role'
  const role = (user?.Role || user?.role || "").toLowerCase();

  // Redirect authenticated users to their dashboard based on backend roles safely
  if (role === "admin" || role === "organizer" || role === "employee") {
    return <Navigate to="/dashboard" replace />;
  }

  if (role === "citizen" || role === "user") {
    return <Navigate to="/user-dashboard" replace />;
  }

  // Allow unauthenticated guests to view public routes
  return <Outlet />;
};

export default PublicRoute;