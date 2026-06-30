import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PurchaseRequest, RequestStatus, LineItem } from "../types";
import { Modal } from "../components/Modal";
import { LineItemsEditor } from "../components/LineItemsEditor";
import { StatusBadge, Spinner, money, fmtDate } from "../components/ui";

const STATUSES: RequestStatus[] = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "converted",
];

export default function Requests() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRequest | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [justification, setJustification] = useState("");
  const [status, setStatus] = useState<RequestStatus>("draft");
  const [neededBy, setNeededBy] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    setRequests(await api.get<PurchaseRequest[]>(`/requests?${params}`));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDepartment("");
    setJustification("");
    setStatus("draft");
    setNeededBy("");
    setItems([]);
    setError("");
    setModalOpen(true);
  }

  function openEdit(r: PurchaseRequest) {
    setEditing(r);
    setTitle(r.title);
    setDepartment(r.department ?? "");
    setJustification(r.justification ?? "");
    setStatus(r.status);
    setNeededBy(r.needed_by ?? "");
    setItems(r.items.map((i) => ({ ...i })));
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      title,
      department,
      justification,
      status,
      needed_by: neededBy || null,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit,
        unit_price: i.unit_price,
      })),
    };
    try {
      if (editing) await api.patch(`/requests/${editing.id}`, payload);
      else await api.post("/requests", payload);
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: PurchaseRequest) {
    if (!confirm(`Delete request "${r.title}"?`)) return;
    await api.del(`/requests/${r.id}`);
    load();
  }

  async function convert(r: PurchaseRequest) {
    if (!confirm(`Convert ${r.request_number} into a purchase order?`)) return;
    try {
      await api.post(`/requests/${r.id}/convert`);
      alert("Purchase order created. See the Purchase Orders page.");
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to convert");
    }
  }

  return (
    <>
      <div className="toolbar">
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
          + New Request
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request #</th>
                <th>Title</th>
                <th>Department</th>
                <th>Requester</th>
                <th>Status</th>
                <th>Est. Total</th>
                <th>Needed By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No purchase requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.request_number}</td>
                    <td>
                      <strong>{r.title}</strong>
                    </td>
                    <td>{r.department ?? "—"}</td>
                    <td>{r.requester_name ?? "—"}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{money(r.estimated_total)}</td>
                    <td>{fmtDate(r.needed_by)}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="icon-btn" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      {r.status === "approved" && (
                        <button className="icon-btn" onClick={() => convert(r)}>
                          → PO
                        </button>
                      )}
                      <button className="icon-btn" onClick={() => remove(r)}>
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
          title={editing ? `Edit ${editing.request_number}` : "New Purchase Request"}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn" onClick={save} disabled={saving || !title}>
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Department</label>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RequestStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Needed By</label>
            <input
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Justification</label>
            <textarea
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>
          <label>Line Items</label>
          <LineItemsEditor items={items} onChange={setItems} />
        </Modal>
      )}
    </>
  );
}
