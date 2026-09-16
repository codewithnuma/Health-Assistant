"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import axiosInstance, { markLoggedOut, resetLogoutState } from "../axiosInstance";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedUser = useRef(false);

  // Fetch current logged-in user and normalize role to lowercase
  const fetchUser = async () => {
    try {
      const res = await axiosInstance.get("/accounts/me/");
      const rawRole = res.data.role || res.data.Role || "user";
      const normalizedUser = { ...res.data, role: rawRole.toString().toLowerCase() };
      setUser(normalizedUser);
      return normalizedUser;
    } catch (err) {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
      hasFetchedUser.current = true;
    }
  };

  // Always check auth on app load
  useEffect(() => {
    if (!hasFetchedUser.current) {
      fetchUser();
    }
  }, []);

  // LOGIN
  const login = async (email, password) => {
    try {
      resetLogoutState(); // Clear the lock out flag before attempting to log in
      await axiosInstance.post("/accounts/login/", { email, password });
      const loggedInUser = await fetchUser();
      return { success: true, user: loggedInUser };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || "Login failed" };
    }
  };

  // LOGOUT
  const logout = async () => {
    try {
      await axiosInstance.post("/accounts/logout/");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      markLoggedOut();
      setUser(null);
      hasFetchedUser.current = true;
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);