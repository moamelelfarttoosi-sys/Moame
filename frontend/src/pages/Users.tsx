import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { User, Role } from "../types";
import { Modal } from "../components/Modal";
import { StatusBadge, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const ROLES: Role[] = ["admin", "manager", "staff"];

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");

  async function load() {
    setLoading(true);
    setUsers(await api.get<User[]>("/users"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setFullName("");
    setEmail("");
    setRole("staff");
    setDepartment("");
    setPassword("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setRole(u.role);
    setDepartment(u.department ?? "");
    setPassword("");
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          full_name: fullName,
          role,
          department,
        };
        if (password) payload.password = password;
        await api.patch(`/users/${editing.id}`, payload);
      } else {
        await api.post("/users", {
          full_name: fullName,
          email,
          role,
          department,
          password,
        });
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
    load();
  }

  async function remove(u: User) {
    if (!confirm(`Delete user "${u.full_name}"?`)) return;
    try {
      await api.del(`/users/${u.id}`);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <>
      <div className="toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={openCreate}>
          + New User
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.full_name}</strong>
                    {u.id === me?.id && (
                      <span style={{ color: "var(--muted)" }}> (you)</span>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge blue">{u.role}</span>
                  </td>
                  <td>{u.department ?? "—"}</td>
                  <td>
                    <StatusBadge status={u.is_active ? "active" : "inactive"} />
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="icon-btn" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    {u.id !== me?.id && (
                      <>
                        <button className="icon-btn" onClick={() => toggleActive(u)}>
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                        <button className="icon-btn" onClick={() => remove(u)}>
                          🗑
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editing ? `Edit ${editing.full_name}` : "New User"}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={save}
                disabled={
                  saving ||
                  !fullName ||
                  (!editing && (!email || !password))
                }
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label>Full Name *</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label>Email *</label>
            <input
              type="email"
              value={email}
              disabled={!!editing}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Department</label>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>{editing ? "New Password (leave blank to keep)" : "Password *"}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
