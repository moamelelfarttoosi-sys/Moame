import { useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  PurchaseOrder,
  OrderStatus,
  LineItem,
  Vendor,
  Contract,
} from "../types";
import { Modal } from "../components/Modal";
import { LineItemsEditor } from "../components/LineItemsEditor";
import { StatusBadge, Spinner, money, fmtDate } from "../components/ui";

const STATUSES: OrderStatus[] = [
  "draft",
  "issued",
  "partially_received",
  "received",
  "cancelled",
];

export default function Orders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<OrderStatus>("draft");
  const [vendorId, setVendorId] = useState("");
  const [contractId, setContractId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    setOrders(await api.get<PurchaseOrder[]>(`/orders?${params}`));
    setLoading(false);
  }

  useEffect(() => {
    api.get<Vendor[]>("/vendors").then(setVendors);
    api.get<Contract[]>("/contracts").then(setContracts);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openCreate() {
    setEditing(null);
    setStatus("draft");
    setVendorId("");
    setContractId("");
    setOrderDate("");
    setExpectedDate("");
    setNotes("");
    setItems([]);
    setError("");
    setModalOpen(true);
  }

  function openEdit(o: PurchaseOrder) {
    setEditing(o);
    setStatus(o.status);
    setVendorId(o.vendor_id?.toString() ?? "");
    setContractId(o.contract_id?.toString() ?? "");
    setOrderDate(o.order_date ?? "");
    setExpectedDate(o.expected_date ?? "");
    setNotes(o.notes ?? "");
    setItems(o.items.map((i) => ({ ...i })));
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      status,
      vendor_id: vendorId ? parseInt(vendorId) : null,
      contract_id: contractId ? parseInt(contractId) : null,
      order_date: orderDate || null,
      expected_date: expectedDate || null,
      notes,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit,
        unit_price: i.unit_price,
        received_quantity: i.received_quantity ?? 0,
      })),
    };
    try {
      if (editing) await api.patch(`/orders/${editing.id}`, payload);
      else await api.post("/orders", payload);
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(o: PurchaseOrder) {
    if (!confirm(`Delete purchase order ${o.po_number}?`)) return;
    await api.del(`/orders/${o.id}`);
    load();
  }

  return (
    <>
      <div className="toolbar">
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
          + New Purchase Order
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO #</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Total</th>
                <th>Received</th>
                <th>Order Date</th>
                <th>Expected</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.po_number}</td>
                    <td>{o.vendor_name ?? "—"}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{money(o.total_amount, o.currency)}</td>
                    <td>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <div className="progress">
                          <div style={{ width: `${o.received_pct}%` }} />
                        </div>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {o.received_pct}%
                        </span>
                      </div>
                    </td>
                    <td>{fmtDate(o.order_date)}</td>
                    <td>{fmtDate(o.expected_date)}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="icon-btn" onClick={() => openEdit(o)}>
                        Edit
                      </button>
                      <button className="icon-btn" onClick={() => remove(o)}>
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
          title={editing ? `Edit ${editing.po_number}` : "New Purchase Order"}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          {error && <div className="error-text">{error}</div>}
          <div className="field-row">
            <div className="field">
              <label>Vendor</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">— none —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Linked Contract</label>
              <select
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
              >
                <option value="">— none —</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_number} — {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Expected Delivery</label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <label>Line Items</label>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 0 }}>
            Set the received quantity to track deliveries; status updates
            automatically when the order is issued.
          </p>
          <LineItemsEditor items={items} onChange={setItems} showReceived />
        </Modal>
      )}
    </>
  );
}
