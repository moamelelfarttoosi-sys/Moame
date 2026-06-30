import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Vendor, VendorStatus } from "../types";
import { Modal } from "../components/Modal";
import { StatusBadge, Spinner, fmtDate } from "../components/ui";

const STATUSES: VendorStatus[] = ["active", "inactive", "blacklisted", "pending"];
const empty = {
  name: "",
  category: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  tax_id: "",
  status: "active" as VendorStatus,
  rating: "",
  notes: "",
};

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const data = await api.get<Vendor[]>(`/vendors?${params}`);
    setVendors(data);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ ...empty });
    setError("");
    setModalOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      name: v.name,
      category: v.category ?? "",
      contact_person: v.contact_person ?? "",
      email: v.email ?? "",
      phone: v.phone ?? "",
      address: v.address ?? "",
      tax_id: v.tax_id ?? "",
      status: v.status,
      rating: v.rating?.toString() ?? "",
      notes: v.notes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      rating: form.rating ? parseFloat(form.rating) : null,
    };
    try {
      if (editing) await api.patch(`/vendors/${editing.id}`, payload);
      else await api.post("/vendors", payload);
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(v: Vendor) {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;
    try {
      await api.del(`/vendors/${v.id}`);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search vendors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={openCreate}>
          + New Vendor
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Contracts</th>
                <th>POs</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty">
                    No vendors found.
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v.id}>
                    <td>{v.code}</td>
                    <td>
                      <strong>{v.name}</strong>
                    </td>
                    <td>{v.category ?? "—"}</td>
                    <td>
                      {v.contact_person ?? "—"}
                      {v.email && (
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>
                          {v.email}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>{v.rating != null ? `★ ${v.rating.toFixed(1)}` : "—"}</td>
                    <td>{v.contract_count}</td>
                    <td>{v.po_count}</td>
                    <td>{fmtDate(v.created_at)}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="icon-btn" onClick={() => openEdit(v)}>
                        Edit
                      </button>
                      <button className="icon-btn" onClick={() => remove(v)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editing ? `Edit ${editing.code}` : "New Vendor"}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn" onClick={save} disabled={saving || !form.name}>
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label>Name *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Category</label>
              <input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Contact Person</label>
              <input
                value={form.contact_person}
                onChange={(e) => set("contact_person", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Rating (0–5)</label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={form.rating}
                onChange={(e) => set("rating", e.target.value)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Email</label>
              <input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Tax ID</label>
            <input value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
          </div>
          <div className="field">
            <label>Address</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
