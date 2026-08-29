import type {
  DataQualityIssue,
  DelegatesDataset,
  MonthlyTarget,
  Product,
  Representative,
  SaleIssueCode,
  SaleRecord,
  SheetSummary,
} from "./types";

export const GOOGLE_SHEETS_SOURCE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vShOTnvTPOLJPmodDLk9XRvJSVwyJsNAlz9OEvQuzjKBgYoD5Tys0iUeCIAzcPVvoruO0fRIplcJB-1";

type PublishedTab = { name: string; gid: string };
type ParsedTab = PublishedTab & { rows: string[][] };

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

export function cleanNumber(value: unknown): number | null {
  const normalized = cleanText(value)
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] ?? digit)
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".")
    .replace(/%/g, "")
    .replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function normalizeDate(value: unknown): string | null {
  const text = cleanText(value).replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] ?? digit);
  if (!text) return null;
  const parts = text.split(/[\/-]/).map(Number);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const year = a > 999 ? a : c;
    const month = a > 999 ? b : b;
    const day = a > 999 ? c : a;
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cleanText(cell))) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cleanText(cell))) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[()\[\]{}\/\\—–_-]/g, " ")
    .replace(/[.،,:؛]/g, "")
    .replace(/د\.?\s*ع/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderIndex(rows: string[][], requiredGroups: string[][]): number {
  return rows.slice(0, 15).findIndex((row) => {
    const headers = row.map((cell) => normalizeHeader(cell));
    return requiredGroups.every((aliases) => aliases.some((alias) => headers.includes(normalizeHeader(alias))));
  });
}

function column(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function issue(code: SaleIssueCode, label: string, severity: "warning" | "error" = "warning"): DataQualityIssue {
  return { code, label, severity };
}

function parsePublishedTabs(html: string): PublishedTab[] {
  return Array.from(html.matchAll(/items\.push\(\{name: "([^"]+)"[\s\S]*?gid: "(\d+)"/g))
    .map((match) => ({ name: match[1], gid: match[2] }));
}

function classifyTab(rows: string[][]): SheetSummary["kind"] {
  if (findHeaderIndex(rows, [["المندوب"], ["سعر البيع المحفوظ"], ["إجمالي المبلغ"]]) >= 0) return "sales";
  if (findHeaderIndex(rows, [["المحافظة"], ["المندوب"], ["كود المندوب"]]) >= 0) return "representatives";
  if (findHeaderIndex(rows, [["المادة"], ["السعر المفرد"], ["الشركة الموردة"]]) >= 0) return "products";
  if (findHeaderIndex(rows, [["السنة"], ["الشهر"], ["المحافظة"], ["الهدف", "الهدف التارغت"]]) >= 0) return "targets";
  if (findHeaderIndex(rows, [["السعر السابق"], ["السعر الجديد"]]) >= 0) return "price-history";
  return "other";
}

function parseRepresentatives(rows: string[][]): Representative[] {
  const headerIndex = findHeaderIndex(rows, [["المحافظة"], ["المندوب"], ["كود المندوب"]]);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex];
  const indexes = {
    governorate: column(headers, ["المحافظة"]),
    name: column(headers, ["المندوب"]),
    code: column(headers, ["كود المندوب"]),
    notes: column(headers, ["ملاحظات"]),
  };
  return rows.slice(headerIndex + 1).map((row) => ({
    governorate: cleanText(row[indexes.governorate]),
    name: cleanText(row[indexes.name]),
    code: cleanText(row[indexes.code]),
    notes: indexes.notes >= 0 ? cleanText(row[indexes.notes]) : "",
  })).filter((record) => record.governorate && record.name);
}

function parseProducts(rows: string[][]): Product[] {
  const headerIndex = findHeaderIndex(rows, [["المادة"], ["السعر المفرد"], ["الشركة الموردة"]]);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex];
  const indexes = {
    name: column(headers, ["المادة"]),
    price: column(headers, ["السعر المفرد", "السعر المفرد د ع"]),
    company: column(headers, ["الشركة الموردة", "الشركة"]),
  };
  return rows.slice(headerIndex + 1).map((row) => ({
    name: cleanText(row[indexes.name]),
    currentPrice: cleanNumber(row[indexes.price]) ?? 0,
    company: cleanText(row[indexes.company]),
  })).filter((record) => record.name);
}

function parseTargets(rows: string[][]): MonthlyTarget[] {
  const headerIndex = findHeaderIndex(rows, [["السنة"], ["الشهر"], ["المحافظة"], ["الهدف", "الهدف التارغت"]]);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex];
  const indexes = {
    year: column(headers, ["السنة"]),
    month: column(headers, ["الشهر"]),
    governorate: column(headers, ["المحافظة"]),
    amount: column(headers, ["الهدف", "الهدف التارغت", "الهدف التارغت د ع"]),
    notes: column(headers, ["ملاحظات الخطة", "ملاحظات"]),
  };
  return rows.slice(headerIndex + 1).map((row) => ({
    year: cleanNumber(row[indexes.year]) ?? 0,
    month: cleanNumber(row[indexes.month]) ?? 0,
    governorate: cleanText(row[indexes.governorate]),
    amount: cleanNumber(row[indexes.amount]) ?? 0,
    notes: indexes.notes >= 0 ? cleanText(row[indexes.notes]) : "",
  })).filter((target) => target.year > 0 && target.month > 0 && target.governorate && target.amount >= 0);
}

function parseSales(tab: ParsedTab): SaleRecord[] {
  const headerIndex = findHeaderIndex(tab.rows, [["المندوب"], ["سعر البيع المحفوظ"], ["إجمالي المبلغ"]]);
  if (headerIndex < 0) return [];
  const headers = tab.rows[headerIndex];
  const indexes = {
    representative: column(headers, ["المندوب"]),
    governorate: column(headers, ["المحافظة"]),
    company: column(headers, ["الشركة", "الشركة الموردة"]),
    product: column(headers, ["المادة"]),
    quantity: column(headers, ["الكمية", "العدد"]),
    savedPrice: column(headers, ["سعر البيع المحفوظ"]),
    total: column(headers, ["إجمالي المبلغ", "الاجمالي"]),
    date: column(headers, ["التاريخ"]),
    target: column(headers, ["التارغت الشهري", "الهدف الشهري"]),
    contribution: column(headers, ["نسبة العملية من التارغت"]),
    notes: column(headers, ["ملاحظات"]),
  };

  return tab.rows.slice(headerIndex + 1).flatMap((row, offset) => {
    const representative = cleanText(row[indexes.representative]);
    const governorate = cleanText(row[indexes.governorate]);
    const company = cleanText(row[indexes.company]);
    const product = cleanText(row[indexes.product]);
    const quantity = cleanNumber(row[indexes.quantity]);
    const savedUnitPrice = cleanNumber(row[indexes.savedPrice]);
    const totalAmount = cleanNumber(row[indexes.total]);
    const date = normalizeDate(row[indexes.date]);
    const monthlyTargetSnapshot = cleanNumber(row[indexes.target]);
    const contributionValue = cleanNumber(row[indexes.contribution]);
    const targetContribution = contributionValue === null ? null : contributionValue / 100;
    const notes = indexes.notes >= 0 ? cleanText(row[indexes.notes]) : "";

    const hasSaleSignal = Boolean(product || date || (quantity && quantity > 0) || (totalAmount && totalAmount > 0));
    if (!hasSaleSignal) return [];

    const issues: DataQualityIssue[] = [];
    if (!representative) issues.push(issue("missing-representative", "المندوب غير مسجل"));
    if (!governorate) issues.push(issue("missing-governorate", "المحافظة غير مسجلة", "error"));
    if (!company) issues.push(issue("missing-company", "الشركة غير مسجلة"));
    if (!product) issues.push(issue("missing-product", "المادة غير مسجلة", "error"));
    if (!quantity || quantity <= 0) issues.push(issue("missing-quantity", "الكمية غير مكتملة", "error"));
    if (!savedUnitPrice || savedUnitPrice <= 0) issues.push(issue("missing-saved-price", "سعر البيع المحفوظ غير مكتمل", "error"));
    if (!totalAmount || totalAmount <= 0) issues.push(issue("missing-total", "إجمالي العملية غير مكتمل", "error"));
    if (!date) issues.push(issue("missing-date", "تاريخ العملية غير مكتمل", "error"));
    if (quantity && savedUnitPrice && totalAmount && Math.abs(quantity * savedUnitPrice - totalAmount) > 1) {
      issues.push(issue("total-mismatch", "الإجمالي لا يطابق الكمية × السعر", "warning"));
    }

    const isAnalytical = Boolean(
      governorate && product && quantity && quantity > 0 && savedUnitPrice && savedUnitPrice > 0 && totalAmount && totalAmount > 0 && date
    );

    return [{
      id: `${tab.gid}-${headerIndex + offset + 2}`,
      representative,
      governorate,
      company,
      product,
      quantity,
      savedUnitPrice,
      totalAmount,
      date,
      monthlyTargetSnapshot,
      targetContribution,
      notes,
      sourceSheet: tab.name,
      sourceRow: headerIndex + offset + 2,
      issues,
      isAnalytical,
    }];
  });
}

function addRelationshipIssues(sales: SaleRecord[], representatives: Representative[], products: Product[]): SaleRecord[] {
  const representativeMap = new Map(representatives.map((record) => [record.name, record]));
  const productMap = new Map(products.map((record) => [record.name, record]));
  return sales.map((sale) => {
    const issues = [...sale.issues];
    const representative = representativeMap.get(sale.representative);
    if (sale.representative && !representative) issues.push(issue("unknown-representative", "المندوب غير موجود في الدليل"));
    if (representative && sale.governorate && representative.governorate !== sale.governorate) {
      issues.push(issue("unknown-representative", "محافظة المندوب لا تطابق العملية"));
    }
    const product = productMap.get(sale.product);
    if (sale.product && !product) issues.push(issue("unknown-product", "المادة غير موجودة في دليل المواد"));
    if (product && sale.company && product.company && product.company !== sale.company) {
      issues.push(issue("company-mismatch", "الشركة لا تطابق دليل المادة"));
    }
    return { ...sale, issues };
  });
}

export async function fetchDelegatesDataset(signal?: AbortSignal): Promise<DelegatesDataset> {
  const htmlResponse = await fetch(`${GOOGLE_SHEETS_SOURCE}/pubhtml`, { cache: "no-store", signal });
  if (!htmlResponse.ok) throw new Error("تعذر الوصول إلى فهرس Google Sheets");
  const tabs = parsePublishedTabs(await htmlResponse.text());
  if (!tabs.length) throw new Error("لم يتم العثور على صفحات منشورة في Google Sheets");

  const parsedTabs: ParsedTab[] = await Promise.all(tabs.map(async (tab) => {
    const response = await fetch(`${GOOGLE_SHEETS_SOURCE}/pub?output=csv&gid=${tab.gid}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error(`تعذر تحميل صفحة ${tab.name}`);
    return { ...tab, rows: parseCsv(await response.text()) };
  }));

  const representatives = parsedTabs.flatMap((tab) => classifyTab(tab.rows) === "representatives" ? parseRepresentatives(tab.rows) : []);
  const products = parsedTabs.flatMap((tab) => classifyTab(tab.rows) === "products" ? parseProducts(tab.rows) : []);
  const targets = parsedTabs.flatMap((tab) => classifyTab(tab.rows) === "targets" ? parseTargets(tab.rows) : []);
  const rawSales = parsedTabs.flatMap((tab) => classifyTab(tab.rows) === "sales" ? parseSales(tab) : []);
  const sales = addRelationshipIssues(rawSales, representatives, products);

  return {
    sales,
    representatives,
    products,
    targets,
    sheets: parsedTabs.map((tab) => ({
      name: tab.name,
      gid: tab.gid,
      rowCount: tab.rows.length,
      kind: classifyTab(tab.rows),
    })),
    fetchedAt: new Date().toISOString(),
    sourceUrl: `${GOOGLE_SHEETS_SOURCE}/pub?output=csv`,
  };
}
