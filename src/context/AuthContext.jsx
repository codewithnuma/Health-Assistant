
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";

import axiosInstance, {
  markLoggedOut,
  resetLogoutState,
} from "../axiosInstance";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const hasFetchedUser = useRef(false);

  // ==========================================
  // GET CURRENT USER
  // ==========================================
  const fetchUser = async () => {
    try {
      console.log("Fetching current user...");

      const response = await axiosInstance.get(
        "/accounts/me/"
      );

      console.log("ME RESPONSE:", response.data);

      const rawRole =
        response.data?.role ||
        response.data?.Role ||
        "";

      const normalizedUser = {
        ...response.data,
        role: rawRole
          .toString()
          .trim()
          .toLowerCase(),
      };

      console.log(
        "NORMALIZED USER:",
        normalizedUser
      );

      setUser(normalizedUser);

      return normalizedUser;
    } catch (error) {
      console.error(
        "FETCH USER ERROR:",
        error.response?.status,
        error.response?.data || error.message
      );

      setUser(null);

      return null;
    } finally {
      setLoading(false);
      hasFetchedUser.current = true;
    }
  };

  // ==========================================
  // INITIAL AUTH CHECK
  // ==========================================
  useEffect(() => {
    if (!hasFetchedUser.current) {
      fetchUser();
    }
  }, []);

  // ==========================================
  // LOGIN
  // ==========================================
  const login = async (email, password) => {
    try {
      console.log("Attempting login:", email);

      resetLogoutState();

      const response = await axiosInstance.post(
        "/accounts/login/",
        {
          email,
          password,
        }
      );

      console.log(
        "LOGIN API RESPONSE:",
        response.data
      );

      // IMPORTANT:
      // Backend puts JWT into HttpOnly cookies.
      // We then ask /me/ who logged in.
      const loggedInUser = await fetchUser();

      if (!loggedInUser) {
        return {
          success: false,
          error:
            "Login succeeded, but the server did not return the current user.",
        };
      }

      return {
        success: true,
        user: loggedInUser,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "LOGIN API ERROR:",
        error.response?.status,
        error.response?.data || error.message
      );

      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          "Login failed",
      };
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================
  const logout = async () => {
    try {
      await axiosInstance.post(
        "/accounts/logout/"
      );
    } catch (error) {
      console.error(
        "Logout error:",
        error.response?.data || error.message
      );
    } finally {
      markLoggedOut();

      setUser(null);

      hasFetchedUser.current = true;

      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
};

