import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { 
  Calendar, 
  UserPlus, 
  QrCode 
} from "lucide-react";

import ProtectedRoute from "./context/ProtectedRoute";
import PublicRoute from "./context/PublicRoute";

import Login from "./pages/Login/Login";
import Register from "./pages/Registration/Register";
import ForgetPassword from "./pages/ForgotPassword/ForgotPassword";

import UserDashboard from "./User/Dashboard";
import OrganizerReports from "./pages/Reports/Reports";
import Chatbot from "./chatbot/Chatbot";
import DashboardLayout from "./components/DashboardLayout";
import ModulePlaceholder from "./pages/Placeholder/ModulePlaceholder";
import CameraCapturePage from "./pages/CameraCapture/CameraCapturePage";
import MedicineDashboard from "./pages/Pharmacy/MedicineDashboard";
import ReportVaultPage from "./pages/ReportVault/ReportVaultPage";

function Unauthorized() {
  return (
    <div
      style={{
        padding: "40px",
        textAlign: "center",
      }}
    >
      <h1>Unauthorized</h1>

      <p>
        You do not have permission to access
        this page.
      </p>

      <a href="/login">
        Back to Login
      </a>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* ==========================================
          CHATBOT WRAPPER (Available across app)
      ========================================== */}
      <Route element={<Chatbot />}>

        {/* ========================================
            PUBLIC AUTH ROUTES (No Sidebar)
        ======================================== */}
        <Route element={<PublicRoute />}>
          <Route
            path="/login"
            element={<Login />}
          />
          <Route
            path="/signup"
            element={<Register />}
          />
          <Route
            path="/forgot-password"
            element={<ForgetPassword />}
          />
        </Route>

        {/* ========================================
            DASHBOARD & HEALTHCARE MODULES (With Sidebar)
        ======================================== */}
        <Route element={<DashboardLayout />}>
          {/* Module: Camera Scanner & Upload */}
          <Route
            path="/upload"
            element={<CameraCapturePage />}
          />

          {/* Module 1: Medical Records */}
          <Route
            path="/vault"
            element={<ReportVaultPage />}
          />

          {/* Module 2: Healthcare Services */}
          <Route
            path="/appointments"
            element={
              <ModulePlaceholder
                title="Doctor Appointments"
                description="Book and manage consultations with verified doctors and specialists."
                icon={Calendar}
              />
            }
          />
          <Route
            path="/nurse-dispatch"
            element={
              <ModulePlaceholder
                title="Home Nursing Service"
                description="Request certified home nurse visits for vitals, wound care, or injections."
                icon={UserPlus}
              />
            }
          />
          <Route
            path="/pharmacy"
            element={<MedicineDashboard />}
          />
          <Route
            path="/doctor-scanner"
            element={
              <ModulePlaceholder
                title="Doctor Portal QR Scanner"
                description="Scan patient QR codes for fast, consent-driven medical history access."
                icon={QrCode}
              />
            }
          />

          {/* Patient Dashboard */}
          <Route
            path="/user-dashboard"
            element={<UserDashboard />}
          />
        </Route>

        {/* ========================================
            ADMIN + PHARMACY DASHBOARD
        ======================================== */}
        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
                "pharmacy",
              ]}
            />
          }
        >
          <Route
            path="/dashboard"
            element={<OrganizerReports />}
          />
        </Route>

        {/* ========================================
            UNAUTHORIZED
        ======================================== */}
        <Route
          path="/unauthorized"
          element={<Unauthorized />}
        />

      </Route>

      {/* ==========================================
          ROOT & FALLBACK
      ========================================== */}
      <Route
        path="/"
        element={
          <Navigate
            to="/upload"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/upload"
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
