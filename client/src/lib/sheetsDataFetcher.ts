/**
 * Google Sheets Data Fetcher, Normalizer, and Validator
 * Direct integration with published Google Sheets GIDs:
 * - GID 1237028848: لوحة التحكم العامة
 * - GID 138113443: المندوبين والمحافظات
 * - GID 373750291: المواد والأسعار
 * - GID 1650999653: تارجت المحافظات
 * - GID 2137451503: سجلات الكوت
 * - GID 485445038: سجلات العمارة
 * - GID 839168101: سجلات البصرة
 * - GID 306894943: سجلات الناصرية
 * - GID 1488307462: سجل تغير الأسعار
 */

export type UnifiedSaleRecord = {
  id: string;
  delegateName: string;
  governorate: string;
  company: string;
  item: string;
  quantity: number;
  unitPrice: number; // Historical saved unit price at the time of sale
  totalAmount: number;
  date: string;
  governorateTarget: number;
  achievementRate: number;
  notes?: string;
  rawRowIndex?: number;
  sheetSource: string;
  status: "valid" | "incomplete" | "template";
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
  unitPrice: number; // Current master price
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
  incompleteSalesCount: number;
  ignoredTemplateRows: number;
  missingDelegateCount: number;
  missingCompanyCount: number;
  missingDateCount: number;
  zeroTargetCount: number;
  anomaliesCount: number;
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

export const PUBLISHED_SHEET_GIDS = {
  summary: "1237028848",
  delegates: "138113443",
  products: "373750291",
  targets: "1650999653",
  salesKut: "2137451503",
  salesAmara: "485445038",
  salesBasra: "839168101",
  salesNasiriya: "306894943",
  priceHistory: "1488307462",
};

export const DEFAULT_PUBLISHED_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vShOTnvTPOLJPmodDLk9XRvJSVwyJsNAlz9OEvQuzjKBgYoD5Tys0iUeCIAzcPVvoruO0fRIplcJB-1/pub";

// =============================================================================
// Helper Functions for Data Cleaning & Parsing
// =============================================================================

export function cleanNumber(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val)
    .replace(/[٬,]/g, "")
    .replace(/٫/g, ".")
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
 * Normalizes rows from a governorate sales sheet.
 * Preserves historical saved price, detects incomplete vs template rows.
 */
export function normalizeGovernorateSalesRows(
  rows: string[][],
  sheetName: string,
  governorateName: string,
  productsMasterMap: Map<string, { price: number; company: string }>,
  defaultTarget: number = 25000000
): { validRecords: UnifiedSaleRecord[]; templateCount: number } {
  const records: UnifiedSaleRecord[] = [];
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
    qty: headerRow.findIndex((c) => c.includes("الكمية") || c.includes("العدد")),
    price: headerRow.findIndex((c) => c.includes("سعر")),
    amount: headerRow.findIndex((c) => c.includes("المبلغ") || c.includes("إجمالي")),
    date: headerRow.findIndex((c) => c.includes("التاريخ")),
    target: headerRow.findIndex((c) => c.includes("تاركت") || c.includes("تارجت") || c.includes("الهدف")),
    rate: headerRow.findIndex((c) => c.includes("نسب")),
    notes: headerRow.findIndex((c) => c.includes("ملاحظ")),
  };

  for (let rIdx = headerRowIndex + 1; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (!row || row.length === 0) continue;

    // Check if this is an "إجمالي" or summary row
    const firstCell = cleanText(row[0]);
    if (firstCell.includes("إجمالي") || firstCell.includes("المجموع") || firstCell.includes("Total")) {
      continue;
    }

    const delegateName = cleanText(row[colIndex.delegate !== -1 ? colIndex.delegate : 0]);
    const govName = cleanText(row[colIndex.gov !== -1 ? colIndex.gov : 1]) || governorateName;
    let company = cleanText(row[colIndex.company !== -1 ? colIndex.company : 2]);
    const itemName = cleanText(row[colIndex.item !== -1 ? colIndex.item : 3]);
    const qty = cleanNumber(row[colIndex.qty !== -1 ? colIndex.qty : 4]);
    let savedUnitPrice = cleanNumber(row[colIndex.price !== -1 ? colIndex.price : 5]);
    let totalAmount = cleanNumber(row[colIndex.amount !== -1 ? colIndex.amount : 6]);
    const dateStr = cleanText(row[colIndex.date !== -1 ? colIndex.date : 7]);
    const targetAmt = cleanNumber(row[colIndex.target !== -1 ? colIndex.target : 8]) || defaultTarget;
    const notes = cleanText(row[colIndex.notes !== -1 ? colIndex.notes : 10]);

    // Template row check: no quantity, no amount, no item or delegate
    if (qty === 0 && totalAmount === 0 && !itemName && !delegateName) {
      templateCount++;
      continue;
    }

    // If company is missing, try looking it up from products master
    if (!company && productsMasterMap.has(itemName)) {
      company = productsMasterMap.get(itemName)?.company || "";
    }

    // Historical price: if saved price is 0 but item exists in master
    if (savedUnitPrice === 0 && productsMasterMap.has(itemName)) {
      savedUnitPrice = productsMasterMap.get(itemName)?.price || 0;
    }

    // Auto-calculate total amount if 0
    if (totalAmount === 0 && qty > 0 && savedUnitPrice > 0) {
      totalAmount = qty * savedUnitPrice;
    }

    // If both qty and amount are 0, this is a blank placeholder template
    if (qty === 0 && totalAmount === 0) {
      templateCount++;
      continue;
    }

    // Anomaly detection
    const anomalies: string[] = [];
    if (!delegateName) anomalies.push("المندوب مفقود");
    if (!company) anomalies.push("الشركة مفقودة");
    if (!dateStr) anomalies.push("التاريخ مفقود");
    if (targetAmt <= 0) anomalies.push("التارغت الشهري غير مسجل");

    const status: UnifiedSaleRecord["status"] = anomalies.length === 0 ? "valid" : "incomplete";
    const achievementRate = targetAmt > 0 ? totalAmount / targetAmt : 0;

    records.push({
      id: `sale-${governorateName}-${rIdx}`,
      delegateName: delegateName || "غير محدد",
      governorate: govName || governorateName,
      company: company || "غير محددة",
      item: itemName || "مادة غير محددة",
      quantity: qty,
      unitPrice: savedUnitPrice,
      totalAmount,
      date: dateStr,
      governorateTarget: targetAmt,
      achievementRate,
      notes,
      rawRowIndex: rIdx + 1,
      sheetSource: sheetName,
      status,
      anomalies,
    });
  }

  return { validRecords: records, templateCount };
}

/**
 * Parses Delegates & Governorates Sheet
 */
function parseDelegatesSheet(rows: string[][]): DelegateMetadata[] {
  const result: DelegateMetadata[] = [];
  let startIdx = 1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].some((c) => c.includes("المندوب") || c.includes("كود"))) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < rows.length; i++) {
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

/**
 * Parses Products & Prices Master Sheet
 */
function parseProductsSheet(rows: string[][]): ProductMetadata[] {
  const result: ProductMetadata[] = [];
  let startIdx = 1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].some((c) => c.includes("المادة") || c.includes("السعر"))) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const item = cleanText(row[0]);
    const price = cleanNumber(row[1]);
    const company = cleanText(row[2]) || "LDP";
    const notes = cleanText(row[3]);
    if (item && price > 0) {
      result.push({ item, unitPrice: price, company, notes });
    }
  }
  return result;
}

/**
 * Parses Targets Sheet
 */
function parseTargetsSheet(rows: string[][]): MonthlyTargetRecord[] {
  const result: MonthlyTargetRecord[] = [];
  let startIdx = 1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].some((c) => c.includes("السنة") || c.includes("التارغت") || c.includes("الهدف"))) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < rows.length; i++) {
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

/**
 * Computes Data Health Report
 */
function computeDataHealthReport(records: UnifiedSaleRecord[], templateCount: number): DataHealthReport {
  let validCount = 0;
  let incompleteCount = 0;
  let missingDel = 0;
  let missingComp = 0;
  let missingDate = 0;
  let zeroTgt = 0;
  const anomalies: UnifiedSaleRecord[] = [];

  for (const r of records) {
    if (r.status === "valid") {
      validCount++;
    } else {
      incompleteCount++;
      anomalies.push(r);
    }

    if (r.delegateName === "غير محدد" || !r.delegateName) missingDel++;
    if (r.company === "غير محددة" || !r.company) missingComp++;
    if (!r.date) missingDate++;
    if (r.governorateTarget <= 0) zeroTgt++;
  }

  return {
    totalRowsScanned: records.length + templateCount,
    validSalesCount: validCount,
    incompleteSalesCount: incompleteCount,
    ignoredTemplateRows: templateCount,
    missingDelegateCount: missingDel,
    missingCompanyCount: missingComp,
    missingDateCount: missingDate,
    zeroTargetCount: zeroTgt,
    anomaliesCount: anomalies.length,
    anomalyRecords: anomalies,
  };
}

/**
 * Extracts Available Months for Period Selector
 */
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
      // Parse DD/MM/YYYY or YYYY-MM-DD
      const parts = s.date.split(/[\/\-]/);
      let yr = 2026;
      let mo = 8;
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          yr = parseInt(parts[0]);
          mo = parseInt(parts[1]);
        } else {
          mo = parseInt(parts[1]);
          yr = parseInt(parts[2]);
        }
      }
      if (mo >= 1 && mo <= 12) {
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

/**
 * Master Fetcher from Published Google Sheets
 */
export async function fetchGoogleSpreadsheetData(
  baseUrlOrPublishedUrl?: string
): Promise<ParsedSpreadsheetData> {
  const base = baseUrlOrPublishedUrl?.trim() || DEFAULT_PUBLISHED_BASE_URL;
  // Ensure base ends with /pub if it's the published URL
  let fetchBase = base.split("?")[0];
  if (!fetchBase.endsWith("/pub")) {
    fetchBase = fetchBase.replace(/\/pubhtml$/, "/pub");
    if (!fetchBase.endsWith("/pub")) fetchBase += "/pub";
  }

  const sheetsToFetch = [
    { gid: PUBLISHED_SHEET_GIDS.delegates, name: "المندوبين والمحافظات", type: "delegates" },
    { gid: PUBLISHED_SHEET_GIDS.products, name: "المواد والأسعار", type: "products" },
    { gid: PUBLISHED_SHEET_GIDS.targets, name: "تارجت المحافظات", type: "targets" },
    { gid: PUBLISHED_SHEET_GIDS.salesKut, name: "سجلات الكوت", type: "sales", gov: "الكوت" },
    { gid: PUBLISHED_SHEET_GIDS.salesAmara, name: "سجلات العمارة", type: "sales", gov: "العمارة" },
    { gid: PUBLISHED_SHEET_GIDS.salesBasra, name: "سجلات البصرة", type: "sales", gov: "البصرة" },
    { gid: PUBLISHED_SHEET_GIDS.salesNasiriya, name: "سجلات الناصرية", type: "sales", gov: "الناصرية" },
  ];

  try {
    const fetchPromises = sheetsToFetch.map(async (sh) => {
      const url = `${fetchBase}?output=csv&gid=${sh.gid}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for sheet ${sh.name}`);
      const text = await res.text();
      return { sheet: sh, rows: parseCSV(text) };
    });

    const results = await Promise.allSettled(fetchPromises);

    let delegatesList: DelegateMetadata[] = [];
    let productsList: ProductMetadata[] = [];
    let targetsList: MonthlyTargetRecord[] = [];
    const productsMasterMap = new Map<string, { price: number; company: string }>();

    // First pass: extract masters (delegates, products, targets)
    for (const r of results) {
      if (r.status === "fulfilled") {
        const { sheet, rows } = r.value;
        if (sheet.type === "products") {
          productsList = parseProductsSheet(rows);
          productsList.forEach((p) => productsMasterMap.set(p.item, { price: p.unitPrice, company: p.company }));
        } else if (sheet.type === "delegates") {
          delegatesList = parseDelegatesSheet(rows);
        } else if (sheet.type === "targets") {
          targetsList = parseTargetsSheet(rows);
        }
      }
    }

    // Second pass: extract sales from all 4 governorates
    let allSales: UnifiedSaleRecord[] = [];
    let totalTemplates = 0;

    for (const r of results) {
      if (r.status === "fulfilled") {
        const { sheet, rows } = r.value;
        if (sheet.type === "sales") {
          const { validRecords, templateCount } = normalizeGovernorateSalesRows(
            rows,
            sheet.name,
            sheet.gov || "العراق",
            productsMasterMap
          );
          allSales = allSales.concat(validRecords);
          totalTemplates += templateCount;
        }
      }
    }

    if (allSales.length === 0) {
      throw new Error("No sales records retrieved from Google Sheets.");
    }

    const dataHealth = computeDataHealthReport(allSales, totalTemplates);
    const months = extractAvailableMonths(targetsList, allSales);
    const govs = Array.from(new Set(allSales.map((s) => s.governorate).filter(Boolean)));
    const comps = Array.from(new Set(allSales.map((s) => s.company).filter(Boolean)));
    const dels = Array.from(new Set(allSales.map((s) => s.delegateName).filter(Boolean)));
    const prods = Array.from(new Set(productsList.map((p) => p.item).filter(Boolean)));

    return {
      salesRecords: allSales,
      delegates: delegatesList,
      products: productsList,
      targets: targetsList,
      dataHealth,
      lastUpdated: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      sourceType: "live-sheets",
      sourceUrl: base,
      availableMonths: months,
      availableGovernorates: govs.length ? govs : ["الكوت", "العمارة", "البصرة", "الناصرية"],
      availableCompanies: comps.length ? comps : ["LDP", "MEDREICH"],
      availableDelegates: dels,
      availableProducts: prods,
    };
  } catch (err) {
    console.error("[SheetsDataFetcher] Live fetch failed, using fallback:", err);
    return getFallbackBaselineData(base);
  }
}

/**
 * Fallback Baseline with the exact 26 items, 32 delegates, targets, and sales from the Google Sheet
 */
function getFallbackBaselineData(sourceUrl?: string): ParsedSpreadsheetData {
  // Built directly from the verified data in all 9 sheets
  const delegates: DelegateMetadata[] = [
    { governorate: "الكوت", name: "مذخر الكوت مباشر", code: "KUT-DIR", notes: "توزيع مباشر" },
    { governorate: "الكوت", name: "1-Kut", code: "KUT-01", notes: "مندوب منطقة الكوت 1" },
    { governorate: "الكوت", name: "2-Kut", code: "KUT-02", notes: "مندوب منطقة الكوت 2" },
    { governorate: "الكوت", name: "3-Kut", code: "KUT-03", notes: "مندوب منطقة الكوت 3" },
    { governorate: "الكوت", name: "4-Kut", code: "KUT-04", notes: "مندوب منطقة الكوت 4" },
    { governorate: "الكوت", name: "5-Kut", code: "KUT-05", notes: "مندوب منطقة الكوت 5" },
    { governorate: "الكوت", name: "6-Kut", code: "KUT-06", notes: "مندوب منطقة الكوت 6" },
    { governorate: "الكوت", name: "7-Kut", code: "KUT-07", notes: "مندوب منطقة الكوت 7" },
    { governorate: "العمارة", name: "مذخر العمارة مباشر", code: "AMR-DIR", notes: "توزيع مباشر" },
    { governorate: "العمارة", name: "1-Amara", code: "AMR-01", notes: "مندوب منطقة العمارة 1" },
    { governorate: "العمارة", name: "2-Amara", code: "AMR-02", notes: "مندوب منطقة العمارة 2" },
    { governorate: "العمارة", name: "3-Amara", code: "AMR-03", notes: "مندوب منطقة العمارة 3" },
    { governorate: "العمارة", name: "4-Amara", code: "AMR-04", notes: "مندوب منطقة العمارة 4" },
    { governorate: "العمارة", name: "5-Amara", code: "AMR-05", notes: "مندوب منطقة العمارة 5" },
    { governorate: "العمارة", name: "6-Amara", code: "AMR-06", notes: "مندوب منطقة العمارة 6" },
    { governorate: "العمارة", name: "7-Amara", code: "AMR-07", notes: "مندوب منطقة العمارة 7" },
    { governorate: "البصرة", name: "مذخر البصرة مباشر", code: "BAS-DIR", notes: "توزيع مباشر" },
    { governorate: "البصرة", name: "1-Basra", code: "BAS-01", notes: "مندوب منطقة البصرة 1" },
    { governorate: "البصرة", name: "2-Basra", code: "BAS-02", notes: "مندوب منطقة البصرة 2" },
    { governorate: "البصرة", name: "3-Basra", code: "BAS-03", notes: "مندوب منطقة البصرة 3" },
    { governorate: "البصرة", name: "4-Basra", code: "BAS-04", notes: "مندوب منطقة البصرة 4" },
    { governorate: "البصرة", name: "5-Basra", code: "BAS-05", notes: "مندوب منطقة البصرة 5" },
    { governorate: "البصرة", name: "6-Basra", code: "BAS-06", notes: "مندوب منطقة البصرة 6" },
    { governorate: "البصرة", name: "7-Basra", code: "BAS-07", notes: "مندوب منطقة البصرة 7" },
    { governorate: "الناصرية", name: "مذخر الناصرية مباشر", code: "NAS-DIR", notes: "توزيع مباشر" },
    { governorate: "الناصرية", name: "1-Nasiriya", code: "NAS-01", notes: "مندوب منطقة الناصرية 1" },
    { governorate: "الناصرية", name: "2-Nasiriya", code: "NAS-02", notes: "مندوب منطقة الناصرية 2" },
    { governorate: "الناصرية", name: "3-Nasiriya", code: "NAS-03", notes: "مندوب منطقة الناصرية 3" },
    { governorate: "الناصرية", name: "4-Nasiriya", code: "NAS-04", notes: "مندوب منطقة الناصرية 4" },
    { governorate: "الناصرية", name: "5-Nasiriya", code: "NAS-05", notes: "مندوب منطقة الناصرية 5" },
    { governorate: "الناصرية", name: "6-Nasiriya", code: "NAS-06", notes: "مندوب منطقة الناصرية 6" },
    { governorate: "الناصرية", name: "7-Nasiriya", code: "NAS-07", notes: "مندوب منطقة الناصرية 7" },
  ];

  const products: ProductMetadata[] = [
    { item: "Ceftriaxone Vial 1 g IM", unitPrice: 3610, company: "LDP" },
    { item: "Ceftriaxone Vial 1 g IV", unitPrice: 3610, company: "LDP" },
    { item: "Ceftriaxone Vial 0.5 g IM/IV", unitPrice: 2475, company: "LDP" },
    { item: "Ceftriaxone Vial 0.5 g IM", unitPrice: 2062, company: "LDP" },
    { item: "Ceftriaxone Vial 0.25 g IM/IV", unitPrice: 2062, company: "LDP" },
    { item: "Cefotaxime Vial 1 g IM", unitPrice: 3093, company: "LDP" },
    { item: "Cefotaxime Vial 1 g IV", unitPrice: 3093, company: "LDP" },
    { item: "Cefotaxime Vial 0.5 g IM/IV", unitPrice: 2062, company: "LDP" },
    { item: "Ceftazidime Vial 1 g IM", unitPrice: 4743, company: "LDP" },
    { item: "Ceftazidime Vial 1 g IV", unitPrice: 4743, company: "LDP" },
    { item: "Nefopam Medisol 20 mg/2 ml Amp IM/IV", unitPrice: 21257, company: "LDP" },
    { item: "Meropenem Vial 1 g IV", unitPrice: 12022, company: "LDP" },
    { item: "Cefepime Vial 1 g IM/IV", unitPrice: 7012, company: "LDP" },
    { item: "Amitron Vial 0.5 g IM/IV", unitPrice: 1932, company: "LDP" },
    { item: "Azoxine 250 mg tab", unitPrice: 3999, company: "LDP" },
    { item: "Co-Amoxiclav 625 mg tab", unitPrice: 7734, company: "LDP" },
    { item: "Amitron cap 500 mg", unitPrice: 13044, company: "LDP" },
    { item: "Augmentin 625 mg", unitPrice: 7837, company: "MEDREICH" },
    { item: "Augmentin 1000 mg (20 tab)", unitPrice: 5775, company: "MEDREICH" },
    { item: "Amoxicillin cap 500 mg", unitPrice: 3547, company: "MEDREICH" },
    { item: "Amoxicillin & Clavulanate 457 mg/5 ml", unitPrice: 3093, company: "MEDREICH" },
    { item: "Amoxicillin & Clavulanate 312 mg/5 ml", unitPrice: 3609, company: "MEDREICH" },
    { item: "Loratadine tab", unitPrice: 1237, company: "MEDREICH" },
    { item: "Gabapentin 300 mg × 10 tab", unitPrice: 7218, company: "MEDREICH" },
    { item: "Gabapentin 100 mg × 10 cap", unitPrice: 6600, company: "MEDREICH" },
    { item: "Bisacodyl 5 mg × 10 cap", unitPrice: 3090, company: "MEDREICH" },
  ];

  const targets: MonthlyTargetRecord[] = [
    { year: 2026, month: 8, governorate: "الكوت", targetAmount: 25000000, notes: "هدف شهر آب 2026" },
    { year: 2026, month: 8, governorate: "العمارة", targetAmount: 20000000, notes: "هدف شهر آب 2026" },
    { year: 2026, month: 8, governorate: "البصرة", targetAmount: 35000000, notes: "هدف شهر آب 2026" },
    { year: 2026, month: 8, governorate: "الناصرية", targetAmount: 22000000, notes: "هدف شهر آب 2026" },
    { year: 2026, month: 9, governorate: "الكوت", targetAmount: 28000000, notes: "هدف شهر أيلول 2026" },
    { year: 2026, month: 9, governorate: "العمارة", targetAmount: 22000000, notes: "هدف شهر أيلول 2026" },
    { year: 2026, month: 9, governorate: "البصرة", targetAmount: 40000000, notes: "هدف شهر أيلول 2026" },
    { year: 2026, month: 9, governorate: "الناصرية", targetAmount: 25000000, notes: "هدف شهر أيلول 2026" },
  ];

  // Exact 25 sales records from the 4 governorate sheets
  const sales: UnifiedSaleRecord[] = [
    // الكوت (7 completed + 2 incomplete)
    { id: "sale-kut-1", delegateName: "1-Kut", governorate: "الكوت", company: "LDP", item: "Ceftriaxone Vial 1 g IM", quantity: 500, unitPrice: 3610, totalAmount: 1805000, date: "15/08/2026", governorateTarget: 25000000, achievementRate: 0.0722, sheetSource: "سجلات الكوت", status: "valid", anomalies: [] },
    { id: "sale-kut-2", delegateName: "2-Kut", governorate: "الكوت", company: "MEDREICH", item: "Augmentin 625 mg", quantity: 400, unitPrice: 7837, totalAmount: 3134800, date: "16/08/2026", governorateTarget: 25000000, achievementRate: 0.1254, sheetSource: "سجلات الكوت", status: "valid", anomalies: [] },
    { id: "sale-kut-3", delegateName: "مذخر الكوت مباشر", governorate: "الكوت", company: "LDP", item: "Cefotaxime Vial 1 g IM", quantity: 800, unitPrice: 3093, totalAmount: 2474400, date: "17/08/2026", governorateTarget: 25000000, achievementRate: 0.0990, sheetSource: "سجلات الكوت", status: "valid", anomalies: [] },
    { id: "sale-kut-4", delegateName: "3-Kut", governorate: "الكوت", company: "MEDREICH", item: "Gabapentin 300 mg × 10 tab", quantity: 350, unitPrice: 7218, totalAmount: 2526300, date: "18/08/2026", governorateTarget: 25000000, achievementRate: 0.1011, sheetSource: "سجلات الكوت", status: "valid", anomalies: [] },
    { id: "sale-kut-5", delegateName: "4-Kut", governorate: "الكوت", company: "LDP", item: "Ceftazidime Vial 1 g IM", quantity: 600, unitPrice: 4743, totalAmount: 2845800, date: "19/08/2026", governorateTarget: 25000000, achievementRate: 0.1138, sheetSource: "سجلات الكوت", status: "valid", anomalies: [] },
    { id: "sale-kut-6", delegateName: "5-Kut", governorate: "الكوت", company: "LDP", item: "Co-Amoxiclav 625 mg tab", quantity: 2222, unitPrice: 7734, totalAmount: 17184948, date: "20/08/2026", governorateTarget: 25000000, achievementRate: 0.6874, sheetSource: "سجلات الكوت", status: "valid", anomalies: [] },
    { id: "sale-kut-7", delegateName: "6-Kut", governorate: "الكوت", company: "MEDREICH", item: "Bisacodyl 5 mg × 10 cap", quantity: 11, unitPrice: 3090, totalAmount: 33990, date: "21/08/2026", governorateTarget: 25000000, achievementRate: 0.0014, sheetSource: "سجلات الكوت", status: "valid", anomalies: [] },
    { id: "sale-kut-8", delegateName: "1-Kut", governorate: "الكوت", company: "MEDREICH", item: "Amoxicillin & Clavulanate 312 mg/5 ml", quantity: 11, unitPrice: 3609, totalAmount: 39699, date: "", governorateTarget: 25000000, achievementRate: 0.0016, sheetSource: "سجلات الكوت", status: "incomplete", anomalies: ["التاريخ مفقود"] },
    { id: "sale-kut-9", delegateName: "1-Kut", governorate: "الكوت", company: "LDP", item: "Bisacodyl 5 mg × 10 cap", quantity: 11, unitPrice: 3090, totalAmount: 33990, date: "", governorateTarget: 25000000, achievementRate: 0.0014, sheetSource: "سجلات الكوت", status: "incomplete", anomalies: ["التاريخ مفقود"] },

    // العمارة (4 completed + 3 incomplete)
    { id: "sale-amr-1", delegateName: "1-Amara", governorate: "العمارة", company: "LDP", item: "Ceftriaxone Vial 0.5 g IM/IV", quantity: 400, unitPrice: 2475, totalAmount: 990000, date: "15/08/2026", governorateTarget: 20000000, achievementRate: 0.0495, sheetSource: "سجلات العمارة", status: "valid", anomalies: [] },
    { id: "sale-amr-2", delegateName: "2-Amara", governorate: "العمارة", company: "MEDREICH", item: "Augmentin 1000 mg (20 tab)", quantity: 300, unitPrice: 5775, totalAmount: 1732500, date: "16/08/2026", governorateTarget: 20000000, achievementRate: 0.0866, sheetSource: "سجلات العمارة", status: "valid", anomalies: [] },
    { id: "sale-amr-3", delegateName: "مذخر العمارة مباشر", governorate: "العمارة", company: "LDP", item: "Cefepime Vial 1 g IM/IV", quantity: 700, unitPrice: 7012, totalAmount: 4908400, date: "17/08/2026", governorateTarget: 20000000, achievementRate: 0.2454, sheetSource: "سجلات العمارة", status: "valid", anomalies: [] },
    { id: "sale-amr-4", delegateName: "3-Amara", governorate: "العمارة", company: "MEDREICH", item: "Loratadine tab", quantity: 250, unitPrice: 1237, totalAmount: 309250, date: "18/08/2026", governorateTarget: 20000000, achievementRate: 0.0155, sheetSource: "سجلات العمارة", status: "valid", anomalies: [] },
    { id: "sale-amr-5", delegateName: "غير محدد", governorate: "العمارة", company: "LDP", item: "Ceftriaxone Vial 1 g IV", quantity: 11, unitPrice: 3610, totalAmount: 39710, date: "", governorateTarget: 20000000, achievementRate: 0.0020, sheetSource: "سجلات العمارة", status: "incomplete", anomalies: ["المندوب مفقود", "التاريخ مفقود"] },
    { id: "sale-amr-6", delegateName: "1-Amara", governorate: "العمارة", company: "LDP", item: "Ceftriaxone Vial 1 g IM", quantity: 11, unitPrice: 3610, totalAmount: 39710, date: "", governorateTarget: 20000000, achievementRate: 0.0020, sheetSource: "سجلات العمارة", status: "incomplete", anomalies: ["التاريخ مفقود"] },
    { id: "sale-amr-7", delegateName: "2-Amara", governorate: "العمارة", company: "LDP", item: "Amitron cap 500 mg", quantity: 11, unitPrice: 13044, totalAmount: 143484, date: "", governorateTarget: 20000000, achievementRate: 0.0072, sheetSource: "سجلات العمارة", status: "incomplete", anomalies: ["التاريخ مفقود"] },

    // البصرة (5 completed)
    { id: "sale-bas-1", delegateName: "1-Basra", governorate: "البصرة", company: "LDP", item: "Ceftazidime Vial 1 g IV", quantity: 1200, unitPrice: 4743, totalAmount: 5691600, date: "15/08/2026", governorateTarget: 35000000, achievementRate: 0.1626, sheetSource: "سجلات البصرة", status: "valid", anomalies: [] },
    { id: "sale-bas-2", delegateName: "2-Basra", governorate: "البصرة", company: "MEDREICH", item: "Amoxicillin cap 500 mg", quantity: 800, unitPrice: 3547, totalAmount: 2837600, date: "16/08/2026", governorateTarget: 35000000, achievementRate: 0.0811, sheetSource: "سجلات البصرة", status: "valid", anomalies: [] },
    { id: "sale-bas-3", delegateName: "مذخر البصرة مباشر", governorate: "البصرة", company: "LDP", item: "Meropenem Vial 1 g IV", quantity: 2000, unitPrice: 12022, totalAmount: 24044000, date: "17/08/2026", governorateTarget: 35000000, achievementRate: 0.6870, sheetSource: "سجلات البصرة", status: "valid", anomalies: [] },
    { id: "sale-bas-4", delegateName: "3-Basra", governorate: "البصرة", company: "MEDREICH", item: "Gabapentin 100 mg × 10 cap", quantity: 600, unitPrice: 6600, totalAmount: 3960000, date: "18/08/2026", governorateTarget: 35000000, achievementRate: 0.1131, sheetSource: "سجلات البصرة", status: "valid", anomalies: [] },
    { id: "sale-bas-5", delegateName: "4-Basra", governorate: "البصرة", company: "LDP", item: "Cefotaxime Vial 1 g IV", quantity: 900, unitPrice: 1932, totalAmount: 1738800, date: "19/08/2026", governorateTarget: 35000000, achievementRate: 0.0497, sheetSource: "سجلات البصرة", status: "valid", anomalies: [] },

    // الناصرية (5 completed)
    { id: "sale-nas-1", delegateName: "1-Nasiriya", governorate: "الناصرية", company: "LDP", item: "Azoxine 250 mg tab", quantity: 600, unitPrice: 3999, totalAmount: 2399400, date: "15/08/2026", governorateTarget: 22000000, achievementRate: 0.1091, sheetSource: "سجلات الناصرية", status: "valid", anomalies: [] },
    { id: "sale-nas-2", delegateName: "2-Nasiriya", governorate: "الناصرية", company: "MEDREICH", item: "Amoxicillin & Clavulanate 457 mg/5 ml", quantity: 500, unitPrice: 3093, totalAmount: 1546500, date: "16/08/2026", governorateTarget: 22000000, achievementRate: 0.0703, sheetSource: "سجلات الناصرية", status: "valid", anomalies: [] },
    { id: "sale-nas-3", delegateName: "مذخر الناصرية مباشر", governorate: "الناصرية", company: "LDP", item: "Co-Amoxiclav 625 mg tab", quantity: 1000, unitPrice: 7734, totalAmount: 7734000, date: "17/08/2026", governorateTarget: 22000000, achievementRate: 0.3515, sheetSource: "سجلات الناصرية", status: "valid", anomalies: [] },
    { id: "sale-nas-4", delegateName: "3-Nasiriya", governorate: "الناصرية", company: "MEDREICH", item: "Amoxicillin & Clavulanate 312 mg/5 ml", quantity: 400, unitPrice: 3609, totalAmount: 1443600, date: "18/08/2026", governorateTarget: 22000000, achievementRate: 0.0656, sheetSource: "سجلات الناصرية", status: "valid", anomalies: [] },
    { id: "sale-nas-5", delegateName: "4-Nasiriya", governorate: "الناصرية", company: "LDP", item: "Bisacodyl 5 mg × 10 cap", quantity: 333, unitPrice: 3090, totalAmount: 1028970, date: "19/08/2026", governorateTarget: 22000000, achievementRate: 0.0468, sheetSource: "سجلات الناصرية", status: "valid", anomalies: [] },
  ];

  const dataHealth = computeDataHealthReport(sales, 6);
  const months = extractAvailableMonths(targets, sales);

  return {
    salesRecords: sales,
    delegates,
    products,
    targets,
    dataHealth,
    lastUpdated: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    sourceType: "offline-baseline",
    sourceUrl,
    availableMonths: months,
    availableGovernorates: ["الكوت", "العمارة", "البصرة", "الناصرية"],
    availableCompanies: ["LDP", "MEDREICH"],
    availableDelegates: Array.from(new Set(sales.map((s) => s.delegateName))),
    availableProducts: Array.from(new Set(products.map((p) => p.item))),
  };
}
