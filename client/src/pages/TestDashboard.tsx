import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  Flame,
  Globe,
  HardDrive,
  HelpCircle,
  Info,
  Layers,
  LayoutDashboard,
  LineChart,
  ListFilter,
  MapPin,
  MoonStar,
  Package,
  Pencil,
  PieChart as PieChartIcon,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TableProperties,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import {
  fetchGoogleSpreadsheetData,
  ParsedSpreadsheetData,
  UnifiedSaleRecord,
  DelegateMetadata,
  ProductMetadata,
} from "@/lib/sheetsDataFetcher";
import {
  FilterState,
  computeExecutiveKpiSummary,
  computeGovernoratesPerformance,
  computeDelegatesRanking,
  computeProductPerformance,
  computeCompanyAnalytics,
  computeSalesTimeline,
  filterSalesRecords,
  generateExecutiveInsights,
  GovernoratePerformance,
  DelegateRanking,
  ProductPerformance,
} from "@/lib/analyticsEngine";
import "./testDashboard.css";

const INITIAL_FILTERS: FilterState = {
  selectedMonthKey: "all",
  governorate: "all",
  delegate: "all",
  company: "all",
  product: "all",
  dateFrom: "",
  dateTo: "",
  searchQuery: "",
  healthFilter: "all",
};

const CHART_PALETTE = ["#0F766E", "#2563EB", "#D97706", "#7C3AED", "#DB2777", "#059669"];

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("ar-IQ", {
    maximumFractionDigits: 0,
  }).format(val) + " د.ع";
};

export function TestDashboard() {
  const { theme, toggleTheme } = useTheme();

  // Data Loading States
  const [data, setData] = useState<ParsedSpreadsheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(() => {
    return localStorage.getItem("hisabati_custom_sheet_url") || "";
  });

  // Drawer / Modal Focus States
  const [selectedGovDrawer, setSelectedGovDrawer] = useState<GovernoratePerformance | null>(null);
  const [selectedDelegateDrawer, setSelectedDelegateDrawer] = useState<DelegateRanking | null>(null);
  const [selectedSaleModal, setSelectedSaleModal] = useState<UnifiedSaleRecord | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [tempUrlInput, setTempUrlInput] = useState(sheetUrl);

  // Filters State
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<"table" | "delegates" | "products" | "companies" | "timeline">("table");

  // Product ranking mode
  const [productSortMode, setProductSortMode] = useState<"revenue" | "quantity">("revenue");

  // Table Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState<keyof UnifiedSaleRecord>("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Load Data
  const loadData = async (urlToUse?: string) => {
    setLoading(true);
    try {
      const result = await fetchGoogleSpreadsheetData(urlToUse || sheetUrl);
      setData(result);
      if (result.sourceType === "live-sheets") {
        toast.success("تم تحديث البيانات مباشرة من Google Sheets بنجاح");
      }
    } catch (err) {
      toast.error("تعذر الاتصال بـ Google Sheets، تم الاعتماد على البيانات الموثقة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleSaveSheetUrl = () => {
    const trimmed = tempUrlInput.trim();
    setSheetUrl(trimmed);
    localStorage.setItem("hisabati_custom_sheet_url", trimmed);
    setConfigModalOpen(false);
    void loadData(trimmed);
  };

  // Filtered Unified Sales Dataset (Single source of truth)
  const filteredSales = useMemo(() => {
    if (!data) return [];
    return filterSalesRecords(data.salesRecords, filters);
  }, [data, filters]);

  // Executive KPI Summary
  const kpis = useMemo(() => {
    if (!data) return null;
    return computeExecutiveKpiSummary(filteredSales, data.targets, filters);
  }, [data, filteredSales, filters]);

  // Governorates Performance
  const govPerformances = useMemo(() => {
    if (!data) return [];
    return computeGovernoratesPerformance(filteredSales, data.targets, filters, data.delegates);
  }, [data, filteredSales, filters]);

  // Executive Insights
  const executiveInsights = useMemo(() => {
    if (!kpis) return [];
    return generateExecutiveInsights(kpis, govPerformances);
  }, [kpis, govPerformances]);

  // Delegates Ranking
  const delegatesRanking = useMemo(() => {
    if (!data) return [];
    return computeDelegatesRanking(filteredSales, data.delegates);
  }, [data, filteredSales]);

  // Products Performance
  const productsPerformance = useMemo(() => {
    if (!data) return [];
    const list = computeProductPerformance(filteredSales, data.products);
    if (productSortMode === "quantity") {
      return [...list].sort((a, b) => b.totalQuantity - a.totalQuantity);
    }
    return list;
  }, [data, filteredSales, productSortMode]);

  // Companies Market Share
  const companyAnalytics = useMemo(() => {
    if (!data) return [];
    return computeCompanyAnalytics(filteredSales);
  }, [filteredSales]);

  // Sales Timeline Points
  const timelinePoints = useMemo(() => {
    if (!data) return [];
    return computeSalesTimeline(filteredSales);
  }, [filteredSales]);

  // Cascading Delegate Options: Filter delegates by currently selected governorate
  const availableDelegatesForGov = useMemo(() => {
    if (!data) return [];
    if (filters.governorate === "all") return data.availableDelegates;
    return data.delegates
      .filter((d) => d.governorate === filters.governorate)
      .map((d) => d.name);
  }, [data, filters.governorate]);

  // Sorted and Paginated Sales for Table
  const sortedAndPaginatedSales = useMemo(() => {
    const sorted = [...filteredSales].sort((a, b) => {
      let aVal = a[sortField] ?? "";
      let bVal = b[sortField] ?? "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc
        ? String(aVal).localeCompare(String(bVal), "ar")
        : String(bVal).localeCompare(String(aVal), "ar");
    });

    const totalCount = sorted.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const paginated = sorted.slice(startIdx, startIdx + pageSize);

    return {
      rows: paginated,
      totalCount,
      totalPages,
      safePage,
    };
  }, [filteredSales, sortField, sortAsc, currentPage, pageSize]);

  const handleSort = (field: keyof UnifiedSaleRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const resetAllFilters = () => {
    setFilters(INITIAL_FILTERS);
    setCurrentPage(1);
    toast.info("تمت إعادة تعيين جميع الفلاتر");
  };

  // Export Filtered Table to Excel
  const exportToExcel = () => {
    if (filteredSales.length === 0) {
      toast.error("لا توجد بيانات لتصديرها");
      return;
    }

    const headerHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/></head>
      <body>
      <table border="1">
        <thead>
          <tr style="background-color: #0F766E; color: #ffffff; font-weight: bold;">
            <th>المندوب</th>
            <th>المحافظة</th>
            <th>الشركة</th>
            <th>المادة</th>
            <th>الكمية</th>
            <th>سعر البيع المحفوظ</th>
            <th>إجمالي المبلغ</th>
            <th>التاريخ</th>
            <th>التارغت الشهري</th>
            <th>نسبة الإنجاز</th>
            <th>الملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${filteredSales
            .map(
              (r) => `
            <tr>
              <td>${r.delegateName}</td>
              <td>${r.governorate}</td>
              <td>${r.company}</td>
              <td>${r.item}</td>
              <td>${r.quantity}</td>
              <td>${r.unitPrice}</td>
              <td>${r.totalAmount}</td>
              <td>${r.date}</td>
              <td>${r.governorateTarget}</td>
              <td>${(r.achievementRate * 100).toFixed(1)}%</td>
              <td>${r.notes || ""}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      </body></html>
    `;

    const blob = new Blob(["\ufeff", headerHtml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `تقرير_مبيعات_المندوبين_${new Date().toISOString().slice(0, 10)}.xls`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    toast.success("تم تصدير التقرير الموحد بنجاح");
  };

  // Prepare Charts Data
  const govBarChartData = useMemo(() => {
    return govPerformances.map((g) => ({
      name: g.governorate,
      "المبيعات المحققة": g.totalSales,
      "الهدف (التارغت)": g.targetAmount,
      rate: g.achievementRate,
    }));
  }, [govPerformances]);

  const govPieChartData = useMemo(() => {
    return govPerformances.map((g) => ({
      name: g.governorate,
      value: g.totalSales,
    }));
  }, [govPerformances]);

  const topProductsChartData = useMemo(() => {
    return productsPerformance.slice(0, 6).map((p) => ({
      name: p.item,
      "إجمالي الإيراد": p.totalRevenue,
      "الكمية": p.totalQuantity,
    }));
  }, [productsPerformance]);

  if (loading && !data) {
    return (
      <div className="saas-dashboard-root flex flex-col items-center justify-center min-h-screen p-6">
        <div className="saas-card max-w-md text-center p-8 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 mx-auto grid place-items-center">
            <RefreshCw size={24} className="animate-spin" />
          </div>
          <h2 className="text-lg font-bold">جاري قراءة البيانات وتوحيد السجلات...</h2>
          <p className="text-xs text-slate-500">
            نقوم بمسح الـ 8 صفحات من Google Sheets واحتساب المبيعات والتارغت.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="saas-dashboard-root">
      {/* =========================================================================
          1. Header Section
          ========================================================================= */}
      <header className="saas-header">
        <div className="saas-header-container">
          <div className="saas-brand-area">
            <Link
              href="/"
              className="saas-back-btn"
              title="العودة للصفحة الرئيسية"
            >
              <ArrowRight size={18} />
            </Link>

            <div className="saas-title-group">
              <h1>
                <span>نبع الغدير العلمي</span>
                <span className="saas-live-badge">
                  <span className="saas-live-dot" />
                  {data?.sourceType === "live-sheets" ? "Google Sheets مباشر" : "البيانات الموثقة"}
                </span>
              </h1>
              <p>لوحة متابعة المبيعات وأداء المندوبين والمحافظات</p>
            </div>
          </div>

          <div className="saas-header-tools">
            {/* Source Modal Button */}
            <button
              onClick={() => {
                setTempUrlInput(sheetUrl);
                setConfigModalOpen(true);
              }}
              className="saas-btn text-xs"
              title="تعديل رابط Google Sheets"
            >
              <Globe size={14} className="text-teal-600" />
              <span>مصدر البيانات</span>
              <span className="text-[10px] text-slate-400 font-mono">({data?.lastUpdated})</span>
            </button>

            {/* Year & Month Period Selector */}
            <select
              value={filters.selectedMonthKey}
              onChange={(e) => setFilters({ ...filters, selectedMonthKey: e.target.value })}
              className="saas-select"
            >
              <option value="all">جميع الفترات الزمنية</option>
              {data?.availableMonths.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="saas-btn"
              title="تحديث البيانات"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-teal-600" : ""} />
              <span>تحديث</span>
            </button>

            {/* Export Excel */}
            <button
              onClick={exportToExcel}
              className="saas-btn saas-btn-primary"
              title="تصدير تقرير شامل إلى Excel"
            >
              <FileSpreadsheet size={14} />
              <span>تصدير Excel</span>
            </button>

            {/* Theme Toggle */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="saas-btn px-2.5"
                title="التبديل بين الوضع الليلي والنهاري"
              >
                {theme === "dark" ? (
                  <Sun size={16} className="text-amber-400" />
                ) : (
                  <MoonStar size={16} className="text-slate-600" />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          Main Content Container
          ========================================================================= */}
      <main className="saas-main-container space-y-6">
        {/* =========================================================================
            2. Executive Quick View (KPIs with Visual Hierarchy)
            ========================================================================= */}
        {kpis && (
          <section className="space-y-3">
            <div className="saas-kpi-grid">
              {/* Primary Hero: Total Sales */}
              <div className="saas-kpi-card hero-sales">
                <div>
                  <div className="saas-kpi-label">
                    <span>إجمالي المبيعات المحققة</span>
                    <Wallet size={16} className="text-teal-600" />
                  </div>
                  <div className="saas-kpi-value text-teal-700 dark:text-teal-300">
                    {formatCurrency(kpis.totalSales)}
                  </div>
                </div>
                <div className="saas-kpi-meta">
                  <TrendingUp size={14} className="text-teal-600" />
                  <span>{kpis.transactionCount} عملية بيع مسجلة</span>
                </div>
              </div>

              {/* Primary Hero: Achievement Rate & Remaining */}
              <div className="saas-kpi-card hero-achievement">
                <div>
                  <div className="saas-kpi-label">
                    <span>نسبة تحقيق التارغت</span>
                    <Flame size={16} className="text-emerald-600" />
                  </div>
                  <div className="saas-kpi-value text-emerald-600 dark:text-emerald-400">
                    {kpis.achievementRate.toFixed(1)}%
                  </div>
                  <div className="saas-progress-track">
                    <div
                      className={`saas-progress-bar ${
                        kpis.achievementRate >= 100
                          ? "is-success"
                          : kpis.achievementRate >= 80
                          ? "is-warning"
                          : "is-danger"
                      }`}
                      style={{ width: `${Math.min(100, kpis.achievementRate)}%` }}
                    />
                  </div>
                </div>
                <div className="saas-kpi-meta justify-between">
                  <span>المتبقي: {formatCurrency(kpis.remainingBalance)}</span>
                  <span className="font-bold text-emerald-600">
                    {kpis.achievementRate >= 100 ? "تجاوز الخطة" : "قيد الإنجاز"}
                  </span>
                </div>
              </div>

              {/* Secondary Metric: Total Units */}
              <div className="saas-kpi-card">
                <div>
                  <div className="saas-kpi-label">
                    <span>إجمالي القطع</span>
                    <Boxes size={16} className="text-slate-400" />
                  </div>
                  <div className="saas-kpi-value text-slate-800 dark:text-slate-100">
                    {kpis.totalQuantity.toLocaleString()}
                    <span className="saas-kpi-unit">قطعة</span>
                  </div>
                </div>
                <div className="saas-kpi-meta">
                  <Package size={14} />
                  <span>عبر {kpis.productsCount} مادة دوائية</span>
                </div>
              </div>

              {/* Secondary Metric: Target Amount */}
              <div className="saas-kpi-card">
                <div>
                  <div className="saas-kpi-label">
                    <span>التارغت المطلوب</span>
                    <Target size={16} className="text-slate-400" />
                  </div>
                  <div className="saas-kpi-value text-slate-700 dark:text-slate-200">
                    {formatCurrency(kpis.totalTarget)}
                  </div>
                </div>
                <div className="saas-kpi-meta">
                  <MapPin size={14} />
                  <span>لـ {kpis.governoratesCount} محافظات</span>
                </div>
              </div>

              {/* Secondary Metric: Coverage & Network */}
              <div className="saas-kpi-card">
                <div>
                  <div className="saas-kpi-label">
                    <span>شبكة التوزيع</span>
                    <Users size={16} className="text-slate-400" />
                  </div>
                  <div className="saas-kpi-value text-slate-800 dark:text-slate-100">
                    {kpis.delegatesCount}
                    <span className="saas-kpi-unit">مندوب ومذخر</span>
                  </div>
                </div>
                <div className="saas-kpi-meta">
                  <span>{kpis.companiesCount} شركات موردة</span>
                </div>
              </div>
            </div>

            {/* Executive Insights & Data Quality Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {executiveInsights.map((ins) => (
                  <div key={ins.id} className={`saas-insight-item type-${ins.type}`}>
                    <div>
                      <div className="saas-insight-title">{ins.title}</div>
                      <div className="saas-insight-desc">{ins.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Quality Pill */}
              {data?.dataHealth && (
                <div>
                  {data.dataHealth.incompleteSalesCount > 0 ? (
                    <button
                      onClick={() => setFilters({ ...filters, healthFilter: "incomplete-only" })}
                      className="saas-quality-pill has-issues"
                      title="عرض السجلات التي تحتاج مراجعة"
                    >
                      <AlertTriangle size={14} />
                      <span>{data.dataHealth.incompleteSalesCount} سجلات تحتاج مراجعة</span>
                    </button>
                  ) : (
                    <div className="saas-quality-pill">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>البيانات سليمة ومكتملة</span>
                    </div>
                  )}
                  {filters.healthFilter !== "all" && (
                    <button
                      onClick={() => setFilters({ ...filters, healthFilter: "all" })}
                      className="text-xs text-slate-500 hover:underline mr-2"
                    >
                      إلغاء الفلتر ✕
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* =========================================================================
            3. Governorates Performance Section
            ========================================================================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 size={18} className="text-teal-600" />
              مراقبة أداء المحافظات
            </h2>
            <span className="text-xs text-slate-500">
              اضغط على أي محافظة لفتح ملفها التحليلي الشامل
            </span>
          </div>

          <div className="saas-gov-grid">
            {govPerformances.map((gov) => {
              const isOver = gov.achievementRate >= 100;
              return (
                <div
                  key={gov.governorate}
                  onClick={() => setSelectedGovDrawer(gov)}
                  className="saas-gov-card"
                >
                  <div>
                    <div className="saas-gov-header">
                      <div className="saas-gov-title">
                        <MapPin size={16} className="text-teal-600" />
                        <span>{gov.governorate}</span>
                      </div>
                      <span className={`saas-status-badge status-${gov.statusColor}`}>
                        {gov.status} ({gov.achievementRate.toFixed(1)}%)
                      </span>
                    </div>

                    <div className="space-y-1.5 my-3">
                      <div className="saas-gov-metric-row">
                        <span className="text-slate-500">المبيعات:</span>
                        <span className="val">{formatCurrency(gov.totalSales)}</span>
                      </div>
                      <div className="saas-gov-metric-row">
                        <span className="text-slate-500">التارغت:</span>
                        <span className="val text-slate-500">{formatCurrency(gov.targetAmount)}</span>
                      </div>
                      <div className="saas-gov-metric-row">
                        <span className="text-slate-500">القطع المباعة:</span>
                        <span className="val text-teal-700 dark:text-teal-300">
                          {gov.totalQuantity.toLocaleString()} قطعة
                        </span>
                      </div>
                    </div>

                    <div className="saas-progress-track">
                      <div
                        className={`saas-progress-bar ${
                          isOver ? "is-success" : gov.achievementRate >= 80 ? "is-warning" : "is-danger"
                        }`}
                        style={{ width: `${Math.min(100, gov.achievementRate)}%` }}
                      />
                    </div>
                  </div>

                  <div className="saas-gov-footer">
                    <span className="text-slate-500">{gov.delegatesCount} مندوبين</span>
                    <span className="text-teal-600 font-bold flex items-center gap-1 hover:underline">
                      فتح الملف <ChevronLeft size={13} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            4. Visual Intelligence Charts Section
            ========================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart 1: Sales vs Target by Governorate */}
          <div className="saas-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 size={16} className="text-teal-600" />
                  مقارنة المبيعات المحققة مقابل التارغت لكل محافظة
                </h3>
                <p className="text-xs text-slate-500">مقارنة بصرية بين الفعلي والمستهدف</p>
              </div>
            </div>

            <div className="h-[270px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={govBarChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12, fontWeight: "bold" }} />
                  <YAxis
                    tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(val: number) => formatCurrency(val)}
                    contentStyle={{
                      borderRadius: 8,
                      direction: "rtl",
                      textAlign: "right",
                      backgroundColor: "var(--saas-surface)",
                      borderColor: "var(--saas-border)",
                      color: "var(--saas-text-primary)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                  <Bar dataKey="المبيعات المحققة" fill="#0F766E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="الهدف (التارغت)" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Governorates Market Share Donut */}
          <div className="saas-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <PieChartIcon size={16} className="text-teal-600" />
                  توزيع الحصة البيعية للمحافظات
                </h3>
                <p className="text-xs text-slate-500">نسبة مساهمة كل محافظة</p>
              </div>
            </div>

            <div className="h-[270px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={govPieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {govPieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => formatCurrency(val)}
                    contentStyle={{
                      borderRadius: 8,
                      direction: "rtl",
                      textAlign: "right",
                      backgroundColor: "var(--saas-surface)",
                      borderColor: "var(--saas-border)",
                      color: "var(--saas-text-primary)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. Cascading Multi-Dimension Filter Hub
            ========================================================================= */}
        <section className="saas-filter-bar">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                الفلاتر المترابطة والبحث
              </h3>
              <span className="text-xs text-slate-500">
                ({filteredSales.length} حركة مطابقة)
              </span>
            </div>

            <button
              onClick={resetAllFilters}
              className="text-xs font-bold text-slate-500 hover:text-teal-600 cursor-pointer"
            >
              إعادة تعيين الفلاتر ✕
            </button>
          </div>

          <div className="saas-filter-grid">
            {/* 1. Governorate Filter */}
            <div className="saas-field-group">
              <label>المحافظة:</label>
              <select
                value={filters.governorate}
                onChange={(e) => {
                  setFilters({ ...filters, governorate: e.target.value, delegate: "all" });
                  setCurrentPage(1);
                }}
                className="saas-input"
              >
                <option value="all">الكل (جميع المحافظات)</option>
                {data?.availableGovernorates.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* 2. Delegate Filter (Cascading) */}
            <div className="saas-field-group">
              <label>المندوب:</label>
              <select
                value={filters.delegate}
                onChange={(e) => {
                  setFilters({ ...filters, delegate: e.target.value });
                  setCurrentPage(1);
                }}
                className="saas-input"
              >
                <option value="all">الكل (جميع المندوبين)</option>
                {availableDelegatesForGov.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* 3. Company Filter */}
            <div className="saas-field-group">
              <label>الشركة الموردة:</label>
              <select
                value={filters.company}
                onChange={(e) => {
                  setFilters({ ...filters, company: e.target.value });
                  setCurrentPage(1);
                }}
                className="saas-input"
              >
                <option value="all">الكل (جميع الشركات)</option>
                {data?.availableCompanies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 4. Product Filter */}
            <div className="saas-field-group">
              <label>المادة الدوائية:</label>
              <select
                value={filters.product}
                onChange={(e) => {
                  setFilters({ ...filters, product: e.target.value });
                  setCurrentPage(1);
                }}
                className="saas-input"
              >
                <option value="all">الكل (جميع المواد)</option>
                {data?.availableProducts.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 5. Quick Search */}
            <div className="saas-field-group">
              <label>بحث فوري:</label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => {
                    setFilters({ ...filters, searchQuery: e.target.value });
                    setCurrentPage(1);
                  }}
                  placeholder="ابحث بأي اسم أو مادة..."
                  className="saas-input"
                />
                {filters.searchQuery && (
                  <button
                    onClick={() => setFilters({ ...filters, searchQuery: "" })}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            6. Tabbed Deep Analytical Section (5 Views)
            ========================================================================= */}
        <section className="space-y-4">
          <div className="saas-tabs-header">
            <button
              onClick={() => setActiveTab("table")}
              className={`saas-tab-trigger ${activeTab === "table" ? "is-active" : ""}`}
            >
              <TableProperties size={15} />
              <span>جدول المبيعات الموحد ({filteredSales.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("delegates")}
              className={`saas-tab-trigger ${activeTab === "delegates" ? "is-active" : ""}`}
            >
              <Users size={15} />
              <span>ترتيب المندوبين ({delegatesRanking.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("products")}
              className={`saas-tab-trigger ${activeTab === "products" ? "is-active" : ""}`}
            >
              <Package size={15} />
              <span>تحليل المواد ({productsPerformance.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("companies")}
              className={`saas-tab-trigger ${activeTab === "companies" ? "is-active" : ""}`}
            >
              <Building2 size={15} />
              <span>تحليل الشركات ({companyAnalytics.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("timeline")}
              className={`saas-tab-trigger ${activeTab === "timeline" ? "is-active" : ""}`}
            >
              <LineChart size={15} />
              <span>المسار الزمني للمبيعات</span>
            </button>
          </div>

          {/* =====================================================================
              TAB 1: Unified Sales Data Table
              ===================================================================== */}
          {activeTab === "table" && (
            <div className="saas-table-wrapper">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort("delegateName")} className="sortable">المندوب ⇕</th>
                    <th onClick={() => handleSort("governorate")} className="sortable">المحافظة ⇕</th>
                    <th onClick={() => handleSort("company")} className="sortable">الشركة ⇕</th>
                    <th onClick={() => handleSort("item")} className="sortable">المادة ⇕</th>
                    <th onClick={() => handleSort("quantity")} className="sortable" style={{ textAlign: "center" }}>الكمية ⇕</th>
                    <th onClick={() => handleSort("unitPrice")} className="sortable" style={{ textAlign: "left" }}>سعر البيع المحفوظ ⇕</th>
                    <th onClick={() => handleSort("totalAmount")} className="sortable" style={{ textAlign: "left" }}>إجمالي المبلغ ⇕</th>
                    <th onClick={() => handleSort("date")} className="sortable" style={{ textAlign: "center" }}>التاريخ ⇕</th>
                    <th onClick={() => handleSort("achievementRate")} className="sortable" style={{ textAlign: "center" }}>نسبة من التارغت ⇕</th>
                    <th style={{ textAlign: "center" }}>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndPaginatedSales.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: "48px", color: "var(--saas-text-muted)" }}>
                        لا توجد حركات مبيعات مطابقة للفلاتر المحددة
                      </td>
                    </tr>
                  ) : (
                    sortedAndPaginatedSales.rows.map((row) => {
                      const isIncomplete = row.status === "incomplete";
                      return (
                        <tr
                          key={row.id}
                          className={isIncomplete ? "is-incomplete cursor-pointer" : "cursor-pointer"}
                          onClick={() => setSelectedSaleModal(row)}
                        >
                          <td style={{ fontWeight: 800 }}>
                            {row.delegateName}
                            {isIncomplete && (
                              <span style={{ marginRight: 6, color: "var(--saas-warning)" }} title={row.anomalies.join("، ")}>
                                ⚠️
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="saas-status-badge status-teal">{row.governorate}</span>
                          </td>
                          <td style={{ fontWeight: 700, color: "var(--saas-text-secondary)" }}>{row.company}</td>
                          <td style={{ fontWeight: 800, color: "var(--saas-brand)" }}>{row.item}</td>
                          <td style={{ textAlign: "center", fontWeight: 800 }}>{row.quantity.toLocaleString()}</td>
                          <td style={{ textAlign: "left", color: "var(--saas-text-secondary)" }}>{formatCurrency(row.unitPrice)}</td>
                          <td style={{ textAlign: "left", fontWeight: 900 }}>{formatCurrency(row.totalAmount)}</td>
                          <td style={{ textAlign: "center", color: "var(--saas-text-muted)" }}>{row.date || "—"}</td>
                          <td style={{ textAlign: "center", fontWeight: 800, color: "var(--saas-success)" }}>
                            {(row.achievementRate * 100).toFixed(1)}%
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSaleModal(row);
                              }}
                              className="text-teal-600 hover:underline text-xs font-bold"
                            >
                              عرض
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Table Footer & Pagination */}
              <div className="saas-table-pagination">
                <span>
                  عرض {sortedAndPaginatedSales.rows.length} من أصل {sortedAndPaginatedSales.totalCount} حركة بيع
                </span>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="saas-btn text-xs h-8 px-3"
                  >
                    السابق
                  </button>

                  <span className="font-bold">
                    صفحة {sortedAndPaginatedSales.safePage} من {sortedAndPaginatedSales.totalPages}
                  </span>

                  <button
                    disabled={currentPage >= sortedAndPaginatedSales.totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="saas-btn text-xs h-8 px-3"
                  >
                    التالي
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 2: Delegates Leaderboard
              ===================================================================== */}
          {activeTab === "delegates" && (
            <div className="saas-table-wrapper">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "center", width: 50 }}>#</th>
                    <th>المندوب</th>
                    <th>المحافظة</th>
                    <th>الكود</th>
                    <th style={{ textAlign: "left" }}>إجمالي المبيعات</th>
                    <th style={{ textAlign: "center" }}>القطع المباعة</th>
                    <th style={{ textAlign: "center" }}>عدد العمليات</th>
                    <th style={{ textAlign: "center" }}>نسبة المساهمة بالمحافظة</th>
                    <th>أفضل مادة باعها</th>
                    <th style={{ textAlign: "center" }}>تفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {delegatesRanking.map((del) => (
                    <tr
                      key={del.delegateName}
                      className="cursor-pointer"
                      onClick={() => setSelectedDelegateDrawer(del)}
                    >
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-grid",
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            placeItems: "center",
                            fontWeight: 800,
                            fontSize: "0.72rem",
                            background: del.rank === 1 ? "#fbbf24" : del.rank === 2 ? "#cbd5e1" : del.rank === 3 ? "#d97706" : "var(--saas-surface-subtle)",
                            color: del.rank <= 3 ? "#0f172a" : "inherit",
                          }}
                        >
                          {del.rank}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800 }}>{del.delegateName}</td>
                      <td><span className="saas-status-badge status-teal">{del.governorate}</span></td>
                      <td style={{ color: "var(--saas-text-muted)", fontFamily: "monospace" }}>{del.code || "—"}</td>
                      <td style={{ textAlign: "left", fontWeight: 900 }}>{formatCurrency(del.totalSales)}</td>
                      <td style={{ textAlign: "center", fontWeight: 800, color: "var(--saas-brand)" }}>{del.totalQuantity.toLocaleString()}</td>
                      <td style={{ textAlign: "center" }}>{del.transactionCount}</td>
                      <td style={{ textAlign: "center", fontWeight: 800, color: "var(--saas-success)" }}>
                        {del.shareOfGovernorateRate.toFixed(1)}%
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--saas-brand)" }}>{del.topProduct}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDelegateDrawer(del);
                          }}
                          className="text-teal-600 hover:underline text-xs font-bold"
                        >
                          عرض الملف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* =====================================================================
              TAB 3: Product Performance Analytics
              ===================================================================== */}
          {activeTab === "products" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  تحليل حركة ومبيعات الأصناف الـ 26 المسجلة
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">الترتيب حسب:</span>
                  <button
                    onClick={() => setProductSortMode("revenue")}
                    className={`saas-btn text-xs h-7 px-2.5 ${productSortMode === "revenue" ? "saas-btn-primary" : ""}`}
                  >
                    قيمة الإيراد
                  </button>
                  <button
                    onClick={() => setProductSortMode("quantity")}
                    className={`saas-btn text-xs h-7 px-2.5 ${productSortMode === "quantity" ? "saas-btn-primary" : ""}`}
                  >
                    الكمية المباعة
                  </button>
                </div>
              </div>

              <div className="saas-table-wrapper">
                <table className="saas-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center", width: 50 }}>#</th>
                      <th>المادة الدوائية</th>
                      <th>الشركة الموردة</th>
                      <th style={{ textAlign: "left" }}>السعر الحالي (Master)</th>
                      <th style={{ textAlign: "center" }}>الكمية المباعة</th>
                      <th style={{ textAlign: "left" }}>إجمالي الإيراد</th>
                      <th style={{ textAlign: "center" }}>الحصة من المبيعات</th>
                      <th>أفضل محافظة للمادة</th>
                      <th>أفضل مندوب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsPerformance.map((p) => (
                      <tr key={p.item}>
                        <td style={{ textAlign: "center", fontWeight: 800, color: "var(--saas-text-muted)" }}>{p.rank}</td>
                        <td style={{ fontWeight: 800 }}>{p.item}</td>
                        <td><span className="saas-status-badge status-teal">{p.company}</span></td>
                        <td style={{ textAlign: "left", color: "var(--saas-text-muted)" }}>{formatCurrency(p.unitPrice)}</td>
                        <td style={{ textAlign: "center", fontWeight: 800, color: "var(--saas-brand)" }}>{p.totalQuantity.toLocaleString()} قطعة</td>
                        <td style={{ textAlign: "left", fontWeight: 900 }}>{formatCurrency(p.totalRevenue)}</td>
                        <td style={{ textAlign: "center", fontWeight: 800, color: "var(--saas-success)" }}>
                          {p.shareOfTotalSales.toFixed(1)}%
                        </td>
                        <td style={{ fontWeight: 700 }}>{p.topGovernorate}</td>
                        <td style={{ color: "var(--saas-text-secondary)" }}>{p.topDelegate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 4: Companies Analytics
              ===================================================================== */}
          {activeTab === "companies" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyAnalytics.map((c) => (
                <div key={c.company} className="saas-card space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 grid place-items-center">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100">شركة {c.company}</h4>
                        <span className="text-xs text-slate-500">{c.skuCount} مادة دوائية مسجلة</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-500">الحصة السوقية</span>
                      <h3 className="font-black text-lg text-teal-600 dark:text-teal-400">
                        {c.marketShareRate.toFixed(1)}%
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500">إجمالي المبيعات:</span>
                      <strong className="block text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
                        {formatCurrency(c.totalSales)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-500">القطع المسحوبة:</span>
                      <strong className="block text-sm font-black text-teal-600 dark:text-teal-400 mt-1">
                        {c.totalQuantity.toLocaleString()} قطعة
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500">توزيع المبيعات على المحافظات:</span>
                    <div className="space-y-2">
                      {c.governoratesDistribution.map((gd) => (
                        <div key={gd.governorate} className="text-xs">
                          <div className="flex justify-between font-bold mb-1">
                            <span>{gd.governorate}</span>
                            <span>{formatCurrency(gd.sales)} ({gd.share.toFixed(0)}%)</span>
                          </div>
                          <div className="saas-progress-track" style={{ margin: 0, height: 6 }}>
                            <div className="saas-progress-bar" style={{ width: `${gd.share}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* =====================================================================
              TAB 5: Sales Timeline
              ===================================================================== */}
          {activeTab === "timeline" && (
            <div className="saas-card space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <LineChart size={16} className="text-teal-600" />
                  حركة ومسار المبيعات التراكمية بمرور الأيام
                </h3>
                <p className="text-xs text-slate-500">تتبع نمو الإيراد المالي الإجمالي عبر تواريخ الحركات المسجلة</p>
              </div>

              <div className="h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelinePoints} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="saasSalesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F766E" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="displayDate" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val: number) => formatCurrency(val)}
                      contentStyle={{
                        borderRadius: 8,
                        direction: "rtl",
                        textAlign: "right",
                        backgroundColor: "var(--saas-surface)",
                        borderColor: "var(--saas-border)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativeSales"
                      name="المبيعات التراكمية"
                      stroke="#0F766E"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#saasSalesGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* =========================================================================
          DRAWER 1: Governorate Focus File Drawer
          ========================================================================= */}
      {selectedGovDrawer && (
        <div className="saas-drawer-backdrop" onClick={() => setSelectedGovDrawer(null)}>
          <div className="saas-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="saas-drawer-header">
              <div className="saas-drawer-title">
                <MapPin className="text-teal-600" />
                <span>ملف محافظة {selectedGovDrawer.governorate}</span>
              </div>
              <button
                onClick={() => setSelectedGovDrawer(null)}
                className="saas-drawer-close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 text-xs">
              {/* Financial Status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="text-slate-500 font-bold">المبيعات</span>
                  <strong className="block text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
                    {formatCurrency(selectedGovDrawer.totalSales)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="text-slate-500 font-bold">التارغت</span>
                  <strong className="block text-sm font-black text-slate-500 mt-1">
                    {formatCurrency(selectedGovDrawer.targetAmount)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="text-slate-500 font-bold">نسبة الإنجاز</span>
                  <strong className="block text-sm font-black text-emerald-600 mt-1">
                    {selectedGovDrawer.achievementRate.toFixed(1)}%
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="text-slate-500 font-bold">القطع</span>
                  <strong className="block text-sm font-black text-teal-600 mt-1">
                    {selectedGovDrawer.totalQuantity.toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Best Performers in Gov */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <span className="text-slate-500">أفضل مندوب:</span>
                  <strong className="block text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedGovDrawer.bestDelegate}
                  </strong>
                  <span className="text-teal-600 font-bold">{formatCurrency(selectedGovDrawer.bestDelegateSales)}</span>
                </div>
                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <span className="text-slate-500">أفضل مادة:</span>
                  <strong className="block text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedGovDrawer.bestProduct}
                  </strong>
                  <span className="text-teal-600 font-bold">{formatCurrency(selectedGovDrawer.bestProductSales)}</span>
                </div>
                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <span className="text-slate-500">أفضل شركة:</span>
                  <strong className="block text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedGovDrawer.bestCompany}
                  </strong>
                  <span className="text-slate-400">الأعلى طلباً</span>
                </div>
              </div>

              {/* Delegates in Gov */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">أداء مندوبي ومذاخر {selectedGovDrawer.governorate}:</h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500">
                      <tr>
                        <th className="p-2 text-right">المندوب</th>
                        <th className="p-2 text-left">المبيعات</th>
                        <th className="p-2 text-center">القطع</th>
                        <th className="p-2 text-center">المساهمة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedGovDrawer.delegatesList.map((del) => (
                        <tr key={del.name}>
                          <td className="p-2 font-bold">{del.name}</td>
                          <td className="p-2 text-left font-bold">{formatCurrency(del.sales)}</td>
                          <td className="p-2 text-center">{del.qty.toLocaleString()}</td>
                          <td className="p-2 text-center font-bold text-emerald-600">{del.share.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Filter Button */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-2">
                <button
                  onClick={() => {
                    setFilters({ ...filters, governorate: selectedGovDrawer.governorate });
                    setSelectedGovDrawer(null);
                  }}
                  className="saas-btn saas-btn-primary"
                >
                  تصفية لوحة التحكم لمحافظة {selectedGovDrawer.governorate} فقط
                </button>
                <button
                  onClick={() => setSelectedGovDrawer(null)}
                  className="saas-btn"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DRAWER 2: Delegate Focus Drawer
          ========================================================================= */}
      {selectedDelegateDrawer && (
        <div className="saas-drawer-backdrop" onClick={() => setSelectedDelegateDrawer(null)}>
          <div className="saas-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="saas-drawer-header">
              <div className="saas-drawer-title">
                <Users className="text-teal-600" />
                <span>ملف المندوب: {selectedDelegateDrawer.delegateName}</span>
              </div>
              <button
                onClick={() => setSelectedDelegateDrawer(null)}
                className="saas-drawer-close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">المحافظة:</span>
                  <strong className="font-bold">{selectedDelegateDrawer.governorate}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">كود المندوب:</span>
                  <span className="font-mono">{selectedDelegateDrawer.code || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">إجمالي المبيعات المحققة:</span>
                  <strong className="font-bold text-teal-600 text-sm">{formatCurrency(selectedDelegateDrawer.totalSales)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">القطع المباعة:</span>
                  <strong className="font-bold">{selectedDelegateDrawer.totalQuantity.toLocaleString()} قطعة</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">نسبة مساهمته في مبيعات المحافظة:</span>
                  <strong className="font-bold text-emerald-600">{selectedDelegateDrawer.shareOfGovernorateRate.toFixed(1)}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المادة الأكثر مبيعاً له:</span>
                  <strong className="font-bold text-teal-700 dark:text-teal-300">{selectedDelegateDrawer.topProduct}</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-2">
                <button
                  onClick={() => {
                    setFilters({ ...filters, delegate: selectedDelegateDrawer.delegateName });
                    setSelectedDelegateDrawer(null);
                  }}
                  className="saas-btn saas-btn-primary"
                >
                  تصفية لوحة التحكم لهذا المندوب فقط
                </button>
                <button
                  onClick={() => setSelectedDelegateDrawer(null)}
                  className="saas-btn"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DRAWER 3: Transaction Detail Modal / Drawer
          ========================================================================= */}
      {selectedSaleModal && (
        <div className="saas-drawer-backdrop" onClick={() => setSelectedSaleModal(null)}>
          <div className="saas-drawer-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="saas-drawer-header">
              <div className="saas-drawer-title">
                <FileSpreadsheet className="text-teal-600" />
                <span>تفاصيل عملية البيع</span>
              </div>
              <button onClick={() => setSelectedSaleModal(null)} className="saas-drawer-close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">المندوب:</span>
                  <strong className="font-bold">{selectedSaleModal.delegateName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المحافظة:</span>
                  <strong className="font-bold">{selectedSaleModal.governorate}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الشركة الموردة:</span>
                  <strong className="font-bold">{selectedSaleModal.company}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المادة الدوائية:</span>
                  <strong className="font-bold text-teal-600 text-sm">{selectedSaleModal.item}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الكمية:</span>
                  <strong className="font-bold">{selectedSaleModal.quantity.toLocaleString()} قطعة</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">سعر البيع المحفوظ (Snapshot):</span>
                  <strong className="font-bold">{formatCurrency(selectedSaleModal.unitPrice)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">إجمالي المبلغ:</span>
                  <strong className="font-black text-slate-900 dark:text-slate-100 text-sm">{formatCurrency(selectedSaleModal.totalAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">تاريخ العملية:</span>
                  <span className="font-mono">{selectedSaleModal.date || "غير مسجل"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">نسبة العملية من التارغت:</span>
                  <span className="font-bold text-emerald-600">{(selectedSaleModal.achievementRate * 100).toFixed(2)}%</span>
                </div>
                {selectedSaleModal.notes && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">الملاحظات:</span>
                    <span>{selectedSaleModal.notes}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button onClick={() => setSelectedSaleModal(null)} className="saas-btn">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: Google Sheets URL Connector
          ========================================================================= */}
      {configModalOpen && (
        <div className="saas-drawer-backdrop" onClick={() => setConfigModalOpen(false)}>
          <div className="saas-card max-w-md w-full m-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-teal-600" />
                <h3 className="font-bold text-base">مصدر بيانات Google Sheets</h3>
              </div>
              <button onClick={() => setConfigModalOpen(false)} className="saas-drawer-close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="font-bold block mb-1">رابط Google Sheets المنشور:</span>
                <input
                  type="text"
                  value={tempUrlInput}
                  onChange={(e) => setTempUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/e/.../pub"
                  className="saas-input"
                />
              </label>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-1 text-slate-500">
                <strong className="text-slate-800 dark:text-slate-200 block font-bold">تعليمات النشر:</strong>
                <p>1. افتح الجدول في Google Sheets.</p>
                <p>2. اضغط على ملف (File) ⬅️ مشاركة (Share) ⬅️ نشر على الويب (Publish to web).</p>
                <p>3. اختر نشر كامل المستند أو التنسيق المطلوب، والصق الرابط هنا.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setConfigModalOpen(false)} className="saas-btn">
                  إلغاء
                </button>
                <button onClick={handleSaveSheetUrl} className="saas-btn saas-btn-primary">
                  حفظ وتحديث البيانات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TestDashboard;
