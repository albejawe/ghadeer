export type InvoiceRecord = {
  id: string; company: string; governorate: string; warehouse: string; number: string;
  createdAt: string; dueAt: string; amount: number; paid: number; remaining: number;
  status: "مسدد" | "جزئي" | "غير مسدد"; note?: string;
};

export type InvoiceFilters = {
  company?: string; governorate?: string; warehouse?: string; status?: string; number?: string; quick?: string;
  dueFrom?: string; dueTo?: string; amountMin?: string | number; amountMax?: string | number;
};

export function normalizeSelectOptions(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
}

export function applyInvoiceFilters<T extends InvoiceRecord>(records: T[], filters: InvoiceFilters, today = new Date()): T[] {
  const dueFromMs = filters.dueFrom ? new Date(`${filters.dueFrom}T00:00:00`).getTime() : null;
  const dueToMs = filters.dueTo ? new Date(`${filters.dueTo}T23:59:59.999`).getTime() : null;
  const amountMin = filters.amountMin === undefined || filters.amountMin === "" ? null : Number(filters.amountMin);
  const amountMax = filters.amountMax === undefined || filters.amountMax === "" ? null : Number(filters.amountMax);
  return records.filter((item) => {
    const overdue = new Date(item.dueAt) <= today && item.remaining > 0;
    const dueMs = new Date(item.dueAt).getTime();
    return (!filters.company || filters.company === "الكل" || item.company === filters.company)
      && (!filters.governorate || filters.governorate === "الكل" || item.governorate === filters.governorate)
      && (!filters.warehouse || filters.warehouse === "الكل" || item.warehouse === filters.warehouse)
      && (!filters.status || filters.status === "الكل" || item.status === filters.status)
      && (!filters.number || item.number.includes(filters.number))
      && (!filters.quick || filters.quick === "الكل" || (filters.quick === "المستحق الآن" ? overdue : item.status === filters.quick))
      && (dueFromMs === null || dueMs >= dueFromMs)
      && (dueToMs === null || dueMs <= dueToMs)
      && (amountMin === null || item.amount >= amountMin)
      && (amountMax === null || item.amount <= amountMax);
  });
}

export function calculateInvoiceStats(records: InvoiceRecord[], today = new Date()) {
  const overdue = records.filter((item) => new Date(item.dueAt) <= today && item.remaining > 0);
  return {
    invoiceCount: records.length,
    totalAmount: records.reduce((sum, item) => sum + item.amount, 0),
    totalPaid: records.reduce((sum, item) => sum + item.paid, 0),
    totalRemaining: records.reduce((sum, item) => sum + item.remaining, 0),
    overdueDebt: overdue.reduce((sum, item) => sum + item.remaining, 0),
    notYetDue: records.filter((item) => new Date(item.dueAt) > today && item.remaining > 0).reduce((sum, item) => sum + item.remaining, 0),
    paidCount: records.filter((item) => item.status === "مسدد").length,
    partialCount: records.filter((item) => item.status === "جزئي").length,
    unpaidCount: records.filter((item) => item.status === "غير مسدد").length,
    overdueCount: overdue.length,
  };
}

export function deriveSheetFields(amount: number, paid: number, createdAt: string) {
  const dueAt = new Date(new Date(createdAt).getTime() + 60 * 86400000).toISOString().slice(0, 10);
  const remaining = amount - paid;
  const status = paid >= amount ? "مسدد" : paid > 0 ? "جزئي" : "غير مسدد";
  return { dueAt, remaining, status } as const;
}

export function isNewSyncEvent(eventId: string, seen: Set<string>) {
  if (seen.has(eventId)) return false;
  seen.add(eventId);
  return true;
}
