import { useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  Contract,
  ContractStatus,
  ContractType,
  Vendor,
  User,
} from "../types";
import { Modal } from "../components/Modal";
import { StatusBadge, Spinner, money, fmtDate } from "../components/ui";

const STATUSES: ContractStatus[] = [
  "draft",
  "pending_approval",
  "active",
  "renewed",
  "expired",
  "terminated",
];
const TYPES: ContractType[] = [
  "service",
  "supply",
  "lease",
  "consulting",
  "maintenance",
  "framework",
  "other",
];

const empty = {
  title: "",
  type: "service" as ContractType,
  status: "draft" as ContractStatus,
  description: "",
  value: "",
  currency: "USD",
  payment_terms: "",
  start_date: "",
  end_date: "",
  renewal_date: "",
  auto_renew: false,
  vendor_id: "",
  owner_id: "",
};

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const data = await api.get<Contract[]>(`/contracts?${params}`);
    setContracts(data);
    setLoading(false);
  }

  useEffect(() => {
    api.get<Vendor[]>("/vendors").then(setVendors);
    api.get<User[]>("/users").then(setUsers);
  }, []);

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

  function openEdit(c: Contract) {
    setEditing(c);
    setForm({
      title: c.title,
      type: c.type,
      status: c.status,
      description: c.description ?? "",
      value: c.value?.toString() ?? "",
      currency: c.currency,
      payment_terms: c.payment_terms ?? "",
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      renewal_date: c.renewal_date ?? "",
      auto_renew: c.auto_renew,
      vendor_id: c.vendor_id?.toString() ?? "",
      owner_id: c.owner_id?.toString() ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      value: form.value ? parseFloat(form.value) : 0,
      vendor_id: form.vendor_id ? parseInt(form.vendor_id) : null,
      owner_id: form.owner_id ? parseInt(form.owner_id) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      renewal_date: form.renewal_date || null,
    };
    try {
      if (editing) await api.patch(`/contracts/${editing.id}`, payload);
      else await api.post("/contracts", payload);
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Contract) {
    if (!confirm(`Delete contract "${c.title}"?`)) return;
    await api.del(`/contracts/${c.id}`);
    load();
  }

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search contracts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={openCreate}>
          + New Contract
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contract #</th>
                <th>Title</th>
                <th>Vendor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Value</th>
                <th>End Date</th>
                <th>Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    No contracts found.
                  </td>
                </tr>
              ) : (
                contracts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.contract_number}</td>
                    <td>
                      <strong>{c.title}</strong>
                    </td>
                    <td>{c.vendor_name ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{c.type}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>{money(c.value, c.currency)}</td>
                    <td>{fmtDate(c.end_date)}</td>
                    <td>
                      {c.days_to_expiry == null ? (
                        "—"
                      ) : c.days_to_expiry < 0 ? (
                        <span className="badge red">expired</span>
                      ) : c.days_to_expiry <= 30 ? (
                        <span className="badge amber">{c.days_to_expiry}d</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>
                          {c.days_to_expiry}d
                        </span>
                      )}
                    </td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="icon-btn" onClick={() => openEdit(c)}>
                        Edit
                      </button>
                      <button className="icon-btn" onClick={() => remove(c)}>
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
          title={editing ? `Edit ${editing.contract_number}` : "New Contract"}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={save}
                disabled={saving || !form.title}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label>Title *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Vendor</label>
              <select
                value={form.vendor_id}
                onChange={(e) => set("vendor_id", e.target.value)}
              >
                <option value="">— none —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Owner</label>
              <select
                value={form.owner_id}
                onChange={(e) => set("owner_id", e.target.value)}
              >
                <option value="">— none —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Value</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Currency</label>
              <input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </div>
            <div className="field">
              <label>End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Renewal Date</label>
              <input
                type="date"
                value={form.renewal_date}
                onChange={(e) => set("renewal_date", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Payment Terms</label>
              <input
                value={form.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)}
              />
            </div>
          </div>
          <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={form.auto_renew}
              onChange={(e) => set("auto_renew", e.target.checked)}
            />
            <label style={{ margin: 0 }}>Auto-renew at end of term</label>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
