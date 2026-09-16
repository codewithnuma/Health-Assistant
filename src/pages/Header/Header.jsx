import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Header.css";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Determine user role
  const role = (
    user?.role ||
    user?.Role ||
    ""
  ).toLowerCase();

  const isOrganizer = [
    "organizer",
    "admin",
    "employee",
  ].includes(role);

  // Dashboard based on role
  const dashboardRoute = isOrganizer
    ? "/dashboard"
    : "/user-dashboard";

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className="gov-header">
      <div className="gov-header-container">

        {/* Brand / Logo */}
        <div className="gov-logo-block">
          <Link to="/" className="gov-logo-link">
            <span className="gov-logo-text">
              Nepal
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="gov-nav-links">
          <Link
            to="/public-reports"
            className="nav-item"
          >
            Public Reports
          </Link>

          <Link
            to={dashboardRoute}
            className="nav-item"
          >
            My Dashboard
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="gov-header-actions">

          <Link
            to="/profile"
            className="btn-header-action"
          >
            Profile
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="btn-header-action logout-btn"
          >
            Logout
          </button>

        </div>
      </div>
    </header>
  );
};

export default Header;
