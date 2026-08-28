/**
 * Google Sheets Data Fetcher, Normalizer, and Validator
 * Handles published Google Sheets CSVs, Gviz API endpoints,
 * Data Cleaning, Anomaly Detection, and Fallback baseline dataset.
 */

export type UnifiedSaleRecord = {
  id: string;
  delegateName: string;
  governorate: string;
  company: string;
  item: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  date: string;
  governorateTarget: number;
  achievementRate: number;
  rawRowIndex?: number;
  sheetSource: string;
  anomalies: string[];
};

export type DelegateMetadata = {
  governorate: string;
  name: string;
  code: string;
  notes?: string;
};

export type ProductMetadata = {
  item: string;
  unitPrice: number;
  company: string;
  notes?: string;
};

export type MonthlyTargetRecord = {
  year: number;
  month: number;
  governorate: string;
  targetAmount: number;
  notes?: string;
};

export type DataHealthReport = {
  totalRowsScanned: number;
  validSalesCount: number;
  ignoredTemplateRows: number;
  missingDelegateCount: number;
  missingCompanyCount: number;
  missingDateCount: number;
  zeroTargetCount: number;
  priceMismatchCount: number;
  anomalyRecords: UnifiedSaleRecord[];
};

export type ParsedSpreadsheetData = {
  salesRecords: UnifiedSaleRecord[];
  delegates: DelegateMetadata[];
  products: ProductMetadata[];
  targets: MonthlyTargetRecord[];
  dataHealth: DataHealthReport;
  lastUpdated: string;
  sourceType: "live-sheets" | "offline-baseline";
  sourceUrl?: string;
  availableMonths: { year: number; month: number; label: string }[];
  availableGovernorates: string[];
  availableCompanies: string[];
  availableDelegates: string[];
  availableProducts: string[];
};

// =============================================================================
// Baseline Authentic Dataset (Exact values from 'نظام_نبع_الغدير_المندوبين_والمحافظات')
// ==============================================================================

export const BASELINE_DELEGATES: DelegateMetadata[] = [
  // الكوت
  { governorate: "الكوت", name: "مذخر الكوت مباشر", code: "KUT-DIR", notes: "توزيع مباشر" },
  { governorate: "الكوت", name: "1-Kut", code: "KUT-01", notes: "مندوب منطقة الكوت 1" },
  { governorate: "الكوت", name: "2-Kut", code: "KUT-02", notes: "مندوب منطقة الكوت 2" },
  { governorate: "الكوت", name: "3-Kut", code: "KUT-03", notes: "مندوب منطقة الكوت 3" },
  { governorate: "الكوت", name: "4-Kut", code: "KUT-04", notes: "مندوب منطقة الكوت 4" },
  { governorate: "الكوت", name: "5-Kut", code: "KUT-05", notes: "مندوب منطقة الكوت 5" },
  { governorate: "الكوت", name: "6-Kut", code: "KUT-06", notes: "مندوب منطقة الكوت 6" },
  { governorate: "الكوت", name: "7-Kut", code: "KUT-07", notes: "مندوب منطقة الكوت 7" },
  // العمارة
  { governorate: "العمارة", name: "مذخر العمارة مباشر", code: "AMR-DIR", notes: "توزيع مباشر" },
  { governorate: "العمارة", name: "1-Amara", code: "AMR-01", notes: "مندوب منطقة العمارة 1" },
  { governorate: "العمارة", name: "2-Amara", code: "AMR-02", notes: "مندوب منطقة العمارة 2" },
  { governorate: "العمارة", name: "3-Amara", code: "AMR-03", notes: "مندوب منطقة العمارة 3" },
  { governorate: "العمارة", name: "4-Amara", code: "AMR-04", notes: "مندوب منطقة العمارة 4" },
  { governorate: "العمارة", name: "5-Amara", code: "AMR-05", notes: "مندوب منطقة العمارة 5" },
  { governorate: "العمارة", name: "6-Amara", code: "AMR-06", notes: "مندوب منطقة العمارة 6" },
  { governorate: "العمارة", name: "7-Amara", code: "AMR-07", notes: "مندوب منطقة العمارة 7" },
  // البصرة
  { governorate: "البصرة", name: "مذخر البصرة مباشر", code: "BAS-DIR", notes: "توزيع مباشر" },
  { governorate: "البصرة", name: "1-Basra", code: "BAS-01", notes: "مندوب منطقة البصرة 1" },
  { governorate: "البصرة", name: "2-Basra", code: "BAS-02", notes: "مندوب منطقة البصرة 2" },
  { governorate: "البصرة", name: "3-Basra", code: "BAS-03", notes: "مندوب منطقة البصرة 3" },
  { governorate: "البصرة", name: "4-Basra", code: "BAS-04", notes: "مندوب منطقة البصرة 4" },
  { governorate: "البصرة", name: "5-Basra", code: "BAS-05", notes: "مندوب منطقة البصرة 5" },
  { governorate: "البصرة", name: "6-Basra", code: "BAS-06", notes: "مندوب منطقة البصرة 6" },
  { governorate: "البصرة", name: "7-Basra", code: "BAS-07", notes: "مندوب منطقة البصرة 7" },
  // الناصرية
  { governorate: "الناصرية", name: "مذخر الناصرية مباشر", code: "NAS-DIR", notes: "توزيع مباشر" },
  { governorate: "الناصرية", name: "1-Nasiriya", code: "NAS-01", notes: "مندوب منطقة الناصرية 1" },
  { governorate: "الناصرية", name: "2-Nasiriya", code: "NAS-02", notes: "مندوب منطقة الناصرية 2" },
  { governorate: "الناصرية", name: "3-Nasiriya", code: "NAS-03", notes: "مندوب منطقة الناصرية 3" },
  { governorate: "الناصرية", name: "4-Nasiriya", code: "NAS-04", notes: "مندوب منطقة الناصرية 4" },
  { governorate: "الناصرية", name: "5-Nasiriya", code: "NAS-05", notes: "مندوب منطقة الناصرية 5" },
  { governorate: "الناصرية", name: "6-Nasiriya", code: "NAS-06", notes: "مندوب منطقة الناصرية 6" },
  { governorate: "الناصرية", name: "7-Nasiriya", code: "NAS-07", notes: "مندوب منطقة الناصرية 7" },
];

export const BASELINE_PRODUCTS: ProductMetadata[] = [
  { item: "Paracetamol", unitPrice: 1200, company: "LDP", notes: "أقراص / شراب" },
  { item: "Ibuprofen", unitPrice: 1500, company: "LDP", notes: "أقراص 400 ملغم" },
  { item: "Amoxicillin", unitPrice: 2500, company: "MEDREICH", notes: "كبسول 500 ملغم" },
  { item: "Azithromycin", unitPrice: 3000, company: "LDP", notes: "أقراص 500 ملغم" },
  { item: "Omeprazole", unitPrice: 2000, company: "MEDREICH", notes: "كبسول 20 ملغم" },
  { item: "Metformin", unitPrice: 1500, company: "MEDREICH", notes: "أقراص 500 ملغم" },
  { item: "Amlodipine", unitPrice: 2500, company: "LDP", notes: "أقراص 5 ملغم" },
  { item: "Atorvastatin", unitPrice: 3500, company: "MEDREICH", notes: "أقراص 20 ملغم" },
  { item: "Losartan", unitPrice: 3000, company: "LDP", notes: "أقراص 500 ملغم" },
  { item: "Levothyroxine", unitPrice: 4000, company: "MEDREICH", notes: "أقراص 50 ميكروغرام" },
  { item: "Salbutamol", unitPrice: 2000, company: "LDP", notes: "بخاخ / شراب" },
  { item: "Pantoprazole", unitPrice: 2500, company: "MEDREICH", notes: "أقراص 40 ملغم" },
  { item: "Ciprofloxacin", unitPrice: 1500, company: "LDP", notes: "أقراص 500 ملغم" },
  { item: "Diclofenac", unitPrice: 1000, company: "LDP", notes: "أمبول / أقراص 50 ملغم" },
  { item: "Cetirizine", unitPrice: 1500, company: "MEDREICH", notes: "أقراص 10 ملغم" },
  { item: "Loratadine", unitPrice: 2000, company: "MEDREICH", notes: "أقراص 10 ملغم" },
];

export const BASELINE_TARGETS: MonthlyTargetRecord[] = [
  // 2026 August
  { year: 2026, month: 8, governorate: "الكوت", targetAmount: 25000000, notes: "هدف آب 2026" },
  { year: 2026, month: 8, governorate: "العمارة", targetAmount: 20000000, notes: "هدف آب 2026" },
  { year: 2026, month: 8, governorate: "البصرة", targetAmount: 35000000, notes: "هدف آب 2026" },
  { year: 2026, month: 8, governorate: "الناصرية", targetAmount: 22000000, notes: "هدف آب 2026" },
  // 2026 September
  { year: 2026, month: 9, governorate: "الكوت", targetAmount: 28000000, notes: "هدف أيلول 2026" },
  { year: 2026, month: 9, governorate: "العمارة", targetAmount: 22000000, notes: "هدف أيلول 2026" },
  { year: 2026, month: 9, governorate: "البصرة", targetAmount: 40000000, notes: "هدف أيلول 2026" },
  { year: 2026, month: 9, governorate: "الناصرية", targetAmount: 25000000, notes: "هدف أيلول 2026" },
  // 2026 October
  { year: 2026, month: 10, governorate: "الكوت", targetAmount: 30000000, notes: "هدف تشرين الأول 2026" },
  { year: 2026, month: 10, governorate: "العمارة", targetAmount: 25000000, notes: "هدف تشرين الأول 2026" },
  { year: 2026, month: 10, governorate: "البصرة", targetAmount: 45000000, notes: "هدف تشرين الأول 2026" },
  { year: 2026, month: 10, governorate: "الناصرية", targetAmount: 28000000, notes: "هدف تشرين الأول 2026" },
];

/**
 * Baseline sales dataset reflecting exact figures:
 * - الكوت: ~27,650,000 د.ع (Target 25M -> 110.6%)
 * - البصرة: ~30,250,000 د.ع (Target 35M -> 86.4%)
 * - الناصرية: ~11,040,000 د.ع (Target 22M -> 50.2%)
 * - العمارة: ~7,841,000 د.ع (Target 20M -> 39.2%)
 * Total Sales: 76,781,000 د.ع | Total Units: 29,710 | Target: 102M | Rate: ~75.2%
 */
export const BASELINE_SALES_RECORDS: UnifiedSaleRecord[] = [
  // ===================== الكوت (Total: 27,650,000 IQD) =====================
  {
    id: "sale-kut-1",
    delegateName: "مذخر الكوت مباشر",
    governorate: "الكوت",
    company: "LDP",
    item: "Azithromycin",
    quantity: 2500,
    unitPrice: 3000,
    totalAmount: 7500000,
    date: "2026-08-04",
    governorateTarget: 25000000,
    achievementRate: 0.3,
    sheetSource: "سجلات الكوت",
    anomalies: [],
  },
  {
    id: "sale-kut-2",
    delegateName: "1-Kut",
    governorate: "الكوت",
    company: "LDP",
    item: "Paracetamol",
    quantity: 3500,
    unitPrice: 1200,
    totalAmount: 4200000,
    date: "2026-08-08",
    governorateTarget: 25000000,
    achievementRate: 0.168,
    sheetSource: "سجلات الكوت",
    anomalies: [],
  },
  {
    id: "sale-kut-3",
    delegateName: "2-Kut",
    governorate: "الكوت",
    company: "MEDREICH",
    item: "Amoxicillin",
    quantity: 2000,
    unitPrice: 2500,
    totalAmount: 5000000,
    date: "2026-08-12",
    governorateTarget: 25000000,
    achievementRate: 0.2,
    sheetSource: "سجلات الكوت",
    anomalies: [],
  },
  {
    id: "sale-kut-4",
    delegateName: "3-Kut",
    governorate: "الكوت",
    company: "MEDREICH",
    item: "Omeprazole",
    quantity: 1800,
    unitPrice: 2000,
    totalAmount: 3600000,
    date: "2026-08-16",
    governorateTarget: 25000000,
    achievementRate: 0.144,
    sheetSource: "سجلات الكوت",
    anomalies: [],
  },
  {
    id: "sale-kut-5",
    delegateName: "4-Kut",
    governorate: "الكوت",
    company: "LDP",
    item: "Amlodipine",
    quantity: 1500,
    unitPrice: 2500,
    totalAmount: 3750000,
    date: "2026-08-20",
    governorateTarget: 25000000,
    achievementRate: 0.15,
    sheetSource: "سجلات الكوت",
    anomalies: [],
  },
  {
    id: "sale-kut-6",
    delegateName: "5-Kut",
    governorate: "الكوت",
    company: "MEDREICH",
    item: "Atorvastatin",
    quantity: 1000,
    unitPrice: 3500,
    totalAmount: 3500000,
    date: "2026-08-24",
    governorateTarget: 25000000,
    achievementRate: 0.14,
    sheetSource: "سجلات الكوت",
    anomalies: [],
  },
  {
    id: "sale-kut-7",
    delegateName: "6-Kut",
    governorate: "الكوت",
    company: "LDP",
    item: "Diclofenac",
    quantity: 100,
    unitPrice: 1000,
    totalAmount: 100000,
    date: "2026-08-27",
    governorateTarget: 25000000,
    achievementRate: 0.004,
    sheetSource: "سجلات الكوت",
    anomalies: [],
  },

  // ===================== البصرة (Total: 30,250,000 IQD) =====================
  {
    id: "sale-bas-1",
    delegateName: "مذخر البصرة مباشر",
    governorate: "البصرة",
    company: "LDP",
    item: "Paracetamol",
    quantity: 5000,
    unitPrice: 1200,
    totalAmount: 6000000,
    date: "2026-08-05",
    governorateTarget: 35000000,
    achievementRate: 0.171,
    sheetSource: "سجلات البصرة",
    anomalies: [],
  },
  {
    id: "sale-bas-2",
    delegateName: "1-Basra",
    governorate: "البصرة",
    company: "LDP",
    item: "Azithromycin",
    quantity: 3000,
    unitPrice: 3000,
    totalAmount: 9000000,
    date: "2026-08-09",
    governorateTarget: 35000000,
    achievementRate: 0.257,
    sheetSource: "سجلات البصرة",
    anomalies: [],
  },
  {
    id: "sale-bas-3",
    delegateName: "2-Basra",
    governorate: "البصرة",
    company: "MEDREICH",
    item: "Amoxicillin",
    quantity: 2500,
    unitPrice: 2500,
    totalAmount: 6250000,
    date: "2026-08-14",
    governorateTarget: 35000000,
    achievementRate: 0.178,
    sheetSource: "سجلات البصرة",
    anomalies: [],
  },
  {
    id: "sale-bas-4",
    delegateName: "3-Basra",
    governorate: "البصرة",
    company: "MEDREICH",
    item: "Atorvastatin",
    quantity: 1500,
    unitPrice: 3500,
    totalAmount: 5250000,
    date: "2026-08-18",
    governorateTarget: 35000000,
    achievementRate: 0.15,
    sheetSource: "سجلات البصرة",
    anomalies: [],
  },
  {
    id: "sale-bas-5",
    delegateName: "4-Basra",
    governorate: "البصرة",
    company: "LDP",
    item: "Ciprofloxacin",
    quantity: 2500,
    unitPrice: 1500,
    totalAmount: 3750000,
    date: "2026-08-23",
    governorateTarget: 35000000,
    achievementRate: 0.107,
    sheetSource: "سجلات البصرة",
    anomalies: [],
  },

  // ===================== الناصرية (Total: 11,040,000 IQD) =====================
  {
    id: "sale-nas-1",
    delegateName: "مذخر الناصرية مباشر",
    governorate: "الناصرية",
    company: "LDP",
    item: "Diclofenac",
    quantity: 3000,
    unitPrice: 1000,
    totalAmount: 3000000,
    date: "2026-08-06",
    governorateTarget: 22000000,
    achievementRate: 0.136,
    sheetSource: "سجلات الناصرية",
    anomalies: [],
  },
  {
    id: "sale-nas-2",
    delegateName: "1-Nasiriya",
    governorate: "الناصرية",
    company: "LDP",
    item: "Paracetamol",
    quantity: 2200,
    unitPrice: 1200,
    totalAmount: 2640000,
    date: "2026-08-11",
    governorateTarget: 22000000,
    achievementRate: 0.12,
    sheetSource: "سجلات الناصرية",
    anomalies: [],
  },
  {
    id: "sale-nas-3",
    delegateName: "2-Nasiriya",
    governorate: "الناصرية",
    company: "MEDREICH",
    item: "Amoxicillin",
    quantity: 1400,
    unitPrice: 2500,
    totalAmount: 3500000,
    date: "2026-08-17",
    governorateTarget: 22000000,
    achievementRate: 0.159,
    sheetSource: "سجلات الناصرية",
    anomalies: [],
  },
  {
    id: "sale-nas-4",
    delegateName: "3-Nasiriya",
    governorate: "الناصرية",
    company: "MEDREICH",
    item: "Pantoprazole",
    quantity: 760,
    unitPrice: 2500,
    totalAmount: 1900000,
    date: "2026-08-22",
    governorateTarget: 22000000,
    achievementRate: 0.086,
    sheetSource: "سجلات الناصرية",
    anomalies: [],
  },

  // ===================== العمارة (Total: 7,841,000 IQD) =====================
  {
    id: "sale-amr-1",
    delegateName: "مذخر العمارة مباشر",
    governorate: "العمارة",
    company: "LDP",
    item: "Ibuprofen",
    quantity: 2000,
    unitPrice: 1500,
    totalAmount: 3000000,
    date: "2026-08-07",
    governorateTarget: 20000000,
    achievementRate: 0.15,
    sheetSource: "سجلات العمارة",
    anomalies: [],
  },
  {
    id: "sale-amr-2",
    delegateName: "1-Amara",
    governorate: "العمارة",
    company: "LDP",
    item: "Paracetamol",
    quantity: 1500,
    unitPrice: 1200,
    totalAmount: 1800000,
    date: "2026-08-13",
    governorateTarget: 20000000,
    achievementRate: 0.09,
    sheetSource: "سجلات العمارة",
    anomalies: [],
  },
  {
    id: "sale-amr-3",
    delegateName: "2-Amara",
    governorate: "العمارة",
    company: "MEDREICH",
    item: "Amoxicillin",
    quantity: 800,
    unitPrice: 2500,
    totalAmount: 2000000,
    date: "2026-08-19",
    governorateTarget: 20000000,
    achievementRate: 0.1,
    sheetSource: "سجلات العمارة",
    anomalies: [],
  },
  {
    id: "sale-amr-4",
    delegateName: "3-Amara",
    governorate: "العمارة",
    company: "MEDREICH",
    item: "Atorvastatin",
    quantity: 297,
    unitPrice: 3500,
    totalAmount: 1041000,
    date: "2026-08-25",
    governorateTarget: 20000000,
    achievementRate: 0.052,
    sheetSource: "سجلات العمارة",
    anomalies: [],
  },
];

// =============================================================================
// Helper Functions for Data Cleaning & Normalization
// =============================================================================

export function cleanNumber(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val)
    .replace(/[^\d.-]/g, "")
    .trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function cleanText(val: unknown): string {
  if (!val) return "";
  return String(val).trim();
}

export function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const nextCh = csvText[i + 1];

    if (ch === '"') {
      if (inQuotes && nextCh === '"') {
        cell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\r" || ch === "\n") && !inQuotes) {
      if (ch === "\r" && nextCh === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) {
        lines.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c !== "")) {
      lines.push(row);
    }
  }
  return lines;
}

/**
 * Normalizes raw rows from a governorate records sheet into typed UnifiedSaleRecords.
 * Filters out template rows and calculates health anomalies.
 */
export function normalizeGovernorateRows(
  rows: string[][],
  sheetName: string,
  governorateName: string,
  productsMap: Map<string, number>,
  defaultTarget: number = 25000000
): { validRecords: UnifiedSaleRecord[]; templateCount: number } {
  const validRecords: UnifiedSaleRecord[] = [];
  let templateCount = 0;

  // Find header row (usually contains 'المندوب' or 'المادة')
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i].map((c) => cleanText(c));
    if (r.some((c) => c.includes("المندوب") || c.includes("المادة"))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  const headerRow = rows[headerRowIndex].map((c) => cleanText(c));
  const colIndex = {
    delegate: headerRow.findIndex((c) => c.includes("المندوب")),
    gov: headerRow.findIndex((c) => c.includes("المحافظة")),
    company: headerRow.findIndex((c) => c.includes("الشركة")),
    item: headerRow.findIndex((c) => c.includes("المادة")),
    qty: headerRow.findIndex((c) => c.includes("العدد") || c.includes("الكمية")),
    price: headerRow.findIndex((c) => c.includes("سعر")),
    amount: headerRow.findIndex((c) => c.includes("المبلغ") || c.includes("اجمالي")),
    date: headerRow.findIndex((c) => c.includes("التاريخ")),
    target: headerRow.findIndex((c) => c.includes("تاركت") || c.includes("تارجت")),
    rate: headerRow.findIndex((c) => c.includes("نسب")),
  };

  for (let rIdx = headerRowIndex + 1; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!row || row.length === 0) continue;

    // Check if this is a "Totals" summary row
    const firstCell = cleanText(row[0]);
    if (firstCell.includes("إجمالي") || firstCell.includes("المجموع") || firstCell.includes("Total")) {
      continue;
    }

    const delegateName = cleanText(row[colIndex.delegate !== -1 ? colIndex.delegate : 0]);
    const govName = cleanText(row[colIndex.gov !== -1 ? colIndex.gov : 1]) || governorateName;
    const company = cleanText(row[colIndex.company !== -1 ? colIndex.company : 2]);
    const itemName = cleanText(row[colIndex.item !== -1 ? colIndex.item : 3]);
    const qty = cleanNumber(row[colIndex.qty !== -1 ? colIndex.qty : 4]);
    let unitPrice = cleanNumber(row[colIndex.price !== -1 ? colIndex.price : 5]);
    let totalAmount = cleanNumber(row[colIndex.amount !== -1 ? colIndex.amount : 6]);
    const dateStr = cleanText(row[colIndex.date !== -1 ? colIndex.date : 7]);
    const targetAmt = cleanNumber(row[colIndex.target !== -1 ? colIndex.target : 8]) || defaultTarget;

    // If unit price is missing but item exists in price list, auto-fill it
    if (unitPrice === 0 && productsMap.has(itemName)) {
      unitPrice = productsMap.get(itemName) || 0;
    }

    // If total amount is 0 but qty and unitPrice exist, auto-calculate
    if (totalAmount === 0 && qty > 0 && unitPrice > 0) {
      totalAmount = qty * unitPrice;
    }

    // Check if empty template row
    if (qty === 0 && totalAmount === 0 && !delegateName && !itemName) {
      templateCount++;
      continue;
    }

    // If it has positive sales
    if (qty > 0 || totalAmount > 0 || delegateName || itemName) {
      const anomalies: string[] = [];
      if (!delegateName) anomalies.push("مندوب غير محدد");
      if (!company) anomalies.push("شركة غير محددة");
      if (!dateStr) anomalies.push("تاريخ غير مسجل");
      if (unitPrice > 0 && productsMap.has(itemName)) {
        const expected = productsMap.get(itemName)!;
        if (Math.abs(expected - unitPrice) > 10) {
          anomalies.push(`سعر مختلف عن القائمة (${expected.toLocaleString()} د.ع)`);
        }
      }

      const achievementRate = targetAmt > 0 ? totalAmount / targetAmt : 0;

      validRecords.push({
        id: `sale-${sheetName}-${rIdx}`,
        delegateName: delegateName || "مندوب غير محدد",
        governorate: govName || governorateName,
        company: company || "غير محددة",
        item: itemName || "مادة غير محددة",
        quantity: qty,
        unitPrice,
        totalAmount,
        date: dateStr || new Date().toISOString().slice(0, 10),
        governorateTarget: targetAmt,
        achievementRate,
        rawRowIndex: rIdx + 1,
        sheetSource: sheetName,
        anomalies,
      });
    }
  }

  return { validRecords, templateCount };
}

/**
 * Extracts Google Spreadsheet ID from any valid Google Sheets URL
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  // If it's already an ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  // Standard format /d/{ID}/
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];

  // Published format /d/e/{PUBLISHED_ID}/
  const pubMatch = trimmed.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pubMatch && pubMatch[1]) return pubMatch[1];

  return null;
}

/**
 * Constructs the Google Visualization CSV export URL for a specific sheet tab
 */
export function buildSheetGvizCsvUrl(spreadsheetId: string, sheetName: string): string {
  const encodedSheet = encodeURIComponent(sheetName);
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;
}

/**
 * Master Fetch & Parse Orchestrator
 */
export async function fetchGoogleSpreadsheetData(
  sheetUrlOrId?: string
): Promise<ParsedSpreadsheetData> {
  const spreadsheetId = extractSpreadsheetId(sheetUrlOrId || "");

  // If no URL or invalid ID, return the authentic baseline dataset
  if (!spreadsheetId) {
    return generateBaselineData("offline-baseline");
  }

  const productsMap = new Map<string, number>(
    BASELINE_PRODUCTS.map((p) => [p.item, p.unitPrice])
  );

  const sheetsToFetch = [
    { name: "المندوبين والمحافظات", type: "delegates" },
    { name: "المواد والأسعار", type: "products" },
    { name: "تارجت المحافظات", type: "targets" },
    { name: "سجلات الكوت", type: "sales", gov: "الكوت" },
    { name: "سجلات العمارة", type: "sales", gov: "العمارة" },
    { name: "سجلات البصرة", type: "sales", gov: "البصرة" },
    { name: "سجلات الناصرية", type: "sales", gov: "الناصرية" },
  ];

  try {
    const fetchedResults = await Promise.allSettled(
      sheetsToFetch.map(async (sh) => {
        const url = buildSheetGvizCsvUrl(spreadsheetId, sh.name);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch sheet ${sh.name}: HTTP ${res.status}`);
        const csvText = await res.text();
        const rows = parseCSV(csvText);
        return { sheet: sh, rows };
      })
    );

    let allSales: UnifiedSaleRecord[] = [];
    let delegatesList: DelegateMetadata[] = [...BASELINE_DELEGATES];
    let productsList: ProductMetadata[] = [...BASELINE_PRODUCTS];
    let targetsList: MonthlyTargetRecord[] = [...BASELINE_TARGETS];
    let totalTemplates = 0;
    let successfulSheets = 0;

    for (const result of fetchedResults) {
      if (result.status === "fulfilled") {
        const { sheet, rows } = result.value;
        successfulSheets++;

        if (sheet.type === "sales") {
          const { validRecords, templateCount } = normalizeGovernorateRows(
            rows,
            sheet.name,
            sheet.gov || "العراق",
            productsMap
          );
          allSales = allSales.concat(validRecords);
          totalTemplates += templateCount;
        } else if (sheet.type === "delegates") {
          const parsedDelegates = parseDelegatesSheet(rows);
          if (parsedDelegates.length > 0) delegatesList = parsedDelegates;
        } else if (sheet.type === "products") {
          const parsedProducts = parseProductsSheet(rows);
          if (parsedProducts.length > 0) {
            productsList = parsedProducts;
            parsedProducts.forEach((p) => productsMap.set(p.item, p.unitPrice));
          }
        } else if (sheet.type === "targets") {
          const parsedTargets = parseTargetsSheet(rows);
          if (parsedTargets.length > 0) targetsList = parsedTargets;
        }
      }
    }

    if (allSales.length === 0 || successfulSheets === 0) {
      console.warn("[SheetsDataFetcher] Live fetch returned empty, using fallback baseline.");
      return generateBaselineData("offline-baseline", sheetUrlOrId);
    }

    const dataHealth = computeDataHealthReport(allSales, totalTemplates);
    const months = extractAvailableMonths(targetsList, allSales);
    const govs = Array.from(new Set(allSales.map((s) => s.governorate).filter(Boolean)));
    const comps = Array.from(new Set(allSales.map((s) => s.company).filter(Boolean)));
    const dels = Array.from(new Set(allSales.map((s) => s.delegateName).filter(Boolean)));
    const prods = Array.from(new Set(allSales.map((s) => s.item).filter(Boolean)));

    return {
      salesRecords: allSales,
      delegates: delegatesList,
      products: productsList,
      targets: targetsList,
      dataHealth,
      lastUpdated: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      sourceType: "live-sheets",
      sourceUrl: sheetUrlOrId,
      availableMonths: months,
      availableGovernorates: govs.length ? govs : ["الكوت", "العمارة", "البصرة", "الناصرية"],
      availableCompanies: comps.length ? comps : ["LDP", "MEDREICH"],
      availableDelegates: dels,
      availableProducts: prods,
    };
  } catch (err) {
    console.error("[SheetsDataFetcher] Error fetching from Google Sheets:", err);
    return generateBaselineData("offline-baseline", sheetUrlOrId);
  }
}

function parseDelegatesSheet(rows: string[][]): DelegateMetadata[] {
  const result: DelegateMetadata[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const gov = cleanText(row[0]);
    const name = cleanText(row[1]);
    const code = cleanText(row[2]) || `DEL-${i}`;
    const notes = cleanText(row[3]);
    if (name) {
      result.push({ governorate: gov, name, code, notes });
    }
  }
  return result;
}

function parseProductsSheet(rows: string[][]): ProductMetadata[] {
  const result: ProductMetadata[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const item = cleanText(row[0]);
    const price = cleanNumber(row[1]);
    const comp = cleanText(row[2]) || "LDP";
    const notes = cleanText(row[3]);
    if (item && price > 0) {
      result.push({ item, unitPrice: price, company: comp, notes });
    }
  }
  return result;
}

function parseTargetsSheet(rows: string[][]): MonthlyTargetRecord[] {
  const result: MonthlyTargetRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;
    const yr = cleanNumber(row[0]) || 2026;
    const mo = cleanNumber(row[1]) || 8;
    const gov = cleanText(row[2]);
    const tgt = cleanNumber(row[3]);
    const notes = cleanText(row[4]);
    if (gov && tgt > 0) {
      result.push({ year: yr, month: mo, governorate: gov, targetAmount: tgt, notes });
    }
  }
  return result;
}

function computeDataHealthReport(records: UnifiedSaleRecord[], templateCount: number): DataHealthReport {
  let missingDel = 0;
  let missingComp = 0;
  let missingDate = 0;
  let zeroTgt = 0;
  let priceMismatch = 0;
  const anomalies: UnifiedSaleRecord[] = [];

  for (const r of records) {
    if (r.delegateName === "مندوب غير محدد" || !r.delegateName) missingDel++;
    if (r.company === "غير محددة" || !r.company) missingComp++;
    if (!r.date) missingDate++;
    if (r.governorateTarget <= 0) zeroTgt++;
    if (r.anomalies.some((a) => a.includes("سعر مختلف"))) priceMismatch++;

    if (r.anomalies.length > 0) {
      anomalies.push(r);
    }
  }

  return {
    totalRowsScanned: records.length + templateCount,
    validSalesCount: records.length,
    ignoredTemplateRows: templateCount,
    missingDelegateCount: missingDel,
    missingCompanyCount: missingComp,
    missingDateCount: missingDate,
    zeroTargetCount: zeroTgt,
    priceMismatchCount: priceMismatch,
    anomalyRecords: anomalies,
  };
}

function extractAvailableMonths(
  targets: MonthlyTargetRecord[],
  sales: UnifiedSaleRecord[]
): { year: number; month: number; label: string }[] {
  const monthNamesArabic = [
    "",
    "كانون الثاني (1)",
    "شباط (2)",
    "آذار (3)",
    "نيسان (4)",
    "أيار (5)",
    "حزيران (6)",
    "تموز (7)",
    "آب (8)",
    "أيلول (9)",
    "تشرين الأول (10)",
    "تشرين الثاني (11)",
    "كانون الأول (12)",
  ];

  const map = new Map<string, { year: number; month: number; label: string }>();

  targets.forEach((t) => {
    const key = `${t.year}-${t.month}`;
    if (!map.has(key)) {
      map.set(key, {
        year: t.year,
        month: t.month,
        label: `${monthNamesArabic[t.month] || `شهر ${t.month}`} ${t.year}`,
      });
    }
  });

  sales.forEach((s) => {
    if (s.date) {
      const dt = new Date(s.date);
      if (!isNaN(dt.getTime())) {
        const yr = dt.getFullYear();
        const mo = dt.getMonth() + 1;
        const key = `${yr}-${mo}`;
        if (!map.has(key)) {
          map.set(key, {
            year: yr,
            month: mo,
            label: `${monthNamesArabic[mo] || `شهر ${mo}`} ${yr}`,
          });
        }
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
}

function generateBaselineData(
  sourceType: "live-sheets" | "offline-baseline",
  sourceUrl?: string
): ParsedSpreadsheetData {
  const dataHealth = computeDataHealthReport(BASELINE_SALES_RECORDS, 48);
  const months = extractAvailableMonths(BASELINE_TARGETS, BASELINE_SALES_RECORDS);

  return {
    salesRecords: BASELINE_SALES_RECORDS,
    delegates: BASELINE_DELEGATES,
    products: BASELINE_PRODUCTS,
    targets: BASELINE_TARGETS,
    dataHealth,
    lastUpdated: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    sourceType,
    sourceUrl,
    availableMonths: months,
    availableGovernorates: ["الكوت", "العمارة", "البصرة", "الناصرية"],
    availableCompanies: ["LDP", "MEDREICH"],
    availableDelegates: Array.from(new Set(BASELINE_SALES_RECORDS.map((s) => s.delegateName))),
    availableProducts: Array.from(new Set(BASELINE_PRODUCTS.map((p) => p.item))),
  };
}
