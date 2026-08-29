import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, Boxes, Building2, CalendarDays,
  Check, ChevronLeft, ChevronRight, CircleDollarSign, Download, Filter,
  LineChart as LineChartIcon, MapPin, Moon, Package, RefreshCw, Search,
  ShieldCheck, SlidersHorizontal, Sun, TrendingUp, UserRound, Users, X,
} from "lucide-react";
import { Link } from "wouter";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/contexts/ThemeContext";
import {
  EMPTY_FILTERS, analyticalSales, applyFilters, computeCompanies, computeExecutive,
  computeGovernorates, computeInsights, computeProducts, computeRepresentatives,
  computeTimeline, formatCurrency, formatNumber, formatPercent, getAvailablePeriods,
  getDefaultPeriod, periodKey,
} from "@/features/delegates/analytics";
import { fetchDelegatesDataset } from "@/features/delegates/data";
import type {
  DashboardFilters, DelegatesDataset, GovernoratePerformance,
  RepresentativePerformance, SaleRecord,
} from "@/features/delegates/types";
import "./delegates.css";

type AnalysisTab = "representatives" | "products" | "companies" | "timeline";
type DetailState =
  | { type: "governorate"; value: GovernoratePerformance }
  | { type: "representative"; value: RepresentativePerformance }
  | { type: "transaction"; value: SaleRecord }
  | null;
type VisibleColumns = { company: boolean; savedPrice: boolean; target: boolean; notes: boolean };

const MONTHS = [
  "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز",
  "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول",
];

function periodLabel(key: string): string {
  if (key === "all") return "جميع الفترات";
  const [year, month] = key.split("-").map(Number);
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

function formatDate(value: string | null): string {
  if (!value) return "غير متوفر";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-IQ", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function compactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} مليار`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} مليون`;
  return formatNumber(value);
}

function MetricValue({ value, unit }: { value: string; unit?: string }) {
  return <div className="delegates-metric-value"><b>{value}</b>{unit && <span>{unit}</span>}</div>;
}

function LoadingDashboard() {
  return <div className="delegates-loading" aria-label="جاري تحميل بيانات المندوبين">
    <div className="delegates-kpi-grid">
      {[0, 1, 2, 3].map((index) => <div key={index} className={`delegates-kpi-card ${index === 0 ? "delegates-kpi-primary" : ""}`}><Skeleton className="h-5 w-28" /><Skeleton className="mt-7 h-11 w-48" /><Skeleton className="mt-7 h-3 w-full" /></div>)}
    </div>
    <div className="delegates-section-grid"><Skeleton className="h-[360px] rounded-[22px]" /><Skeleton className="h-[360px] rounded-[22px]" /></div>
    <Skeleton className="h-[420px] rounded-[22px]" />
  </div>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="delegates-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function CustomChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="delegates-chart-tooltip" dir="rtl"><b>{label}</b>{payload.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}: {formatCurrency(item.value)}</span>)}</div>;
}

export function Delegates() {
  const { theme, toggleTheme } = useTheme();
  const [dataset, setDataset] = useState<DelegatesDataset | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detail, setDetail] = useState<DetailState>(null);
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("representatives");
  const [productRanking, setProductRanking] = useState<"sales" | "quantity">("sales");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: keyof SaleRecord; direction: "asc" | "desc" }>({ field: "date", direction: "desc" });
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({ company: true, savedPrice: true, target: false, notes: false });
  const initialized = useRef(false);
  const deferredSearch = useDeferredValue(filters.search);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "نبع الغدير — أداء المندوبين";
    return () => { document.title = previousTitle; };
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const result = await fetchDelegatesDataset();
      setDataset(result);
      if (!initialized.current) {
        setFilters((current) => ({ ...current, period: getDefaultPeriod(result) }));
        initialized.current = true;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات Google Sheets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const effectiveFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [filters, deferredSearch]);
  const filteredRecords = useMemo(() => dataset ? applyFilters(dataset.sales, effectiveFilters) : [], [dataset, effectiveFilters]);
  const validSales = useMemo(() => analyticalSales(filteredRecords), [filteredRecords]);
  const executive = useMemo(() => dataset ? computeExecutive(dataset, filteredRecords, filters) : null, [dataset, filteredRecords, filters]);
  const governorates = useMemo(() => dataset ? computeGovernorates(dataset, filteredRecords, filters) : [], [dataset, filteredRecords, filters]);
  const representatives = useMemo(() => dataset ? computeRepresentatives(dataset, filteredRecords, filters) : [], [dataset, filteredRecords, filters]);
  const products = useMemo(() => dataset ? computeProducts(dataset, filteredRecords) : [], [dataset, filteredRecords]);
  const companies = useMemo(() => dataset ? computeCompanies(dataset, filteredRecords) : [], [dataset, filteredRecords]);
  const timeline = useMemo(() => computeTimeline(filteredRecords), [filteredRecords]);
  const insights = useMemo(() => computeInsights(governorates, representatives, products, companies), [governorates, representatives, products, companies]);
  const availablePeriods = useMemo(() => dataset ? getAvailablePeriods(dataset) : [], [dataset]);

  const representativeOptions = useMemo(() => !dataset ? [] : dataset.representatives.filter((item) => filters.governorate === "all" || item.governorate === filters.governorate).map((item) => item.name), [dataset, filters.governorate]);
  const companyOptions = useMemo(() => dataset ? Array.from(new Set(dataset.products.map((item) => item.company).filter(Boolean))) : [], [dataset]);
  const productOptions = useMemo(() => {
    if (!dataset) return [];
    const contextProducts = new Set(dataset.sales.filter((sale) => {
      if (filters.period !== "all" && periodKey(sale.date) !== filters.period) return false;
      if (filters.governorate !== "all" && sale.governorate !== filters.governorate) return false;
      if (filters.representative !== "all" && sale.representative !== filters.representative) return false;
      if (filters.company !== "all" && sale.company !== filters.company) return false;
      return true;
    }).map((sale) => sale.product).filter(Boolean));
    return dataset.products.filter((product) => (filters.company === "all" || product.company === filters.company) && (contextProducts.size === 0 || contextProducts.has(product.name))).map((product) => product.name);
  }, [dataset, filters.period, filters.governorate, filters.representative, filters.company]);

  const issueRecords = useMemo(() => dataset?.sales.filter((sale) => sale.issues.length > 0) ?? [], [dataset]);
  const activeFiltersCount = [filters.governorate, filters.representative, filters.company, filters.product].filter((value) => value !== "all").length + Number(Boolean(filters.dateFrom)) + Number(Boolean(filters.dateTo)) + Number(filters.issuesOnly);
  const sortedProducts = useMemo(() => [...products].sort((a, b) => productRanking === "sales" ? b.sales - a.sales : b.quantity - a.quantity), [products, productRanking]);
  const sortedTransactions = useMemo(() => [...filteredRecords].sort((a, b) => {
    const left = a[sort.field]; const right = b[sort.field]; const direction = sort.direction === "asc" ? 1 : -1;
    if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
    return String(left ?? "").localeCompare(String(right ?? ""), "ar") * direction;
  }), [filteredRecords, sort]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedTransactions.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); }, [effectiveFilters]);

  const resetFilters = () => setFilters({ ...EMPTY_FILTERS, period: dataset ? getDefaultPeriod(dataset) : "all" });
  const updateSort = (field: keyof SaleRecord) => setSort((current) => current.field === field ? { field, direction: current.direction === "asc" ? "desc" : "asc" } : { field, direction: "desc" });
  const showIssues = () => {
    setFilters((current) => ({ ...current, period: "all", issuesOnly: true }));
    setTimeout(() => document.getElementById("delegates-transactions")?.scrollIntoView({ behavior: "smooth" }), 0);
  };
  const exportData = () => {
    const rows = [["المندوب", "المحافظة", "الشركة", "المادة", "الكمية", "سعر البيع المحفوظ", "إجمالي المبلغ", "التاريخ", "التارغت الشهري", "الملاحظات"], ...filteredRecords.map((sale) => [sale.representative, sale.governorate, sale.company, sale.product, sale.quantity ?? "", sale.savedUnitPrice ?? "", sale.totalAmount ?? "", sale.date ?? "", sale.monthlyTargetSnapshot ?? "", sale.notes])];
    const csv = `\ufeff${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `delegates-${filters.period}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  if (loading && !dataset) return <div className="delegates-dashboard" dir="rtl"><header className="delegates-header"><div className="delegates-header-inner"><div className="delegates-brand"><span className="delegates-brand-mark"><TrendingUp /></span><div><h1>نبع الغدير العلمي</h1><p>لوحة متابعة المبيعات وأداء المندوبين</p></div></div></div></header><main className="delegates-main"><LoadingDashboard /></main></div>;
  if (error && !dataset) return <div className="delegates-dashboard" dir="rtl"><main className="delegates-error-state"><span><AlertCircle /></span><h1>تعذر تحميل بيانات المبيعات</h1><p>{error}. تأكد من اتصال الإنترنت ثم أعد المحاولة.</p><Button onClick={() => void loadData()}><RefreshCw /> إعادة المحاولة</Button><Link href="/" className="delegates-back-link"><ArrowRight /> العودة للرئيسية</Link></main></div>;
  if (!dataset || !executive) return null;

  const barData = governorates.map((item) => ({ name: item.governorate, المبيعات: item.sales, التارغت: item.target ?? 0 }));
  return <div className="delegates-dashboard" dir="rtl">
    <header className="delegates-header"><div className="delegates-header-inner">
      <div className="delegates-brand"><Link href="/" className="delegates-icon-button" aria-label="العودة للرئيسية"><ArrowRight /></Link><span className="delegates-brand-mark"><TrendingUp /></span><div><h1>نبع الغدير العلمي</h1><p>لوحة متابعة المبيعات وأداء المندوبين</p></div></div>
      <div className="delegates-header-actions"><div className="delegates-source-state"><i /><span>Google Sheets مباشر</span><small>{new Intl.DateTimeFormat("ar-IQ", { hour: "2-digit", minute: "2-digit" }).format(new Date(dataset.fetchedAt))}</small></div><label className="delegates-period-select"><CalendarDays /><select value={filters.period} onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value }))}><option value="all">جميع الفترات</option>{availablePeriods.map((period) => <option key={period.key} value={period.key}>{periodLabel(period.key)}</option>)}</select></label><Button variant="outline" size="icon" onClick={() => void loadData(true)} disabled={refreshing} aria-label="تحديث البيانات"><RefreshCw className={refreshing ? "delegates-spin" : ""} /></Button>{toggleTheme && <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="تبديل المظهر">{theme === "dark" ? <Sun /> : <Moon />}</Button>}</div>
    </div></header>

    <main className="delegates-main">
      {error && <div className="delegates-inline-error"><AlertCircle /><span>تعذر جلب النسخة الأحدث؛ ما زالت آخر بيانات ناجحة معروضة.</span><button onClick={() => void loadData(true)}>إعادة المحاولة</button></div>}
      <section className="delegates-executive-head"><div><span className="delegates-eyebrow">المشهد التنفيذي</span><h2>أداء المبيعات في {periodLabel(filters.period)}</h2><p>قراءة موحدة للمحافظات والمندوبين والمواد من المصدر المنشور.</p></div><div className="delegates-executive-actions"><Button variant="outline" onClick={exportData}><Download /> تصدير النتائج</Button><Button onClick={() => setFilterSheetOpen(true)}><SlidersHorizontal /> الفلاتر {activeFiltersCount > 0 && <b>{activeFiltersCount}</b>}</Button></div></section>

      <section className="delegates-kpi-grid" aria-label="المؤشرات التنفيذية">
        <article className="delegates-kpi-card delegates-kpi-primary"><div className="delegates-kpi-heading"><span>إجمالي المبيعات</span><CircleDollarSign /></div><MetricValue value={formatNumber(executive.totalSales)} unit="د.ع" /><div className="delegates-primary-context"><span>{executive.transactions} عملية بيع فعلية</span><b>{formatPercent(executive.achievement)} من الهدف</b></div><div className="delegates-progress"><i style={{ width: `${Math.min(executive.achievement ?? 0, 100)}%` }} /></div></article>
        <article className="delegates-kpi-card delegates-kpi-achievement"><div className="delegates-kpi-heading"><span>نسبة الإنجاز</span><TrendingUp /></div><MetricValue value={formatPercent(executive.achievement)} /><p>{executive.achievement !== null && executive.achievement >= 100 ? "تم تجاوز الخطة للفترة" : `المتبقي ${formatCurrency(executive.remaining)}`}</p></article>
        <article className="delegates-kpi-card delegates-kpi-split"><div><span>التارغت الإجمالي</span><b>{formatCurrency(executive.totalTarget)}</b></div><div><span>المتبقي للهدف</span><b>{formatCurrency(executive.remaining)}</b></div></article>
        <article className="delegates-kpi-card"><div className="delegates-kpi-heading"><span>إجمالي القطع</span><Boxes /></div><MetricValue value={formatNumber(executive.totalQuantity)} unit="قطعة" /><p>موزعة على {executive.products} مادة نشطة</p></article>
      </section>
      <section className="delegates-secondary-metrics"><span><MapPin /><b>{executive.governorates}</b> محافظات نشطة</span><span><Users /><b>{executive.representatives}</b> مندوبين باعوا</span><span><Package /><b>{executive.products}</b> مواد مباعة</span><span><Building2 /><b>{executive.companies}</b> شركات مساهمة</span><span><BarChart3 /><b>{validSales.length}</b> عملية محتسبة</span></section>

      <section className="delegates-section"><div className="delegates-section-heading"><div><span>أداء المحافظات</span><h2>من يحقق الخطة؟</h2></div><p>اضغط على أي محافظة لفتح ملفها التحليلي.</p></div><div className="delegates-governorates-grid">{governorates.map((item) => <button key={item.governorate} className={`delegates-governorate-card tone-${item.tone}`} onClick={() => setDetail({ type: "governorate", value: item })}><div className="delegates-governorate-top"><div><span>{item.governorate}</span><small>{item.transactionsCount} عمليات · {item.representativesCount} مندوبين</small></div><b>{item.status}</b></div><div className="delegates-governorate-value"><strong>{compactCurrency(item.sales)}</strong><span>{formatPercent(item.achievement)}</span></div><div className="delegates-progress"><i style={{ width: `${Math.min(item.achievement ?? 0, 100)}%` }} /></div><div className="delegates-governorate-foot"><span>الهدف {formatCurrency(item.target)}</span><span>المتبقي {formatCurrency(item.remaining)}</span></div></button>)}</div></section>

      <section className="delegates-section-grid">
        <article className="delegates-panel delegates-chart-panel"><div className="delegates-panel-heading"><div><span>مبيعات مقابل التارغت</span><h3>فجوة التنفيذ حسب المحافظة</h3></div><div className="delegates-chart-legend"><span><i className="sales" />المبيعات</span><span><i className="target" />التارغت</span></div></div>{barData.length ? <div className="delegates-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={barData} layout="vertical" margin={{ top: 8, right: 10, left: 20, bottom: 4 }} barGap={4}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--delegates-line)" /><XAxis type="number" tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fill: "var(--delegates-muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" tick={{ fill: "var(--delegates-ink)", fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={72} /><ChartTooltip content={<CustomChartTooltip />} /><Bar dataKey="التارغت" fill="var(--delegates-target)" radius={[4, 4, 4, 4]} barSize={12} /><Bar dataKey="المبيعات" fill="var(--delegates-accent)" radius={[4, 4, 4, 4]} barSize={12} /></BarChart></ResponsiveContainer></div> : <div className="delegates-empty-compact">لا توجد بيانات رسم لهذه الفترة.</div>}</article>
        <article className="delegates-panel delegates-insights-panel"><div className="delegates-panel-heading"><div><span>إشارات تنفيذية</span><h3>ما الذي يستحق الانتباه الآن؟</h3></div></div><div className="delegates-insights-list">{insights.length ? insights.map((insight, index) => <div key={`${insight.title}-${index}`} className={`delegates-insight tone-${insight.tone}`}><i /><div><b>{insight.title}</b><p>{insight.detail}</p></div></div>) : <div className="delegates-empty-compact">لا توجد إشارات كافية في الفترة المحددة.</div>}</div><button className={`delegates-quality-strip ${issueRecords.length ? "has-issues" : ""}`} onClick={showIssues}>{issueRecords.length ? <AlertCircle /> : <ShieldCheck />}<span><b>{issueRecords.length ? `${issueRecords.length} سجلات تحتاج مراجعة` : "البيانات سليمة"}</b><small>{issueRecords.length ? "اعرض العمليات غير المكتملة أو غير المتطابقة" : "لم تُكتشف مشكلات في السجلات الحالية"}</small></span><ArrowLeft /></button></article>
      </section>

      <section className="delegates-section delegates-analysis-section"><div className="delegates-section-heading delegates-analysis-heading"><div><span>التحليل المتقدم</span><h2>الأداء عبر زوايا العمل</h2></div><div className="delegates-tabs" role="tablist">{([["representatives", "المندوبون", Users], ["products", "المواد", Package], ["companies", "الشركات", Building2], ["timeline", "المسار الزمني", LineChartIcon]] as const).map(([key, label, Icon]) => <button key={key} className={analysisTab === key ? "active" : ""} onClick={() => setAnalysisTab(key)}><Icon />{label}</button>)}</div></div>
        <div className="delegates-analysis-content">
          {analysisTab === "representatives" && <div className="delegates-ranking-layout"><div className="delegates-top-ranking">{representatives.slice(0, 3).map((item) => <button key={item.name} onClick={() => setDetail({ type: "representative", value: item })}><span className="delegates-rank-number">{item.rank}</span><div><b>{item.name}</b><small>{item.governorate}</small></div><strong>{formatCurrency(item.sales)}</strong><em>{formatPercent(item.governorateShare)} من المحافظة</em></button>)}</div><div className="delegates-table-wrap"><table className="delegates-analytics-table"><thead><tr><th>#</th><th>المندوب</th><th>المحافظة</th><th>المبيعات</th><th>القطع</th><th>العمليات</th><th>أفضل مادة</th></tr></thead><tbody>{representatives.slice(3, 12).map((item) => <tr key={item.name} onClick={() => setDetail({ type: "representative", value: item })}><td>{item.rank}</td><td><b>{item.name}</b><small>{item.code}</small></td><td>{item.governorate}</td><td>{formatCurrency(item.sales)}</td><td>{formatNumber(item.quantity)}</td><td>{item.transactions}</td><td>{item.topProduct}</td></tr>)}</tbody></table></div></div>}
          {analysisTab === "products" && <div><div className="delegates-ranking-toggle"><span>ترتيب المواد حسب</span><button className={productRanking === "sales" ? "active" : ""} onClick={() => setProductRanking("sales")}>قيمة المبيعات</button><button className={productRanking === "quantity" ? "active" : ""} onClick={() => setProductRanking("quantity")}>الكمية</button></div><div className="delegates-table-wrap"><table className="delegates-analytics-table"><thead><tr><th>#</th><th>المادة</th><th>الشركة</th><th>السعر الحالي</th><th>المبيعات</th><th>القطع</th><th>الحصة</th><th>أفضل محافظة</th></tr></thead><tbody>{sortedProducts.slice(0, 15).map((item, index) => <tr key={item.name}><td>{index + 1}</td><td><b>{item.name}</b><small>{item.transactions} عمليات · {item.governorates} محافظات</small></td><td>{item.company}</td><td>{formatCurrency(item.currentPrice)}</td><td>{formatCurrency(item.sales)}</td><td>{formatNumber(item.quantity)}</td><td>{formatPercent(item.share)}</td><td>{item.topGovernorate}</td></tr>)}</tbody></table></div></div>}
          {analysisTab === "companies" && <div className="delegates-companies-grid">{companies.map((item) => <article key={item.name}><div><span className="delegates-company-mark">{item.name.slice(0, 2)}</span><div><h3>{item.name}</h3><p>{item.products} مواد مسجلة</p></div><b>{formatPercent(item.share)}</b></div><MetricValue value={formatNumber(item.sales)} unit="د.ع" /><div className="delegates-company-stats"><span>القطع <b>{formatNumber(item.quantity)}</b></span><span>العمليات <b>{item.transactions}</b></span><span>أفضل مادة <b>{item.topProduct}</b></span><span>أفضل محافظة <b>{item.topGovernorate}</b></span></div></article>)}</div>}
          {analysisTab === "timeline" && <div className="delegates-timeline-panel">{timeline.length > 1 ? <div className="delegates-chart delegates-chart-timeline" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={timeline} margin={{ top: 10, right: 10, left: 12, bottom: 4 }}><defs><linearGradient id="delegatesArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--delegates-accent)" stopOpacity={0.22} /><stop offset="95%" stopColor="var(--delegates-accent)" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--delegates-line)" /><XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value))} tick={{ fill: "var(--delegates-muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fill: "var(--delegates-muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><ChartTooltip content={<CustomChartTooltip />} /><Area type="monotone" dataKey="cumulative" name="المبيعات التراكمية" stroke="var(--delegates-accent)" strokeWidth={3} fill="url(#delegatesArea)" /></AreaChart></ResponsiveContainer></div> : <div className="delegates-empty"><LineChartIcon /><h3>المسار الزمني غير متاح</h3><p>تحتاج الفترة إلى يومين مختلفين على الأقل لعرض اتجاه المبيعات.</p></div>}</div>}
        </div>
      </section>

      <section id="delegates-transactions" className="delegates-section delegates-transactions-section"><div className="delegates-section-heading delegates-transactions-heading"><div><span>العمليات</span><h2>سجل المبيعات الموحد</h2><p>{filteredRecords.length} نتيجة من جميع سجلات المحافظات المنشورة.</p></div><div className="delegates-search"><Search /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="بحث بالمندوب أو المادة..." />{filters.search && <button onClick={() => setFilters((current) => ({ ...current, search: "" }))}><X /></button>}</div></div>
        {filteredRecords.length ? <><div className="delegates-table-wrap delegates-transactions-table"><table><thead><tr><th onClick={() => updateSort("representative")}>المندوب</th><th>المحافظة</th>{visibleColumns.company && <th>الشركة</th>}<th onClick={() => updateSort("product")}>المادة</th><th onClick={() => updateSort("quantity")}>الكمية</th>{visibleColumns.savedPrice && <th>سعر البيع المحفوظ</th>}<th onClick={() => updateSort("totalAmount")}>الإجمالي</th><th onClick={() => updateSort("date")}>التاريخ</th>{visibleColumns.target && <th>التارغت</th>}{visibleColumns.notes && <th>الملاحظات</th>}<th>الحالة</th></tr></thead><tbody>{pageRows.map((sale) => <tr key={sale.id} onClick={() => setDetail({ type: "transaction", value: sale })}><td><b>{sale.representative || "غير مسجل"}</b><small>{sale.sourceSheet}</small></td><td>{sale.governorate || "—"}</td>{visibleColumns.company && <td><span className="delegates-company-pill">{sale.company || "—"}</span></td>}<td className="delegates-product-cell">{sale.product || "—"}</td><td>{formatNumber(sale.quantity)}</td>{visibleColumns.savedPrice && <td>{formatCurrency(sale.savedUnitPrice)}</td>}<td><strong>{formatCurrency(sale.totalAmount)}</strong></td><td>{formatDate(sale.date)}</td>{visibleColumns.target && <td>{formatCurrency(sale.monthlyTargetSnapshot)}</td>}{visibleColumns.notes && <td>{sale.notes || "—"}</td>}<td>{sale.issues.length ? <span className="delegates-row-status warning">مراجعة</span> : <span className="delegates-row-status good">سليم</span>}</td></tr>)}</tbody></table></div><div className="delegates-mobile-transactions">{pageRows.map((sale) => <button key={sale.id} onClick={() => setDetail({ type: "transaction", value: sale })}><div><b>{sale.product || "مادة غير مسجلة"}</b><span className={sale.issues.length ? "warning" : "good"}>{sale.issues.length ? "مراجعة" : "سليم"}</span></div><p>{sale.representative || "مندوب غير مسجل"} · {sale.governorate || "محافظة غير مسجلة"}</p><footer><strong>{formatCurrency(sale.totalAmount)}</strong><span>{formatDate(sale.date)}</span></footer></button>)}</div><div className="delegates-pagination"><span>صفحة {safePage} من {totalPages}</span><div><Button variant="outline" size="icon-sm" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronRight /></Button><Button variant="outline" size="icon-sm" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronLeft /></Button></div></div></> : <div className="delegates-empty"><Filter /><h3>لا توجد عمليات بيع ضمن الاختيار الحالي</h3><p>غيّر الفترة أو أزل بعض الفلاتر لاستعراض نتائج أخرى.</p><Button variant="outline" onClick={resetFilters}>إعادة تعيين الفلاتر</Button></div>}
      </section>

      <section className="delegates-data-quality"><div><span className={issueRecords.length ? "warning" : "good"}>{issueRecords.length ? <AlertCircle /> : <ShieldCheck />}</span><div><h3>{issueRecords.length ? `${issueRecords.length} سجلات تحتاج مراجعة` : "جودة البيانات ممتازة"}</h3><p>{dataset.sheets.filter((sheet) => sheet.kind === "sales").length} سجلات محافظات موحدة · {dataset.sales.filter((sale) => sale.isAnalytical).length} عملية صالحة للتحليل · {dataset.sales.filter((sale) => !sale.isAnalytical).length} عمليات غير مكتملة غير محتسبة</p></div></div><button onClick={showIssues}>عرض سجلات المراجعة <ArrowLeft /></button></section>
    </main>

    <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}><SheetContent side="left" className="delegates-filter-sheet" dir="rtl"><SheetHeader><SheetTitle>فلاتر التحليل</SheetTitle><SheetDescription>كل اختيار يحدّث المؤشرات والرسوم والترتيب وسجل العمليات معاً.</SheetDescription></SheetHeader><div className="delegates-filter-form">
      <SelectField label="الفترة" value={filters.period} options={[{ value: "all", label: "جميع الفترات" }, ...availablePeriods.map((item) => ({ value: item.key, label: periodLabel(item.key) }))]} onChange={(value) => setFilters((current) => ({ ...current, period: value }))} />
      <SelectField label="المحافظة" value={filters.governorate} options={[{ value: "all", label: "كل المحافظات" }, ...Array.from(new Set([...dataset.targets.map((item) => item.governorate), ...dataset.representatives.map((item) => item.governorate)])).map((value) => ({ value, label: value }))]} onChange={(value) => setFilters((current) => ({ ...current, governorate: value, representative: "all" }))} />
      <SelectField label="المندوب" value={filters.representative} options={[{ value: "all", label: "كل المندوبين" }, ...representativeOptions.map((value) => ({ value, label: value }))]} onChange={(value) => setFilters((current) => ({ ...current, representative: value }))} />
      <SelectField label="الشركة" value={filters.company} options={[{ value: "all", label: "كل الشركات" }, ...companyOptions.map((value) => ({ value, label: value }))]} onChange={(value) => setFilters((current) => ({ ...current, company: value, product: "all" }))} />
      <SelectField label="المادة" value={filters.product} options={[{ value: "all", label: "كل المواد" }, ...productOptions.map((value) => ({ value, label: value }))]} onChange={(value) => setFilters((current) => ({ ...current, product: value }))} />
      <div className="delegates-date-grid"><label className="delegates-field"><span>من تاريخ</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label><label className="delegates-field"><span>إلى تاريخ</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label></div>
      <label className="delegates-check-row"><input type="checkbox" checked={filters.issuesOnly} onChange={(event) => setFilters((current) => ({ ...current, issuesOnly: event.target.checked }))} /><span><b>السجلات التي تحتاج مراجعة فقط</b><small>يعرض العمليات الناقصة أو غير المتطابقة.</small></span></label>
      <div className="delegates-columns"><span>أعمدة جدول العمليات</span>{Object.entries({ company: "الشركة", savedPrice: "سعر البيع المحفوظ", target: "التارغت", notes: "الملاحظات" }).map(([key, label]) => <label key={key}><input type="checkbox" checked={visibleColumns[key as keyof VisibleColumns]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}</div>
    </div><div className="delegates-filter-footer"><Button variant="outline" onClick={resetFilters}>مسح الكل</Button><Button onClick={() => setFilterSheetOpen(false)}><Check /> عرض {filteredRecords.length} نتيجة</Button></div></SheetContent></Sheet>

    <Sheet open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}><SheetContent side="left" className="delegates-detail-sheet" dir="rtl">{detail && <DetailPanel detail={detail} filteredRecords={filteredRecords} onSelectRepresentative={(value) => setDetail({ type: "representative", value })} representatives={representatives} />}</SheetContent></Sheet>
  </div>;
}

function DetailPanel({ detail, filteredRecords, onSelectRepresentative, representatives }: { detail: Exclude<DetailState, null>; filteredRecords: SaleRecord[]; onSelectRepresentative: (value: RepresentativePerformance) => void; representatives: RepresentativePerformance[] }) {
  if (detail.type === "transaction") {
    const sale = detail.value;
    const values = [["المندوب", sale.representative || "غير متوفر"], ["المحافظة", sale.governorate || "غير متوفر"], ["الشركة", sale.company || "غير متوفر"], ["المادة", sale.product || "غير متوفر"], ["الكمية", formatNumber(sale.quantity)], ["سعر البيع المحفوظ", formatCurrency(sale.savedUnitPrice)], ["الإجمالي", formatCurrency(sale.totalAmount)], ["التاريخ", formatDate(sale.date)], ["التارغت الشهري", formatCurrency(sale.monthlyTargetSnapshot)], ["مساهمة العملية", sale.targetContribution === null ? "غير متوفر" : formatPercent(sale.targetContribution * 100)], ["الملاحظات", sale.notes || "لا توجد ملاحظات"]];
    return <><SheetHeader><SheetTitle>تفاصيل عملية البيع</SheetTitle><SheetDescription>{sale.sourceSheet} · الصف {sale.sourceRow}</SheetDescription></SheetHeader><div className="delegates-detail-body"><div className={`delegates-detail-health ${sale.issues.length ? "warning" : "good"}`}>{sale.issues.length ? <AlertCircle /> : <ShieldCheck />}<div><b>{sale.issues.length ? "العملية تحتاج مراجعة" : "العملية مكتملة"}</b><p>{sale.issues.length ? sale.issues.map((item) => item.label).join("، ") : "تم التحقق من الحقول الأساسية والحساب."}</p></div></div><div className="delegates-detail-grid">{values.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div><div className="delegates-snapshot-note"><ShieldCheck /><p><b>سعر تاريخي محفوظ</b>قيمة العملية تعتمد على سعر البيع المسجل وقت تنفيذها، وليس السعر الحالي في دليل المواد.</p></div></div></>;
  }
  if (detail.type === "representative") {
    const item = detail.value;
    const records = analyticalSales(filteredRecords).filter((sale) => sale.representative === item.name);
    const products = Array.from(new Set(records.map((sale) => sale.product)));
    return <><SheetHeader><SheetTitle>{item.name}</SheetTitle><SheetDescription>{item.code} · محافظة {item.governorate}</SheetDescription></SheetHeader><div className="delegates-detail-body"><div className="delegates-detail-hero"><span><UserRound /></span><div><small>إجمالي مبيعات المندوب</small><MetricValue value={formatNumber(item.sales)} unit="د.ع" /><p>{formatPercent(item.governorateShare)} من مبيعات المحافظة</p></div></div><div className="delegates-detail-grid compact"><div><span>القطع</span><b>{formatNumber(item.quantity)}</b></div><div><span>العمليات</span><b>{item.transactions}</b></div><div><span>أفضل مادة</span><b>{item.topProduct}</b></div><div><span>أفضل شركة</span><b>{item.topCompany}</b></div></div><div className="delegates-detail-section"><h3>المواد التي باعها</h3><div className="delegates-chip-list">{products.map((product) => <span key={product}>{product}</span>)}</div></div><div className="delegates-detail-section"><h3>آخر العمليات</h3><div className="delegates-detail-sales">{records.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6).map((sale) => <div key={sale.id}><span><b>{sale.product}</b><small>{formatDate(sale.date)}</small></span><strong>{formatCurrency(sale.totalAmount)}</strong></div>)}</div></div></div></>;
  }
  const item = detail.value;
  const records = analyticalSales(filteredRecords).filter((sale) => sale.governorate === item.governorate);
  const govRepresentatives = representatives.filter((representative) => representative.governorate === item.governorate && representative.sales > 0);
  return <><SheetHeader><SheetTitle>ملف محافظة {item.governorate}</SheetTitle><SheetDescription>{item.status} · {formatPercent(item.achievement)} من الخطة</SheetDescription></SheetHeader><div className="delegates-detail-body"><div className="delegates-detail-hero"><span><MapPin /></span><div><small>إجمالي المبيعات</small><MetricValue value={formatNumber(item.sales)} unit="د.ع" /><p>الهدف {formatCurrency(item.target)}</p></div></div><div className="delegates-progress large"><i style={{ width: `${Math.min(item.achievement ?? 0, 100)}%` }} /></div><div className="delegates-detail-grid compact"><div><span>المتبقي</span><b>{formatCurrency(item.remaining)}</b></div><div><span>القطع</span><b>{formatNumber(item.quantity)}</b></div><div><span>أفضل مادة</span><b>{item.topProduct}</b></div><div><span>أفضل شركة</span><b>{item.topCompany}</b></div></div><div className="delegates-detail-section"><h3>ترتيب المندوبين</h3><div className="delegates-detail-sales">{govRepresentatives.map((representative) => <button key={representative.name} onClick={() => onSelectRepresentative(representative)}><span><b>{representative.name}</b><small>{formatNumber(representative.quantity)} قطعة · {representative.transactions} عمليات</small></span><strong>{formatCurrency(representative.sales)}</strong></button>)}</div></div><div className="delegates-detail-section"><h3>آخر العمليات</h3><div className="delegates-detail-sales">{records.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5).map((sale) => <div key={sale.id}><span><b>{sale.product}</b><small>{sale.representative} · {formatDate(sale.date)}</small></span><strong>{formatCurrency(sale.totalAmount)}</strong></div>)}</div></div></div></>;
}

export default Delegates;
