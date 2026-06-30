import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { api } from "../api/client";
import type { DashboardSummary } from "../types";
import { StatCard, Spinner, money, fmtDate, StatusBadge } from "../components/ui";

interface StatusSlice {
  status: string;
  count: number;
}
interface VendorSpend {
  vendor: string;
  spend: number;
}
interface ExpiringContract {
  id: number;
  contract_number: string;
  title: string;
  end_date: string | null;
  days_to_expiry: number | null;
  vendor_name: string | null;
  value: number;
}

const PIE_COLORS = ["#2f5bea", "#1f9d57", "#d98a00", "#d23f3f", "#8b5cf6", "#06b6d4"];

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [byStatus, setByStatus] = useState<StatusSlice[]>([]);
  const [spend, setSpend] = useState<VendorSpend[]>([]);
  const [expiring, setExpiring] = useState<ExpiringContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardSummary>("/dashboard/summary"),
      api.get<StatusSlice[]>("/dashboard/contracts-by-status"),
      api.get<VendorSpend[]>("/dashboard/spend-by-vendor"),
      api.get<ExpiringContract[]>("/dashboard/expiring-contracts?days=60"),
    ])
      .then(([s, st, sp, ex]) => {
        setSummary(s);
        setByStatus(st);
        setSpend(sp);
        setExpiring(ex);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !summary) return <Spinner />;

  return (
    <>
      <div className="grid cols-4">
        <StatCard
          label="Active Contracts"
          value={summary.contracts.active}
          sub={`${summary.contracts.total} total · ${money(summary.contracts.total_value)} value`}
          color="#2f5bea"
        />
        <StatCard
          label="Expiring (30 days)"
          value={summary.contracts.expiring_soon}
          sub="Contracts needing renewal"
          color="#d98a00"
        />
        <StatCard
          label="Open Purchase Orders"
          value={summary.orders.open}
          sub={`${money(summary.orders.total_spend)} total spend`}
          color="#1f9d57"
        />
        <StatCard
          label="Pending Requests"
          value={summary.requests.pending}
          sub={`${summary.vendors.active} active vendors`}
          color="#8b5cf6"
        />
      </div>

      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>Top Vendor Spend</h3>
          {spend.length === 0 ? (
            <div className="empty">No purchase orders yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={spend} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="vendor"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="spend" fill="#2f5bea" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3>Contracts by Status</h3>
          {byStatus.length === 0 ? (
            <div className="empty">No contracts yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={(e) => `${e.status} (${e.count})`}
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <h2 className="section-title">Contracts Expiring Soon (next 60 days)</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contract #</th>
              <th>Title</th>
              <th>Vendor</th>
              <th>End Date</th>
              <th>Days Left</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {expiring.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  No contracts expiring in the next 60 days. 🎉
                </td>
              </tr>
            ) : (
              expiring.map((c) => (
                <tr key={c.id}>
                  <td>{c.contract_number}</td>
                  <td>{c.title}</td>
                  <td>{c.vendor_name ?? "—"}</td>
                  <td>{fmtDate(c.end_date)}</td>
                  <td>
                    <StatusBadge
                      status={
                        (c.days_to_expiry ?? 99) <= 14 ? "expired" : "pending"
                      }
                    />{" "}
                    {c.days_to_expiry} days
                  </td>
                  <td>{money(c.value)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
