export type InvoiceStatus = "مسدد" | "جزئي" | "غير مسدد";

export type Invoice = {
  id: string;
  company: string;
  governorate: string;
  warehouse: string;
  number: string;
  createdAt: string;
  dueAt: string;
  amount: number;
  paid: number;
  remaining: number;
  status: InvoiceStatus;
  note: string;
};

export type SharedLink = {
  id: string;
  name: string;
  filters: Record<string, string>;
  active: boolean;
  createdAt?: string;
};

export type SortKey = "company" | "warehouse" | "number" | "createdAt" | "dueAt" | "amount" | "remaining" | "status";

export type SortState = { key: SortKey; dir: "asc" | "desc" };

export const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) + " د.ع";

export const STATUS_LABELS: InvoiceStatus[] = ["مسدد", "جزئي", "غير مسدد"];

export const statusChipClass: Record<InvoiceStatus, string> = {
  مسدد: "status-chip status-paid",
  جزئي: "status-chip status-partial",
  "غير مسدد": "status-chip status-unpaid",
};