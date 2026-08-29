import type {
  CompanyPerformance,
  DashboardFilters,
  DelegatesDataset,
  GovernoratePerformance,
  MonthlyTarget,
  ProductPerformance,
  RepresentativePerformance,
  SaleRecord,
} from "./types";

export const EMPTY_FILTERS: DashboardFilters = {
  period: "all",
  governorate: "all",
  representative: "all",
  company: "all",
  product: "all",
  dateFrom: "",
  dateTo: "",
  search: "",
  issuesOnly: false,
};

export const GOVERNORATE_THRESHOLDS = {
  achieved: 100,
  near: 80,
  watching: 50,
} as const;

export function periodKey(date: string | null): string | null {
  return date ? `${date.slice(0, 4)}-${Number(date.slice(5, 7))}` : null;
}

export function getAvailablePeriods(dataset: DelegatesDataset): Array<{ key: string; year: number; month: number }> {
  const keys = new Set<string>();
  dataset.targets.forEach((target) => keys.add(`${target.year}-${target.month}`));
  dataset.sales.forEach((sale) => {
    const key = periodKey(sale.date);
    if (key) keys.add(key);
  });
  return Array.from(keys).map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { key, year, month };
  }).sort((a, b) => b.year - a.year || b.month - a.month);
}

export function getDefaultPeriod(dataset: DelegatesDataset): string {
  const salesPeriods = Array.from(new Set(dataset.sales.filter((sale) => sale.isAnalytical).map((sale) => periodKey(sale.date)).filter(Boolean) as string[]));
  return salesPeriods.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? getAvailablePeriods(dataset)[0]?.key ?? "all";
}

export function applyFilters(records: SaleRecord[], filters: DashboardFilters): SaleRecord[] {
  const query = filters.search.trim().toLocaleLowerCase("ar");
  return records.filter((sale) => {
    if (filters.period !== "all" && periodKey(sale.date) !== filters.period) return false;
    if (filters.governorate !== "all" && sale.governorate !== filters.governorate) return false;
    if (filters.representative !== "all" && sale.representative !== filters.representative) return false;
    if (filters.company !== "all" && sale.company !== filters.company) return false;
    if (filters.product !== "all" && sale.product !== filters.product) return false;
    if (filters.dateFrom && (!sale.date || sale.date < filters.dateFrom)) return false;
    if (filters.dateTo && (!sale.date || sale.date > filters.dateTo)) return false;
    if (filters.issuesOnly && sale.issues.length === 0) return false;
    if (query && ![sale.representative, sale.governorate, sale.company, sale.product, sale.notes]
      .some((value) => value.toLocaleLowerCase("ar").includes(query))) return false;
    return true;
  });
}

export function analyticalSales(records: SaleRecord[]): SaleRecord[] {
  return records.filter((sale) => sale.isAnalytical && sale.totalAmount !== null && sale.quantity !== null);
}

export function targetsForFilters(targets: MonthlyTarget[], filters: DashboardFilters): MonthlyTarget[] {
  return targets.filter((target) => {
    if (filters.period !== "all" && `${target.year}-${target.month}` !== filters.period) return false;
    if (filters.governorate !== "all" && target.governorate !== filters.governorate) return false;
    return true;
  });
}

function sumSales(records: SaleRecord[]): number {
  return records.reduce((sum, sale) => sum + (sale.totalAmount ?? 0), 0);
}

function sumQuantity(records: SaleRecord[]): number {
  return records.reduce((sum, sale) => sum + (sale.quantity ?? 0), 0);
}

function winner(records: SaleRecord[], key: (sale: SaleRecord) => string): string {
  const totals = new Map<string, number>();
  records.forEach((sale) => {
    const name = key(sale);
    if (name) totals.set(name, (totals.get(name) ?? 0) + (sale.totalAmount ?? 0));
  });
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

export function computeExecutive(dataset: DelegatesDataset, filtered: SaleRecord[], filters: DashboardFilters) {
  const valid = analyticalSales(filtered);
  const totalSales = sumSales(valid);
  const totalQuantity = sumQuantity(valid);
  const relevantTargets = targetsForFilters(dataset.targets, filters);
  const totalTarget = relevantTargets.length ? relevantTargets.reduce((sum, target) => sum + target.amount, 0) : null;
  const achievement = totalTarget && totalTarget > 0 ? totalSales / totalTarget * 100 : null;
  const remaining = totalTarget === null ? null : Math.max(totalTarget - totalSales, 0);
  return {
    totalSales,
    totalQuantity,
    totalTarget,
    achievement,
    remaining,
    transactions: valid.length,
    governorates: new Set(valid.map((sale) => sale.governorate)).size,
    representatives: new Set(valid.map((sale) => sale.representative).filter(Boolean)).size,
    products: new Set(valid.map((sale) => sale.product)).size,
    companies: new Set(valid.map((sale) => sale.company).filter(Boolean)).size,
    topRepresentative: winner(valid, (sale) => sale.representative),
    topProduct: winner(valid, (sale) => sale.product),
    topCompany: winner(valid, (sale) => sale.company),
  };
}

function targetForGovernorate(targets: MonthlyTarget[], governorate: string, filters: DashboardFilters): number | null {
  const matching = targetsForFilters(targets, { ...filters, governorate }).filter((target) => target.governorate === governorate);
  return matching.length ? matching.reduce((sum, target) => sum + target.amount, 0) : null;
}

export function computeGovernorates(dataset: DelegatesDataset, filtered: SaleRecord[], filters: DashboardFilters): GovernoratePerformance[] {
  const valid = analyticalSales(filtered);
  const periodTargets = targetsForFilters(dataset.targets, filters);
  const names = new Set([
    ...valid.map((sale) => sale.governorate),
    ...periodTargets.map((target) => target.governorate),
  ]);
  if (filters.governorate !== "all") {
    names.clear();
    names.add(filters.governorate);
  }

  return Array.from(names).filter(Boolean).map((governorate) => {
    const records = valid.filter((sale) => sale.governorate === governorate);
    const sales = sumSales(records);
    const target = targetForGovernorate(dataset.targets, governorate, filters);
    const achievement = target && target > 0 ? sales / target * 100 : null;
    let status: GovernoratePerformance["status"] = "بلا هدف";
    let tone: GovernoratePerformance["tone"] = "neutral";
    if (achievement !== null) {
      if (achievement >= GOVERNORATE_THRESHOLDS.achieved) [status, tone] = ["محقق", "success"];
      else if (achievement >= GOVERNORATE_THRESHOLDS.near) [status, tone] = ["قريب جداً", "near"];
      else if (achievement >= GOVERNORATE_THRESHOLDS.watching) [status, tone] = ["قيد المتابعة", "watch"];
      else [status, tone] = ["متأخر", "late"];
    }
    return {
      governorate,
      sales,
      target,
      achievement,
      remaining: target === null ? null : Math.max(target - sales, 0),
      quantity: sumQuantity(records),
      representativesCount: new Set(records.map((sale) => sale.representative).filter(Boolean)).size,
      transactionsCount: records.length,
      status,
      tone,
      topRepresentative: winner(records, (sale) => sale.representative),
      topProduct: winner(records, (sale) => sale.product),
      topCompany: winner(records, (sale) => sale.company),
    };
  }).sort((a, b) => (b.achievement ?? -1) - (a.achievement ?? -1));
}

export function computeRepresentatives(dataset: DelegatesDataset, filtered: SaleRecord[], filters: DashboardFilters): RepresentativePerformance[] {
  const valid = analyticalSales(filtered);
  const metadata = dataset.representatives.filter((representative) =>
    filters.governorate === "all" || representative.governorate === filters.governorate
  );
  const names = new Set([...metadata.map((item) => item.name), ...valid.map((sale) => sale.representative).filter(Boolean)]);
  const governorateTotals = new Map<string, number>();
  valid.forEach((sale) => governorateTotals.set(sale.governorate, (governorateTotals.get(sale.governorate) ?? 0) + (sale.totalAmount ?? 0)));

  const result = Array.from(names).map((name) => {
    const records = valid.filter((sale) => sale.representative === name);
    const meta = metadata.find((item) => item.name === name) ?? dataset.representatives.find((item) => item.name === name);
    const governorate = meta?.governorate ?? records[0]?.governorate ?? "—";
    const sales = sumSales(records);
    return {
      rank: 0,
      name,
      governorate,
      code: meta?.code ?? "—",
      sales,
      quantity: sumQuantity(records),
      transactions: records.length,
      governorateShare: sales && governorateTotals.get(governorate) ? sales / (governorateTotals.get(governorate) ?? 1) * 100 : 0,
      topProduct: winner(records, (sale) => sale.product),
      topCompany: winner(records, (sale) => sale.company),
    };
  }).sort((a, b) => b.sales - a.sales);
  result.forEach((item, index) => { item.rank = index + 1; });
  return result;
}

export function computeProducts(dataset: DelegatesDataset, filtered: SaleRecord[]): ProductPerformance[] {
  const valid = analyticalSales(filtered);
  const totalSales = sumSales(valid);
  const names = new Set([...dataset.products.map((product) => product.name), ...valid.map((sale) => sale.product)]);
  const result = Array.from(names).map((name) => {
    const records = valid.filter((sale) => sale.product === name);
    const meta = dataset.products.find((product) => product.name === name);
    const sales = sumSales(records);
    return {
      rank: 0,
      name,
      company: meta?.company ?? records[0]?.company ?? "—",
      currentPrice: meta?.currentPrice ?? 0,
      sales,
      quantity: sumQuantity(records),
      transactions: records.length,
      governorates: new Set(records.map((sale) => sale.governorate)).size,
      share: totalSales > 0 ? sales / totalSales * 100 : 0,
      topGovernorate: winner(records, (sale) => sale.governorate),
      topRepresentative: winner(records, (sale) => sale.representative),
    };
  }).sort((a, b) => b.sales - a.sales);
  result.forEach((item, index) => { item.rank = index + 1; });
  return result;
}

export function computeCompanies(dataset: DelegatesDataset, filtered: SaleRecord[]): CompanyPerformance[] {
  const valid = analyticalSales(filtered);
  const totalSales = sumSales(valid);
  const names = new Set([...dataset.products.map((product) => product.company).filter(Boolean), ...valid.map((sale) => sale.company).filter(Boolean)]);
  return Array.from(names).map((name) => {
    const records = valid.filter((sale) => sale.company === name);
    const sales = sumSales(records);
    return {
      name,
      sales,
      quantity: sumQuantity(records),
      transactions: records.length,
      products: new Set(dataset.products.filter((product) => product.company === name).map((product) => product.name)).size,
      share: totalSales > 0 ? sales / totalSales * 100 : 0,
      topProduct: winner(records, (sale) => sale.product),
      topGovernorate: winner(records, (sale) => sale.governorate),
    };
  }).sort((a, b) => b.sales - a.sales);
}

export function computeTimeline(filtered: SaleRecord[]) {
  const byDate = new Map<string, { sales: number; quantity: number }>();
  analyticalSales(filtered).forEach((sale) => {
    if (!sale.date) return;
    const current = byDate.get(sale.date) ?? { sales: 0, quantity: 0 };
    current.sales += sale.totalAmount ?? 0;
    current.quantity += sale.quantity ?? 0;
    byDate.set(sale.date, current);
  });
  let cumulative = 0;
  return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => {
    cumulative += values.sales;
    return { date, ...values, cumulative };
  });
}

export function computeInsights(governorates: GovernoratePerformance[], representatives: RepresentativePerformance[], products: ProductPerformance[], companies: CompanyPerformance[]) {
  const insights: Array<{ tone: "positive" | "warning" | "neutral"; title: string; detail: string }> = [];
  const achieved = governorates.filter((item) => (item.achievement ?? 0) >= 100);
  const weakest = [...governorates].filter((item) => item.achievement !== null).sort((a, b) => (a.achievement ?? 0) - (b.achievement ?? 0))[0];
  const closest = [...governorates].filter((item) => item.achievement !== null && (item.achievement ?? 0) < 100)
    .sort((a, b) => (b.achievement ?? 0) - (a.achievement ?? 0))[0];
  if (achieved.length) insights.push({ tone: "positive", title: `${achieved.map((item) => item.governorate).join(" و")} حققت الهدف`, detail: "الأداء تجاوز الخطة المحددة للفترة الحالية." });
  if (weakest) insights.push({ tone: "warning", title: `${weakest.governorate} تحتاج متابعة`, detail: `نسبة الإنجاز الحالية ${formatPercent(weakest.achievement)}.` });
  if (closest && closest !== weakest) insights.push({ tone: "neutral", title: `${closest.governorate} الأقرب للهدف`, detail: `تبقى ${formatCurrency(closest.remaining)} للوصول إلى الخطة.` });
  if (representatives[0]?.sales) insights.push({ tone: "positive", title: `${representatives[0].name} يتصدر المندوبين`, detail: `حقق ${formatCurrency(representatives[0].sales)} خلال الفترة.` });
  if (products[0]?.sales) insights.push({ tone: "neutral", title: `${products[0].name} المادة الأعلى`, detail: `ساهمت بنسبة ${formatPercent(products[0].share)} من المبيعات.` });
  if (companies[0]?.sales) insights.push({ tone: "neutral", title: `${companies[0].name} الشركة الأكثر مساهمة`, detail: `حصتها ${formatPercent(companies[0].share)} من إجمالي المبيعات.` });
  return insights.slice(0, 4);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متوفر";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} د.ع`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "غير متوفر";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}
