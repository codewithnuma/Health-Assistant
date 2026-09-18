import { NavLink, useNavigate } from "react-router-dom";
import {
  Calendar,
  Camera,
  FileText,
  LayoutDashboard,
  LogOut,
  QrCode,
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const links = [
  ["/user-dashboard", LayoutDashboard, "Dashboard"],
  ["/vault", FileText, "Report Vault"],
  ["/upload", Camera, "Scan Report"],
  ["/appointments", Calendar, "Appointments"],
  ["/nurse-dispatch", UserPlus, "Home Nursing"],
  ["/pharmacy", ShoppingBag, "Pharmacy"],
  ["/doctor-scanner", QrCode, "Doctor Portal"],
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.name || user?.username || user?.email || "Patient User";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <span className="app-sidebar__logo">H</span>
        <strong>SwasthyaVault</strong>
      </div>
      <nav className="app-sidebar__nav" aria-label="Main navigation">
        {links.map(([to, Icon, label]) => (
          <NavLink
            className={({ isActive }) => isActive ? "app-sidebar__link is-active" : "app-sidebar__link"}
            key={to}
            to={to}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="app-sidebar__footer">
        <span title={displayName}>{displayName}</span>
        <button type="button" onClick={handleLogout} title="Log out" aria-label="Log out">
          <LogOut size={17} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}