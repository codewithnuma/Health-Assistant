import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard,
  FileText, 
  Camera, 
  Calendar, 
  UserPlus, 
  ShoppingBag, 
  QrCode, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

export default function Sidebar({ user: propUser, onLogout: propOnLogout }) {
  const auth = useAuth?.() || {};
  const navigate = useNavigate();

  // Use props if passed, otherwise fall back to AuthContext, or mock user for preview
  const currentUser = propUser || auth.user || { name: 'Ram Bahadur', role: 'patient' };

  const handleLogout = async () => {
    if (propOnLogout) {
      propOnLogout();
      return;
    }
    if (auth.logout) {
      await auth.logout();
    }
    navigate('/login', { replace: true });
  };

  const displayName = currentUser.name || currentUser.username || currentUser.email || 'Patient User';
  const displayRole = currentUser.role ? `${currentUser.role} Account` : 'Patient Account';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className={styles.sidebar}>
      {/* Brand Header */}
      <div className={styles.header}>
        <div className={styles.logoMark}>H</div>
        <span className={styles.appName}>SwasthyaVault</span>
      </div>

      {/* Navigation Links */}
      <nav className={styles.nav}>
        <div className={styles.sectionTitle}>Main</div>
        <NavLink 
          to="/user-dashboard" 
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        {/* Module 1: Report Vault */}
        <div className={styles.sectionTitle}>Medical Records</div>
        <NavLink 
          to="/vault" 
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <FileText size={18} />
          <span>Report Vault</span>
        </NavLink>
        <NavLink 
          to="/upload" 
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <Camera size={18} />
          <span>Scan Report</span>
        </NavLink>

        {/* Module 2: Healthcare Services */}
        <div className={styles.sectionTitle}>Services</div>
        <NavLink 
          to="/appointments" 
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <Calendar size={18} />
          <span>Appointments</span>
        </NavLink>
        <NavLink 
          to="/nurse-dispatch" 
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <UserPlus size={18} />
          <span>Home Nursing</span>
        </NavLink>
        <NavLink 
          to="/pharmacy" 
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <ShoppingBag size={18} />
          <span>Pharmacy</span>
        </NavLink>
        <NavLink 
          to="/doctor-scanner" 
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <QrCode size={18} />
          <span>Doctor Portal</span>
        </NavLink>
      </nav>

      {/* User Footer */}
      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {initial}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.userName} title={displayName}>{displayName}</span>
            <span className={styles.userRole}>{displayRole}</span>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout} title="Logout" type="button">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

