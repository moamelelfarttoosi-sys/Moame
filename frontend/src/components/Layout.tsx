import { type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: "▦", end: true },
  { to: "/contracts", label: "Contracts", icon: "📄" },
  { to: "/requests", label: "Purchase Requests", icon: "📝" },
  { to: "/orders", label: "Purchase Orders", icon: "🛒" },
  { to: "/vendors", label: "Vendors", icon: "🏭" },
];

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/contracts": "Contracts",
  "/requests": "Purchase Requests",
  "/orders": "Purchase Orders",
  "/vendors": "Vendors",
  "/users": "User Management",
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "Moame";

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          Mo<span>ame</span>
          <small>Contracts & Procurement</small>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>
              <span className="icon">👤</span>
              Users
            </NavLink>
          )}
        </nav>
        <div className="user-box">
          <div className="name">{user?.full_name}</div>
          <div className="role">{user?.role}</div>
          <button className="logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{user?.email}</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
