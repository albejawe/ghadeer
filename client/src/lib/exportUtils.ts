export type ExportInvoice = {
  company: string;
  governorate: string;
  warehouse: string;
  number: string;
  createdAt: string;
  dueAt: string;
  amount: number;
  paid: number;
  remaining: number;
  status: string;
  note: string;
};

export const exportHeaders = [
  "الشركة", "المحافظة", "المذخر", "رقم الفاتورة", "تاريخ الإنشاء", "تاريخ الاستحقاق",
  "مبلغ الفاتورة", "المدفوع", "المتبقي", "حالة التسديد", "ملاحظة",
];

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildExcelHtml(rows: ExportInvoice[]) {
  const body = rows.map((invoice) => [
    invoice.company, invoice.governorate, invoice.warehouse, invoice.number, invoice.createdAt,
    invoice.dueAt, invoice.amount, invoice.paid, invoice.remaining, invoice.status, invoice.note,
  ]).map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;direction:rtl;font-family:Arial,sans-serif}th,td{border:1px solid #cbd5e1;padding:8px;text-align:right}th{background:#0f766e;color:#fff;font-weight:700}</style></head><body dir="rtl"><h2>تقرير الفواتير - حساباتي</h2><table><thead><tr>${exportHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function buildPrintTitle() {
  return "تقرير الفواتير - حساباتي";
}
