
"use client";

import React from "react";
import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useAuth } from "./AuthContext";

const ProtectedRoute = ({
  allowedRoles = [],
}) => {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // Not authenticated
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const userRole = (
    user.role ||
    user.Role ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  const normalizedAllowedRoles =
    allowedRoles.map((role) =>
      role.toString().trim().toLowerCase()
    );

  console.log(
    "ProtectedRoute:",
    {
      userRole,
      allowedRoles:
        normalizedAllowedRoles,
    }
  );

  // Role not permitted
  if (
    normalizedAllowedRoles.length > 0 &&
    !normalizedAllowedRoles.includes(userRole)
  ) {
    console.error(
      `Role "${userRole}" is not allowed on this route.`
    );

    return (
      <Navigate
        to="/unauthorized"
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
