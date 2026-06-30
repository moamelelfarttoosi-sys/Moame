import type { ReactNode } from "react";

const STATUS_COLORS: Record<string, string> = {
  active: "green",
  approved: "green",
  received: "green",
  draft: "gray",
  inactive: "gray",
  cancelled: "gray",
  rejected: "red",
  blacklisted: "red",
  expired: "red",
  terminated: "red",
  pending: "amber",
  pending_approval: "amber",
  submitted: "amber",
  partially_received: "amber",
  issued: "blue",
  renewed: "blue",
  converted: "blue",
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "gray";
  return <span className={`badge ${color}`}>{status.replace(/_/g, " ")}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  color = "var(--primary)",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
}) {
  return (
    <div className="card stat">
      <div className="accent" style={{ background: color }} />
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner">Loading…</div>;
}

export function Empty({ message }: { message: string }) {
  return <div className="empty">{message}</div>;
}

export function money(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
