import { applyInvoiceFilters } from "@shared/invoiceLogic";
import type { Invoice, SharedLink } from "@/components/dashboard/types";

const INVOICES_KEY = "hisabati:wallet:invoices";
const LINKS_KEY = "hisabati:wallet:links";

function read<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: unknown[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // private mode / storage full — ignore
  }
}

export const loadLocalInvoices = (): Invoice[] => read<Invoice>(INVOICES_KEY);

export const saveLocalInvoices = (list: Invoice[]) => write(INVOICES_KEY, list);

export const loadLocalLinks = (): SharedLink[] => read<SharedLink>(LINKS_KEY);

export const saveLocalLinks = (list: SharedLink[]) => write(LINKS_KEY, list);

export function findLocalLink(id: string): SharedLink | null {
  const link = loadLocalLinks().find((item) => item.id === id && item.active) ?? null;
  return link;
}

export function invoicesFromLocalLink(link: SharedLink): Invoice[] {
  return applyInvoiceFilters(loadLocalInvoices(), link.filters);
}