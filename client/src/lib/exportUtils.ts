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

export function escapeHtml(value: unknown): string {
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
  return `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;direction:rtl;font-family:Arial,sans-serif}th,td{border:1px solid #cbd5e1;padding:8px;text-align:right}th{background:#0f766e;color:#fff;font-weight:700}</style></head><body dir="rtl"><h2>تقرير الفواتير - نظام غدير المحاسبي</h2><table><thead><tr>${exportHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function buildPrintTitle() {
  return "تقرير الفواتير - نظام غدير المحاسبي";
}

export function downloadExcelFile(filename: string, htmlContent: string) {
  const blob = new Blob(["\uFEFF" + htmlContent], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ActiveFilters = {
  governorate?: string;
  company?: string;
  representative?: string;
  material?: string;
};

export type KpiSummary = {
  warehouseUnits: number;
  warehouseAmount: number;
  repUnits: number;
  repAmount: number;
  directUnits: number;
  salesCount: number;
};

export type TargetAchievementRow = {
  governorate: string;
  targetQuantity: number;
  sold: number;
  percent: number;
};

export type RankingRow = {
  name: string;
  quantity: number;
  amount?: number;
  percent?: number;
};

export type DetailedSaleRow = {
  saleDate: string;
  governorate: string;
  representative: string;
  company: string;
  material: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  supervisor?: string;
};

export type DetailedBatchRow = {
  saleDate: string;
  governorate: string;
  company: string;
  material: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  createdByName?: string;
  note?: string;
};

export type LegacyRow = {
  saleDate: string;
  governorate: string;
  quantity: number;
  amount?: number | null;
  note?: string;
  createdByName?: string;
};

export type StatisticsExportData = {
  periodLabel: string;
  activeFilters?: ActiveFilters;
  kpis: KpiSummary;
  targetRows?: TargetAchievementRow[];
  repRanking?: RankingRow[];
  govRanking?: RankingRow[];
  materialRanking?: RankingRow[];
  sales?: DetailedSaleRow[];
  batches?: DetailedBatchRow[];
};

export type SalesHistoryExportData = {
  periodLabel: string;
  activeFilters?: ActiveFilters;
  kpis: KpiSummary;
  sales: DetailedSaleRow[];
  batches: DetailedBatchRow[];
  legacy?: LegacyRow[];
};

const num = (v: number) => Number(v || 0).toLocaleString("en-US");
const money = (v: number) => `${num(v)} د.ع`;

export function buildStatisticsExcelHtml(data: StatisticsExportData): string {
  const exportDate = new Date().toLocaleString("ar-IQ", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const filterSummary = [
    `الفترة: ${data.periodLabel}`,
    `المحافظة: ${data.activeFilters?.governorate || "كل المحافظات"}`,
    `الشركة: ${data.activeFilters?.company || "كل الشركات"}`,
    `المندوب: ${data.activeFilters?.representative || "كل المندوبين"}`,
    `المادة: ${data.activeFilters?.material || "كل المواد"}`,
    `تاريخ التصدير: ${exportDate}`,
  ];

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>إحصائيات المبيعات والأداء</x:Name>
    <x:WorksheetOptions>
     <x:DisplayRightToLeft/>
     <x:DoNotDisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; margin: 0; padding: 12px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 22px; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 10px; font-size: 10pt; text-align: right; vertical-align: middle; }
  th { background-color: #0f766e; color: #ffffff; font-weight: bold; text-align: center; }
  .banner-brand { background-color: #064e3b; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; padding: 14px; border: none; }
  .banner-sub { background-color: #0f766e; color: #ccfbf1; font-size: 10.5pt; text-align: center; padding: 6px; border: none; }
  .meta-table td { background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 9.5pt; font-weight: 600; padding: 8px 12px; }
  .kpi-head { background-color: #1e293b; color: #f8fafc; font-size: 9.5pt; font-weight: bold; text-align: center; }
  .kpi-cell { background-color: #f8fafc; text-align: center; padding: 12px 8px; border: 1px solid #cbd5e1; }
  .kpi-val { font-size: 14pt; font-weight: bold; color: #0f766e; display: block; margin-bottom: 4px; }
  .kpi-note { font-size: 8.5pt; color: #64748b; display: block; }
  .section-title { background-color: #134e4a; color: #ffffff; font-size: 11.5pt; font-weight: bold; text-align: right; padding: 8px 12px; }
  .row-even { background-color: #ffffff; }
  .row-odd { background-color: #f8fafc; }
  .center { text-align: center; }
  .num-val { text-align: center; mso-number-format: "\\#\\,\\#\\#0"; }
  .currency-val { text-align: right; }
  .total-row td { background-color: #e2e8f0; font-weight: bold; color: #0f172a; border-top: 2px solid #0f766e; border-bottom: 3px double #0f766e; }
  .badge-target-full { background-color: #dcfce7; color: #15803d; font-weight: bold; text-align: center; }
  .badge-target-near { background-color: #fef9c3; color: #a16207; font-weight: bold; text-align: center; }
  .badge-target-low { background-color: #fee2e2; color: #b91c1c; font-weight: bold; text-align: center; }
</style>
</head>
<body dir="rtl">

<!-- Main Corporate Header -->
<table>
  <tr>
    <td colspan="6" class="banner-brand">نظام غدير المحاسبي - تقرير إحصائيات المبيعات والأداء</td>
  </tr>
  <tr>
    <td colspan="6" class="banner-sub">تقرير رسمي وتحليلي لحركة المبيعات وخروج المذاخر والأهداف</td>
  </tr>
</table>

<!-- Filter & Generation Metadata -->
<table class="meta-table">
  <tr>
    <td colspan="2"><strong>الفترة الزمنية:</strong> ${escapeHtml(data.periodLabel)}</td>
    <td colspan="2"><strong>المحافظة:</strong> ${escapeHtml(data.activeFilters?.governorate || "كل المحافظات")}</td>
    <td colspan="2"><strong>الشركة:</strong> ${escapeHtml(data.activeFilters?.company || "كل الشركات")}</td>
  </tr>
  <tr>
    <td colspan="2"><strong>المندوب:</strong> ${escapeHtml(data.activeFilters?.representative || "كل المندوبين")}</td>
    <td colspan="2"><strong>المادة:</strong> ${escapeHtml(data.activeFilters?.material || "كل المواد")}</td>
    <td colspan="2"><strong>تاريخ ووقت الاستخراج:</strong> ${escapeHtml(exportDate)}</td>
  </tr>
</table>

<!-- Executive KPI Summary Cards -->
<table>
  <tr>
    <th class="kpi-head" style="width: 25%;">إجمالي خروج المذخر</th>
    <th class="kpi-head" style="width: 25%;">مبيعات المندوبين</th>
    <th class="kpi-head" style="width: 25%;">صافي البيع المباشر من المذخر</th>
    <th class="kpi-head" style="width: 25%;">عدد عمليات المندوبين</th>
  </tr>
  <tr>
    <td class="kpi-cell">
      <span class="kpi-val">${num(data.kpis.warehouseUnits)} قطعة</span>
      <span class="kpi-note">${money(data.kpis.warehouseAmount)}</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-val">${num(data.kpis.repUnits)} قطعة</span>
      <span class="kpi-note">${money(data.kpis.repAmount)}</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-val">${num(data.kpis.directUnits)} قطعة</span>
      <span class="kpi-note">إجمالي المذخر − مبيعات المندوبين</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-val">${num(data.kpis.salesCount)} عملية</span>
      <span class="kpi-note">إدخال بيع مسجل</span>
    </td>
  </tr>
</table>`;

  // Target Achievements Table (if available)
  if (data.targetRows && data.targetRows.length > 0) {
    const totalTarget = data.targetRows.reduce((s, r) => s + r.targetQuantity, 0);
    const totalSold = data.targetRows.reduce((s, r) => s + r.sold, 0);
    const overallPercent = totalTarget ? Math.round((totalSold / totalTarget) * 100) : 0;

    html += `
<table>
  <thead>
    <tr>
      <th colspan="6" class="section-title">📊 تحقيق أهداف المحافظات (Targets Achievement)</th>
    </tr>
    <tr>
      <th style="width: 5%;">#</th>
      <th style="width: 30%;">المحافظة</th>
      <th style="width: 20%;">الهدف المحدد (قطعة)</th>
      <th style="width: 20%;">المتحقق الفعلي (قطعة)</th>
      <th style="width: 12%;">نسبة الإنجاز</th>
      <th style="width: 13%;">حالة الهدف</th>
    </tr>
  </thead>
  <tbody>
    ${data.targetRows.map((r, i) => {
      const isEven = i % 2 === 0;
      const badgeClass = r.percent >= 100 ? "badge-target-full" : r.percent >= 70 ? "badge-target-near" : "badge-target-low";
      const statusLabel = r.percent >= 100 ? "مكتمل بنجاح 🎯" : r.percent >= 70 ? "قريب من الهدف ⚡" : "قيد الإنجاز ⏳";
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center">${i + 1}</td>
        <td><strong>${escapeHtml(r.governorate)}</strong></td>
        <td class="num-val">${num(r.targetQuantity)}</td>
        <td class="num-val">${num(r.sold)}</td>
        <td class="center"><strong>${r.percent}%</strong></td>
        <td class="${badgeClass}">${statusLabel}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="2" class="center">الإجمالي العام للأهداف</td>
      <td class="num-val">${num(totalTarget)}</td>
      <td class="num-val">${num(totalSold)}</td>
      <td class="center">${overallPercent}%</td>
      <td class="center">${overallPercent >= 100 ? "مكتمل" : "إجمالي"}</td>
    </tr>
  </tbody>
</table>`;
  }

  // Representative Rankings
  if (data.repRanking && data.repRanking.length > 0) {
    const totalUnits = data.repRanking.reduce((s, r) => s + r.quantity, 0);
    const totalAmount = data.repRanking.reduce((s, r) => s + (r.amount || 0), 0);

    html += `
<table>
  <thead>
    <tr>
      <th colspan="5" class="section-title">🏆 تصنيف وأداء المندوبين (Top Sales Representatives)</th>
    </tr>
    <tr>
      <th style="width: 7%;">الترتيب</th>
      <th style="width: 35%;">اسم المندوب</th>
      <th style="width: 20%;">كمية المبيعات (قطعة)</th>
      <th style="width: 15%;">نسبة المساهمة</th>
      <th style="width: 23%;">إجمالي المبيعات (د.ع)</th>
    </tr>
  </thead>
  <tbody>
    ${data.repRanking.map((r, i) => {
      const isEven = i % 2 === 0;
      const share = totalUnits ? ((r.quantity / totalUnits) * 100).toFixed(1) : "0.0";
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center"><strong>${i + 1}</strong></td>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td class="num-val">${num(r.quantity)}</td>
        <td class="center">${share}%</td>
        <td class="currency-val">${r.amount != null ? money(r.amount) : "—"}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="2" class="center">مجموع مبيعات المندوبين</td>
      <td class="num-val">${num(totalUnits)}</td>
      <td class="center">100%</td>
      <td class="currency-val">${money(totalAmount)}</td>
    </tr>
  </tbody>
</table>`;
  }

  // Governorate Rankings
  if (data.govRanking && data.govRanking.length > 0) {
    const totalGovUnits = data.govRanking.reduce((s, r) => s + r.quantity, 0);
    const totalGovAmount = data.govRanking.reduce((s, r) => s + (r.amount || 0), 0);

    html += `
<table>
  <thead>
    <tr>
      <th colspan="5" class="section-title">📍 توزيع وخروج المبيعات حسب المحافظات (Sales by Governorate)</th>
    </tr>
    <tr>
      <th style="width: 7%;">الترتيب</th>
      <th style="width: 35%;">المحافظة</th>
      <th style="width: 20%;">إجمالي القطع المخرجة</th>
      <th style="width: 15%;">نسبة المساهمة</th>
      <th style="width: 23%;">إجمالي القيمة (د.ع)</th>
    </tr>
  </thead>
  <tbody>
    ${data.govRanking.map((r, i) => {
      const isEven = i % 2 === 0;
      const share = totalGovUnits ? ((r.quantity / totalGovUnits) * 100).toFixed(1) : "0.0";
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center"><strong>${i + 1}</strong></td>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td class="num-val">${num(r.quantity)}</td>
        <td class="center">${share}%</td>
        <td class="currency-val">${r.amount != null ? money(r.amount) : "—"}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="2" class="center">مجموع المحافظات</td>
      <td class="num-val">${num(totalGovUnits)}</td>
      <td class="center">100%</td>
      <td class="currency-val">${money(totalGovAmount)}</td>
    </tr>
  </tbody>
</table>`;
  }

  // Material Rankings
  if (data.materialRanking && data.materialRanking.length > 0) {
    const totalMatUnits = data.materialRanking.reduce((s, r) => s + r.quantity, 0);
    const totalMatAmount = data.materialRanking.reduce((s, r) => s + (r.amount || 0), 0);

    html += `
<table>
  <thead>
    <tr>
      <th colspan="5" class="section-title">📦 المواد والمنتجات الأكثر حركة (Top Moving Materials)</th>
    </tr>
    <tr>
      <th style="width: 7%;">الترتيب</th>
      <th style="width: 35%;">المادة / المنتج</th>
      <th style="width: 20%;">الكمية المباعة (قطعة)</th>
      <th style="width: 15%;">نسبة الحركة</th>
      <th style="width: 23%;">إجمالي القيمة (د.ع)</th>
    </tr>
  </thead>
  <tbody>
    ${data.materialRanking.map((r, i) => {
      const isEven = i % 2 === 0;
      const share = totalMatUnits ? ((r.quantity / totalMatUnits) * 100).toFixed(1) : "0.0";
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center"><strong>${i + 1}</strong></td>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td class="num-val">${num(r.quantity)}</td>
        <td class="center">${share}%</td>
        <td class="currency-val">${r.amount != null ? money(r.amount) : "—"}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="2" class="center">مجموع المواد</td>
      <td class="num-val">${num(totalMatUnits)}</td>
      <td class="center">100%</td>
      <td class="currency-val">${money(totalMatAmount)}</td>
    </tr>
  </tbody>
</table>`;
  }

  // Detailed Sales Transactions Log
  if (data.sales && data.sales.length > 0) {
    const totalSalesUnits = data.sales.reduce((s, r) => s + r.quantity, 0);
    const totalSalesAmount = data.sales.reduce((s, r) => s + r.totalAmount, 0);

    html += `
<table>
  <thead>
    <tr>
      <th colspan="10" class="section-title">📝 السجل التفصيلي لعمليات مبيعات المندوبين (${num(data.sales.length)} عملية)</th>
    </tr>
    <tr>
      <th style="width: 4%;">#</th>
      <th style="width: 9%;">التاريخ</th>
      <th style="width: 11%;">المحافظة</th>
      <th style="width: 13%;">المندوب</th>
      <th style="width: 13%;">الشركة</th>
      <th style="width: 16%;">المادة</th>
      <th style="width: 7%;">القطع</th>
      <th style="width: 10%;">سعر القطعة</th>
      <th style="width: 11%;">الإجمالي (د.ع)</th>
      <th style="width: 6%;">المشرف</th>
    </tr>
  </thead>
  <tbody>
    ${data.sales.map((sale, i) => {
      const isEven = i % 2 === 0;
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center">${i + 1}</td>
        <td class="center">${escapeHtml(sale.saleDate)}</td>
        <td>${escapeHtml(sale.governorate)}</td>
        <td><strong>${escapeHtml(sale.representative)}</strong></td>
        <td>${escapeHtml(sale.company)}</td>
        <td>${escapeHtml(sale.material)}</td>
        <td class="num-val">${num(sale.quantity)}</td>
        <td class="currency-val">${money(sale.unitPrice)}</td>
        <td class="currency-val"><strong>${money(sale.totalAmount)}</strong></td>
        <td class="center">${escapeHtml(sale.supervisor || "—")}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="6" class="center">مجموع العمليات المسجلة</td>
      <td class="num-val">${num(totalSalesUnits)}</td>
      <td></td>
      <td class="currency-val">${money(totalSalesAmount)}</td>
      <td></td>
    </tr>
  </tbody>
</table>`;
  }

  // Detailed Warehouse Batches Log
  if (data.batches && data.batches.length > 0) {
    const totalBatchUnits = data.batches.reduce((s, r) => s + r.quantity, 0);
    const totalBatchAmount = data.batches.reduce((s, r) => s + r.totalAmount, 0);

    html += `
<table>
  <thead>
    <tr>
      <th colspan="9" class="section-title">🏢 السجل التفصيلي لمبيعات وخروج المذاخر (${num(data.batches.length)} بند)</th>
    </tr>
    <tr>
      <th style="width: 4%;">#</th>
      <th style="width: 10%;">التاريخ</th>
      <th style="width: 12%;">المحافظة</th>
      <th style="width: 14%;">الشركة</th>
      <th style="width: 18%;">المادة</th>
      <th style="width: 8%;">القطع</th>
      <th style="width: 10%;">سعر القطعة</th>
      <th style="width: 12%;">الإجمالي (د.ع)</th>
      <th style="width: 12%;">الملاحظات / المدخل</th>
    </tr>
  </thead>
  <tbody>
    ${data.batches.map((batch, i) => {
      const isEven = i % 2 === 0;
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center">${i + 1}</td>
        <td class="center">${escapeHtml(batch.saleDate)}</td>
        <td>${escapeHtml(batch.governorate)}</td>
        <td>${escapeHtml(batch.company)}</td>
        <td>${escapeHtml(batch.material)}</td>
        <td class="num-val">${num(batch.quantity)}</td>
        <td class="currency-val">${money(batch.unitPrice)}</td>
        <td class="currency-val"><strong>${money(batch.totalAmount)}</strong></td>
        <td>${escapeHtml([batch.createdByName, batch.note].filter(Boolean).join(" - ") || "—")}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="5" class="center">مجموع خروج المذاخر</td>
      <td class="num-val">${num(totalBatchUnits)}</td>
      <td></td>
      <td class="currency-val">${money(totalBatchAmount)}</td>
      <td></td>
    </tr>
  </tbody>
</table>`;
  }

  html += `
<p style="font-size: 8pt; color: #94a3b8; text-align: center; margin-top: 24px;">
  تم إنشاء هذا التقرير آلياً عبر نظام غدير المحاسبي · تاريخ التصدير: ${escapeHtml(exportDate)}
</p>
</body>
</html>`;

  return html;
}

export function buildSalesHistoryExcelHtml(data: SalesHistoryExportData): string {
  const exportDate = new Date().toLocaleString("ar-IQ", {
    dateStyle: "full",
    timeStyle: "short",
  });

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>سجل المبيعات</x:Name>
    <x:WorksheetOptions>
     <x:DisplayRightToLeft/>
     <x:DoNotDisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; margin: 0; padding: 12px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 22px; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 10px; font-size: 10pt; text-align: right; vertical-align: middle; }
  th { background-color: #0f766e; color: #ffffff; font-weight: bold; text-align: center; }
  .banner-brand { background-color: #064e3b; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; padding: 14px; border: none; }
  .banner-sub { background-color: #0f766e; color: #ccfbf1; font-size: 10.5pt; text-align: center; padding: 6px; border: none; }
  .meta-table td { background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 9.5pt; font-weight: 600; padding: 8px 12px; }
  .kpi-head { background-color: #1e293b; color: #f8fafc; font-size: 9.5pt; font-weight: bold; text-align: center; }
  .kpi-cell { background-color: #f8fafc; text-align: center; padding: 12px 8px; border: 1px solid #cbd5e1; }
  .kpi-val { font-size: 14pt; font-weight: bold; color: #0f766e; display: block; margin-bottom: 4px; }
  .kpi-note { font-size: 8.5pt; color: #64748b; display: block; }
  .section-title { background-color: #134e4a; color: #ffffff; font-size: 11.5pt; font-weight: bold; text-align: right; padding: 8px 12px; }
  .row-even { background-color: #ffffff; }
  .row-odd { background-color: #f8fafc; }
  .center { text-align: center; }
  .num-val { text-align: center; mso-number-format: "\\#\\,\\#\\#0"; }
  .currency-val { text-align: right; }
  .total-row td { background-color: #e2e8f0; font-weight: bold; color: #0f172a; border-top: 2px solid #0f766e; border-bottom: 3px double #0f766e; }
</style>
</head>
<body dir="rtl">

<table>
  <tr>
    <td colspan="6" class="banner-brand">نظام غدير المحاسبي - سجل المبيعات وحركات المذاخر</td>
  </tr>
  <tr>
    <td colspan="6" class="banner-sub">تقرير تفصيلي لعمليات بيع المندوبين وإدخالات المذاخر</td>
  </tr>
</table>

<table class="meta-table">
  <tr>
    <td colspan="2"><strong>الفترة الزمنية:</strong> ${escapeHtml(data.periodLabel)}</td>
    <td colspan="2"><strong>المحافظة:</strong> ${escapeHtml(data.activeFilters?.governorate || "الكل")}</td>
    <td colspan="2"><strong>تاريخ التصدير:</strong> ${escapeHtml(exportDate)}</td>
  </tr>
  <tr>
    <td colspan="2"><strong>المندوب:</strong> ${escapeHtml(data.activeFilters?.representative || "الكل")}</td>
    <td colspan="2"><strong>المشرف:</strong> ${escapeHtml(data.activeFilters?.company || "الكل")}</td>
    <td colspan="2"><strong>المادة:</strong> ${escapeHtml(data.activeFilters?.material || "الكل")}</td>
  </tr>
</table>

<table>
  <tr>
    <th class="kpi-head" style="width: 25%;">إجمالي خروج المذخر</th>
    <th class="kpi-head" style="width: 25%;">مبيعات المندوبين</th>
    <th class="kpi-head" style="width: 25%;">صافي المباشر من المذخر</th>
    <th class="kpi-head" style="width: 25%;">عدد عمليات المندوبين</th>
  </tr>
  <tr>
    <td class="kpi-cell">
      <span class="kpi-val">${num(data.kpis.warehouseUnits)} قطعة</span>
      <span class="kpi-note">${money(data.kpis.warehouseAmount)}</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-val">${num(data.kpis.repUnits)} قطعة</span>
      <span class="kpi-note">${money(data.kpis.repAmount)}</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-val">${num(data.kpis.directUnits)} قطعة</span>
      <span class="kpi-note">إجمالي المذخر − مبيعات المندوبين</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-val">${num(data.kpis.salesCount)} عملية</span>
      <span class="kpi-note">مسجلة بالسجل</span>
    </td>
  </tr>
</table>`;

  // Sales
  if (data.sales && data.sales.length > 0) {
    const totalSalesUnits = data.sales.reduce((s, r) => s + r.quantity, 0);
    const totalSalesAmount = data.sales.reduce((s, r) => s + r.totalAmount, 0);

    html += `
<table>
  <thead>
    <tr>
      <th colspan="10" class="section-title">👥 مبيعات المندوبين (${num(data.sales.length)} عملية)</th>
    </tr>
    <tr>
      <th style="width: 4%;">#</th>
      <th style="width: 9%;">التاريخ</th>
      <th style="width: 11%;">المحافظة</th>
      <th style="width: 13%;">المندوب</th>
      <th style="width: 13%;">الشركة</th>
      <th style="width: 16%;">المادة</th>
      <th style="width: 7%;">القطع</th>
      <th style="width: 10%;">سعر القطعة</th>
      <th style="width: 11%;">الإجمالي (د.ع)</th>
      <th style="width: 6%;">المشرف</th>
    </tr>
  </thead>
  <tbody>
    ${data.sales.map((sale, i) => {
      const isEven = i % 2 === 0;
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center">${i + 1}</td>
        <td class="center">${escapeHtml(sale.saleDate)}</td>
        <td>${escapeHtml(sale.governorate)}</td>
        <td><strong>${escapeHtml(sale.representative)}</strong></td>
        <td>${escapeHtml(sale.company)}</td>
        <td>${escapeHtml(sale.material)}</td>
        <td class="num-val">${num(sale.quantity)}</td>
        <td class="currency-val">${money(sale.unitPrice)}</td>
        <td class="currency-val"><strong>${money(sale.totalAmount)}</strong></td>
        <td class="center">${escapeHtml(sale.supervisor || "—")}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="6" class="center">مجموع مبيعات المندوبين</td>
      <td class="num-val">${num(totalSalesUnits)}</td>
      <td></td>
      <td class="currency-val">${money(totalSalesAmount)}</td>
      <td></td>
    </tr>
  </tbody>
</table>`;
  }

  // Batches
  if (data.batches && data.batches.length > 0) {
    const totalBatchUnits = data.batches.reduce((s, r) => s + r.quantity, 0);
    const totalBatchAmount = data.batches.reduce((s, r) => s + r.totalAmount, 0);

    html += `
<table>
  <thead>
    <tr>
      <th colspan="9" class="section-title">🏢 مبيعات وخروج المذاخر (${num(data.batches.length)} بند)</th>
    </tr>
    <tr>
      <th style="width: 4%;">#</th>
      <th style="width: 10%;">التاريخ</th>
      <th style="width: 12%;">المحافظة</th>
      <th style="width: 14%;">الشركة</th>
      <th style="width: 18%;">المادة</th>
      <th style="width: 8%;">القطع</th>
      <th style="width: 10%;">سعر القطعة</th>
      <th style="width: 12%;">الإجمالي (د.ع)</th>
      <th style="width: 12%;">المدخل / الملاحظات</th>
    </tr>
  </thead>
  <tbody>
    ${data.batches.map((batch, i) => {
      const isEven = i % 2 === 0;
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center">${i + 1}</td>
        <td class="center">${escapeHtml(batch.saleDate)}</td>
        <td>${escapeHtml(batch.governorate)}</td>
        <td>${escapeHtml(batch.company)}</td>
        <td>${escapeHtml(batch.material)}</td>
        <td class="num-val">${num(batch.quantity)}</td>
        <td class="currency-val">${money(batch.unitPrice)}</td>
        <td class="currency-val"><strong>${money(batch.totalAmount)}</strong></td>
        <td>${escapeHtml([batch.createdByName, batch.note].filter(Boolean).join(" - ") || "—")}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="5" class="center">مجموع خروج المذاخر</td>
      <td class="num-val">${num(totalBatchUnits)}</td>
      <td></td>
      <td class="currency-val">${money(totalBatchAmount)}</td>
      <td></td>
    </tr>
  </tbody>
</table>`;
  }

  // Legacy
  if (data.legacy && data.legacy.length > 0) {
    const totalLegacyUnits = data.legacy.reduce((s, r) => s + r.quantity, 0);
    const totalLegacyAmount = data.legacy.reduce((s, r) => s + Number(r.amount || 0), 0);

    html += `
<table>
  <thead>
    <tr>
      <th colspan="6" class="section-title">📦 الإدخالات القديمة للمذاخر (بلا تفاصيل مواد) (${num(data.legacy.length)} إدخال)</th>
    </tr>
    <tr>
      <th style="width: 5%;">#</th>
      <th style="width: 15%;">التاريخ</th>
      <th style="width: 20%;">المحافظة</th>
      <th style="width: 15%;">القطع</th>
      <th style="width: 20%;">المبلغ (د.ع)</th>
      <th style="width: 25%;">المدخل / الملاحظة</th>
    </tr>
  </thead>
  <tbody>
    ${data.legacy.map((item, i) => {
      const isEven = i % 2 === 0;
      return `<tr class="${isEven ? "row-even" : "row-odd"}">
        <td class="center">${i + 1}</td>
        <td class="center">${escapeHtml(item.saleDate)}</td>
        <td>${escapeHtml(item.governorate)}</td>
        <td class="num-val">${num(item.quantity)}</td>
        <td class="currency-val">${item.amount != null ? money(Number(item.amount)) : "—"}</td>
        <td>${escapeHtml([item.createdByName, item.note].filter(Boolean).join(" - ") || "—")}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="3" class="center">مجموع الإدخالات القديمة</td>
      <td class="num-val">${num(totalLegacyUnits)}</td>
      <td class="currency-val">${money(totalLegacyAmount)}</td>
      <td></td>
    </tr>
  </tbody>
</table>`;
  }

  html += `
<p style="font-size: 8pt; color: #94a3b8; text-align: center; margin-top: 24px;">
  تم إنشاء هذا التقرير آلياً عبر نظام غدير المحاسبي · تاريخ التصدير: ${escapeHtml(exportDate)}
</p>
</body>
</html>`;

  return html;
}
