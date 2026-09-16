import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./context/ProtectedRoute";
import PublicRoute from "./context/PublicRoute";

import Login from "./pages/Login/Login";
import Register from "./pages/Registration/Register";
import UserDashboard from "./User/Dashboard";
import OrganizerReports from "./pages/Reports/Reports";
import ForgetPassword from "./pages/ForgotPassword/ForgotPassword";

import Chatbot from "./chatbot/Chatbot";

function App() {
  return (
    <Routes>

      {/* ================================================= */}
      {/* CHATBOT LAYOUT */}
      {/* ================================================= */}

      <Route element={<Chatbot />}>

        {/* ================= PUBLIC ROUTES ================= */}

        <Route element={<PublicRoute />}>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/Signup"
            element={<Register />}
          />

          <Route
            path="/forgot-password"
            element={<ForgetPassword />}
          />
        </Route>

        {/* ================= CITIZEN ================= */}

        <Route
          element={
            <ProtectedRoute allowedRoles={["citizen"]} />
          }
        >
          <Route
            path="/user-dashboard"
            element={<UserDashboard />}
          />
        </Route>

        {/* ================= ORGANIZER ================= */}

        <Route
          element={
            <ProtectedRoute allowedRoles={["organizer"]} />
          }
        >
          <Route
            path="/dashboard"
            element={<OrganizerReports />}
          />
        </Route>

      </Route>

      {/* ================= DEFAULT ================= */}

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      {/* ================= UNKNOWN ================= */}

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

    </Routes>
  );
}

export default App;
