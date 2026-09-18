import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function DashboardLayout({ user, onLogout }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9f9fb' }}>
      <Sidebar user={user} onLogout={onLogout} />
      <main style={{ marginLeft: '250px', flex: 1, minWidth: 0, padding: '24px' }}>
        <Outlet />
      </main>
    </div>
  );
}

