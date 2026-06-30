export type Role = "admin" | "manager" | "staff";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  department?: string | null;
  is_active: boolean;
}

export type VendorStatus = "active" | "inactive" | "blacklisted" | "pending";

export interface Vendor {
  id: number;
  code: string;
  name: string;
  category?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  status: VendorStatus;
  rating?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  contract_count: number;
  po_count: number;
}

export type ContractStatus =
  | "draft"
  | "active"
  | "expired"
  | "terminated"
  | "renewed"
  | "pending_approval";

export type ContractType =
  | "service"
  | "supply"
  | "lease"
  | "consulting"
  | "maintenance"
  | "framework"
  | "other";

export interface Contract {
  id: number;
  contract_number: string;
  title: string;
  type: ContractType;
  status: ContractStatus;
  description?: string | null;
  value: number;
  currency: string;
  payment_terms?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  renewal_date?: string | null;
  auto_renew: boolean;
  vendor_id?: number | null;
  owner_id?: number | null;
  vendor_name?: string | null;
  owner_name?: string | null;
  days_to_expiry?: number | null;
  created_at: string;
  updated_at: string;
}

export type RequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "converted";

export interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  received_quantity?: number;
  line_total?: number;
}

export interface PurchaseRequest {
  id: number;
  request_number: string;
  title: string;
  department?: string | null;
  justification?: string | null;
  status: RequestStatus;
  needed_by?: string | null;
  requester_id?: number | null;
  requester_name?: string | null;
  estimated_total: number;
  items: LineItem[];
  created_at: string;
}

export type OrderStatus =
  | "draft"
  | "issued"
  | "partially_received"
  | "received"
  | "cancelled";

export interface PurchaseOrder {
  id: number;
  po_number: string;
  status: OrderStatus;
  currency: string;
  notes?: string | null;
  order_date?: string | null;
  expected_date?: string | null;
  vendor_id?: number | null;
  contract_id?: number | null;
  request_id?: number | null;
  vendor_name?: string | null;
  total_amount: number;
  received_pct: number;
  items: LineItem[];
  created_at: string;
}

export interface DashboardSummary {
  vendors: { total: number; active: number };
  contracts: {
    total: number;
    active: number;
    expiring_soon: number;
    total_value: number;
  };
  requests: { total: number; pending: number };
  orders: { total: number; open: number; total_spend: number };
}
