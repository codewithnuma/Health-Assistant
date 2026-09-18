
"use client";

import React from "react";
import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useAuth } from "./AuthContext";

const PublicRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // Not logged in → allow access to public pages
  if (!user) {
    return <Outlet />;
  }

  const role = (
    user.role ||
    user.Role ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  console.log(
    "PublicRoute detected role:",
    role
  );

  // Backend roles
  if (role === "admin" || role === "pharmacy") {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  if (role === "patient") {
    return (
      <Navigate
        to="/user-dashboard"
        replace
      />
    );
  }

  // Unknown role
  console.error(
    "PublicRoute received unknown role:",
    user
  );

  return <Outlet />;
};

export default PublicRoute;

