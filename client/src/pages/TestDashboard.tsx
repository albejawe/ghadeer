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
  GovernoratePerformance,
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

const CHART_COLORS = ["#0F766E", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#10B981"];

const currency = (val: number) => {
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

  // Modals
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [tempUrlInput, setTempUrlInput] = useState(sheetUrl);
  const [selectedGovModal, setSelectedGovModal] = useState<GovernoratePerformance | null>(null);

  // Filters State
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<"table" | "delegates" | "products" | "companies" | "timeline">("table");

  // Table Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState<keyof UnifiedSaleRecord>("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Load Data on Mount or URL change
  const loadData = async (urlToUse?: string) => {
    setLoading(true);
    try {
      const result = await fetchGoogleSpreadsheetData(urlToUse || sheetUrl);
      setData(result);
      if (result.sourceType === "live-sheets") {
        toast.success("تم الاتصال وتحديث البيانات من Google Sheets بنجاح");
      }
    } catch (err) {
      toast.error("تعذر جلب البيانات، تم الاعتماد على البيانات الموثقة");
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

  // Filtered Sales Dataset
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
    return computeGovernoratesPerformance(filteredSales, data.targets, filters);
  }, [data, filteredSales, filters]);

  // Delegates Ranking
  const delegatesRanking = useMemo(() => {
    if (!data) return [];
    return computeDelegatesRanking(filteredSales, data.delegates);
  }, [data, filteredSales]);

  // Products Performance
  const productsPerformance = useMemo(() => {
    if (!data) return [];
    return computeProductPerformance(filteredSales, data.products);
  }, [data, filteredSales]);

  // Companies Market Share
  const companyAnalytics = useMemo(() => {
    if (!data) return [];
    return computeCompanyAnalytics(filteredSales);
  }, [filteredSales]);

  // Timeline Trend Points
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
            <th>العدد</th>
            <th>سعر المادة</th>
            <th>إجمالي المبلغ</th>
            <th>التاريخ</th>
            <th>تارجت المحافظة</th>
            <th>نسبة الإنجاز</th>
            <th>المصدر</th>
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
              <td>${r.sheetSource}</td>
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

  return (
    <div className="analytics-command-page">
      {/* Top Futuristic Command Header */}
      <header className="command-header">
        <div className="header-container">
          <div className="command-brand">
            <Link
              href="/"
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-500/20 hover:text-teal-600 grid place-items-center transition-all text-slate-700 dark:text-slate-200"
              title="العودة للرئيسية"
            >
              <ArrowRight size={18} />
            </Link>

            <div className="command-logo-glow">
              <Sparkles size={22} />
            </div>

            <div className="command-title-group">
              <h1>
                <span>غدير — التحليل الذكي والمراقبة الميدانية</span>
                <span className="status-pill pill-teal text-[10px]">
                  <Activity size={10} className="animate-pulse" /> مباشر
                </span>
              </h1>
              <p>نظام ذكي متصل بـ Google Sheets لمراقبة مبيعات المندوبين والمحافظات</p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Data Source Connector Pill */}
            <button
              onClick={() => {
                setTempUrlInput(sheetUrl);
                setConfigModalOpen(true);
              }}
              className="glass-btn"
              title="إعدادات Google Sheets"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${data?.sourceType === "live-sheets" ? "bg-emerald-500 animate-pulse" : "bg-teal-500"}`} />
              <span>{data?.sourceType === "live-sheets" ? "Google Sheets متصل" : "البيانات الموثقة"}</span>
              <span className="text-[11px] text-slate-400 font-mono">({data?.lastUpdated || "00:00"})</span>
              <ExternalLink size={12} className="text-slate-400 mr-1" />
            </button>

            {/* Period Selector */}
            <select
              value={filters.selectedMonthKey}
              onChange={(e) => setFilters({ ...filters, selectedMonthKey: e.target.value })}
              className="filter-custom-select text-xs font-bold"
              style={{ width: "auto", minWidth: "150px" }}
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
              className="glass-btn"
              title="تحديث البيانات"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-teal-500" : ""} />
              <span>تحديث</span>
            </button>

            {/* Export Report */}
            <button
              onClick={exportToExcel}
              className="glass-btn btn-accent"
              title="تصدير تقرير Excel"
            >
              <FileSpreadsheet size={14} />
              <span>تصدير Excel</span>
            </button>

            {/* Theme Toggle */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid place-items-center transition-all cursor-pointer"
                title="تبديل الوضع"
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

      {/* Main Command Center Container */}
      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "24px 20px" }} className="space-y-6">
        {/* =========================================================================
            SECTION 1: Executive Futuristic KPI Glow Cards
            ========================================================================= */}
        {kpis && (
          <div className="kpi-command-grid">
            {/* 1. Total Sales */}
            <div className="kpi-glow-card">
              <div className="kpi-card-header">
                <span className="kpi-card-title">إجمالي المبيعات المحققة</span>
                <div className="kpi-icon-pill">
                  <Wallet size={18} />
                </div>
              </div>
              <div className="kpi-card-value text-teal-600 dark:text-teal-400">
                {currency(kpis.totalSales)}
              </div>
              <div className="kpi-card-footer">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <TrendingUp size={14} className="text-teal-500" />
                  {kpis.transactionCount} حركة بيع مسجلة
                </span>
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                  {((kpis.totalSales / (kpis.totalTarget || 1)) * 100).toFixed(1)}% من التارغت
                </span>
              </div>
            </div>

            {/* 2. Total Quantity */}
            <div className="kpi-glow-card">
              <div className="kpi-card-header">
                <span className="kpi-card-title">إجمالي القطع المباعة</span>
                <div className="kpi-icon-pill" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3B82F6" }}>
                  <Boxes size={18} />
                </div>
              </div>
              <div className="kpi-card-value text-blue-600 dark:text-blue-400">
                {kpis.totalQuantity.toLocaleString()} قطعة
              </div>
              <div className="kpi-card-footer">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Package size={14} className="text-blue-500" />
                  عبر {kpis.productsCount} مادة دوائية
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {kpis.companiesCount} شركات موردة
                </span>
              </div>
            </div>

            {/* 3. Total Target */}
            <div className="kpi-glow-card">
              <div className="kpi-card-header">
                <span className="kpi-card-title">التارغت الإجمالي المستهدف</span>
                <div className="kpi-icon-pill" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6" }}>
                  <Target size={18} />
                </div>
              </div>
              <div className="kpi-card-value text-indigo-600 dark:text-indigo-400">
                {currency(kpis.totalTarget)}
              </div>
              <div className="kpi-card-footer">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin size={14} className="text-indigo-500" />
                  لـ {kpis.governoratesCount} محافظات
                </span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {kpis.delegatesCount} مندوب ومذخر
                </span>
              </div>
            </div>

            {/* 4. Achievement Rate */}
            <div className="kpi-glow-card">
              <div className="kpi-card-header">
                <span className="kpi-card-title">نسبة الإنجاز الكلية</span>
                <div className="kpi-icon-pill" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10B981" }}>
                  <Flame size={18} />
                </div>
              </div>
              <div className="kpi-card-value text-emerald-600 dark:text-emerald-400">
                {kpis.achievementRate.toFixed(2)}%
              </div>
              <div className="progress-rail">
                <div
                  className="progress-fill fill-emerald"
                  style={{ width: `${Math.min(100, kpis.achievementRate)}%` }}
                />
              </div>
              <div className="kpi-card-footer" style={{ marginTop: 6, paddingTop: 6 }}>
                <span className="text-slate-500 dark:text-slate-400">
                  المتبقي: {currency(kpis.remainingBalance)}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {kpis.achievementRate >= 100 ? "مكتمل 🎯" : "جاري التقدم ⚡"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 2: Data Quality & Health Strip
            ========================================================================= */}
        {data?.dataHealth && (
          <div className="command-filter-box flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 grid place-items-center">
                <ShieldCheck size={18} />
              </div>
              <div className="text-xs">
                <span className="font-black text-slate-800 dark:text-slate-100">فحص وتدقيق جودة البيانات: </span>
                <span className="text-slate-500 dark:text-slate-400">
                  تم فحص {data.dataHealth.totalRowsScanned} صف، واستبعاد {data.dataHealth.ignoredTemplateRows} صف فارغ، واعتماد {data.dataHealth.validSalesCount} حركة بيع صحيحة.
                </span>
              </div>
            </div>

            {/* Quick Health Chips */}
            <div className="flex items-center gap-2">
              {data.dataHealth.missingDelegateCount > 0 && (
                <button
                  onClick={() => setFilters({ ...filters, healthFilter: "missing-delegate" })}
                  className="status-pill pill-amber cursor-pointer hover:opacity-80"
                >
                  <AlertTriangle size={12} />
                  <span>{data.dataHealth.missingDelegateCount} بدون مندوب</span>
                </button>
              )}
              {data.dataHealth.missingCompanyCount > 0 && (
                <button
                  onClick={() => setFilters({ ...filters, healthFilter: "missing-company" })}
                  className="status-pill pill-rose cursor-pointer hover:opacity-80"
                >
                  <AlertCircle size={12} />
                  <span>{data.dataHealth.missingCompanyCount} بدون شركة</span>
                </button>
              )}
              {filters.healthFilter !== "all" && (
                <button
                  onClick={() => setFilters({ ...filters, healthFilter: "all" })}
                  className="glass-btn text-xs py-1 px-2.5"
                >
                  إلغاء فلتر الجودة ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 3: Governorates Radar Cards Grid
            ========================================================================= */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
                مراقبة أداء المحافظات الـ 4 المستهدفة
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اضغط على أي محافظة لفتح الكشف التحليلي المفصل والمندوبين
              </p>
            </div>
          </div>

          <div className="gov-radar-grid">
            {govPerformances.map((gov) => {
              const isOver = gov.achievementRate >= 100;
              return (
                <div
                  key={gov.governorate}
                  onClick={() => setSelectedGovModal(gov)}
                  className={`gov-radar-card status-${gov.statusColor}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-teal-600 grid place-items-center font-black">
                        <MapPin size={16} />
                      </div>
                      <h3 className="font-black text-base text-slate-900 dark:text-slate-100">{gov.governorate}</h3>
                    </div>

                    <span className={`status-pill pill-${gov.statusColor}`}>
                      {gov.status}
                    </span>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-2 mb-2 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-500 dark:text-slate-400">المبيعات المحققة:</span>
                      <strong className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">
                        {currency(gov.totalSales)}
                      </strong>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-500 dark:text-slate-400">التارغت المطلوب:</span>
                      <span className="font-semibold text-slate-500 dark:text-slate-400 font-mono">
                        {currency(gov.targetAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-500 dark:text-slate-400">القطع المباعة:</span>
                      <span className="font-bold text-teal-600 dark:text-teal-400 font-mono">
                        {gov.totalQuantity.toLocaleString()} قطعة
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="progress-rail">
                    <div
                      className={`progress-fill fill-${gov.statusColor}`}
                      style={{ width: `${Math.min(100, gov.achievementRate)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-slate-500 dark:text-slate-400">
                      الإنجاز: <strong className={isOver ? "text-emerald-500" : "text-slate-900 dark:text-slate-100"}>{gov.achievementRate.toFixed(1)}%</strong>
                    </span>
                    <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 hover:underline">
                      تفاصيل المحافظة <ChevronLeft size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            SECTION 4: Visual Analytics Charts (Recharts)
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Dual Bar Chart */}
          <div className="command-filter-box lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 size={16} className="text-teal-600" />
                  مقارنة المبيعات المحققة مقابل التارغت لكل محافظة
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  مقارنة بالأعمدة المزدوجة بين الفعلي والمستهدف
                </p>
              </div>
            </div>

            <div className="h-[280px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={govBarChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12, fontWeight: "bold" }} />
                  <YAxis
                    tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(val: number) => currency(val)}
                    contentStyle={{ borderRadius: 12, direction: "rtl", textAlign: "right", background: "#0f172a", color: "#fff", border: "none" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10 }} />
                  <Bar dataKey="المبيعات المحققة" fill="#0F766E" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="الهدف (التارغت)" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="command-filter-box">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <PieChartIcon size={16} className="text-teal-600" />
                  توزيع الحصة البيعية للمحافظات
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  نسبة مساهمة كل محافظة من المبيعات
                </p>
              </div>
            </div>

            <div className="h-[280px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={govPieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {govPieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => currency(val)}
                    contentStyle={{ borderRadius: 12, direction: "rtl", textAlign: "right", background: "#0f172a", color: "#fff", border: "none" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 5: High-Tech Cascading Command Filter Bar
            ========================================================================= */}
        <div className="command-filter-box">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-teal-600" />
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                لوحة الفلاتر الذكية والبحث المتقدم
              </h3>
              <span className="status-pill pill-teal font-mono text-xs">
                {filteredSales.length} حركة مطابقة
              </span>
            </div>

            <button
              onClick={resetAllFilters}
              className="glass-btn text-xs"
            >
              إعادة تعيين الفلاتر ✕
            </button>
          </div>

          <div className="filter-grid-layout">
            {/* 1. Governorate */}
            <div className="filter-input-group">
              <label>المحافظة:</label>
              <select
                value={filters.governorate}
                onChange={(e) => {
                  setFilters({ ...filters, governorate: e.target.value, delegate: "all" });
                  setCurrentPage(1);
                }}
                className="filter-custom-select"
              >
                <option value="all">الكل (جميع المحافظات)</option>
                {data?.availableGovernorates.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* 2. Delegate (Cascading) */}
            <div className="filter-input-group">
              <label>المندوب:</label>
              <select
                value={filters.delegate}
                onChange={(e) => {
                  setFilters({ ...filters, delegate: e.target.value });
                  setCurrentPage(1);
                }}
                className="filter-custom-select"
              >
                <option value="all">الكل (جميع المندوبين)</option>
                {availableDelegatesForGov.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* 3. Company */}
            <div className="filter-input-group">
              <label>الشركة:</label>
              <select
                value={filters.company}
                onChange={(e) => {
                  setFilters({ ...filters, company: e.target.value });
                  setCurrentPage(1);
                }}
                className="filter-custom-select"
              >
                <option value="all">الكل (جميع الشركات)</option>
                {data?.availableCompanies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 4. Product */}
            <div className="filter-input-group">
              <label>المادة الدوائية:</label>
              <select
                value={filters.product}
                onChange={(e) => {
                  setFilters({ ...filters, product: e.target.value });
                  setCurrentPage(1);
                }}
                className="filter-custom-select"
              >
                <option value="all">الكل (جميع المواد)</option>
                {data?.availableProducts.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 5. Quick Search */}
            <div className="filter-input-group">
              <label>بحث سريع:</label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => {
                    setFilters({ ...filters, searchQuery: e.target.value });
                    setCurrentPage(1);
                  }}
                  placeholder="ابحث بأي نص..."
                  className="filter-custom-input"
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
        </div>

        {/* =========================================================================
            SECTION 6: Tabbed Deep Analytical Views (5 Tabs)
            ========================================================================= */}
        <div className="space-y-4">
          <div className="command-tabs-nav">
            <button
              onClick={() => setActiveTab("table")}
              className={`command-tab-btn ${activeTab === "table" ? "active" : ""}`}
            >
              <TableProperties size={15} />
              <span>جدول المبيعات الموحد ({filteredSales.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("delegates")}
              className={`command-tab-btn ${activeTab === "delegates" ? "active" : ""}`}
            >
              <Users size={15} />
              <span>ترتيب المندوبين ({delegatesRanking.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("products")}
              className={`command-tab-btn ${activeTab === "products" ? "active" : ""}`}
            >
              <Package size={15} />
              <span>تحليل المواد ({productsPerformance.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("companies")}
              className={`command-tab-btn ${activeTab === "companies" ? "active" : ""}`}
            >
              <Building2 size={15} />
              <span>تحليل الشركات ({companyAnalytics.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("timeline")}
              className={`command-tab-btn ${activeTab === "timeline" ? "active" : ""}`}
            >
              <LineChart size={15} />
              <span>المسار الزمني للمبيعات</span>
            </button>
          </div>

          {/* TAB 1: Unified Sales Matrix Table */}
          {activeTab === "table" && (
            <div className="matrix-table-container">
              <div style={{ overflowX: "auto" }}>
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort("delegateName")}>المندوب ⇕</th>
                      <th onClick={() => handleSort("governorate")}>المحافظة ⇕</th>
                      <th onClick={() => handleSort("company")}>الشركة ⇕</th>
                      <th onClick={() => handleSort("item")}>المادة ⇕</th>
                      <th onClick={() => handleSort("quantity")} style={{ textAlign: "center" }}>العدد ⇕</th>
                      <th onClick={() => handleSort("unitPrice")} style={{ textAlign: "left" }}>سعر المادة ⇕</th>
                      <th onClick={() => handleSort("totalAmount")} style={{ textAlign: "left" }}>إجمالي المبلغ ⇕</th>
                      <th onClick={() => handleSort("date")} style={{ textAlign: "center" }}>التاريخ ⇕</th>
                      <th onClick={() => handleSort("governorateTarget")} style={{ textAlign: "left" }}>تارجت المحافظة ⇕</th>
                      <th onClick={() => handleSort("achievementRate")} style={{ textAlign: "center" }}>نسبة الإنجاز ⇕</th>
                      <th style={{ textAlign: "center" }}>المصدر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndPaginatedSales.rows.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                          لا توجد سجلات مبيعات مطابقة للفلاتر الحالية
                        </td>
                      </tr>
                    ) : (
                      sortedAndPaginatedSales.rows.map((row) => (
                        <tr key={row.id}>
                          <td style={{ fontWeight: 800 }}>
                            {row.delegateName}
                            {row.anomalies.length > 0 && (
                              <span style={{ marginRight: 6 }} title={row.anomalies.join("، ")}>⚠️</span>
                            )}
                          </td>
                          <td>
                            <span className="status-pill pill-teal">{row.governorate}</span>
                          </td>
                          <td style={{ fontWeight: 700, color: "#64748b" }}>{row.company}</td>
                          <td style={{ fontWeight: 800, color: "#0f766e" }}>{row.item}</td>
                          <td style={{ textAlign: "center", fontWeight: 800 }} className="font-mono">{row.quantity.toLocaleString()}</td>
                          <td style={{ textAlign: "left", color: "#64748b" }} className="font-mono">{currency(row.unitPrice)}</td>
                          <td style={{ textAlign: "left", fontWeight: 900 }} className="font-mono">{currency(row.totalAmount)}</td>
                          <td style={{ textAlign: "center", color: "#64748b" }} className="font-mono">{row.date}</td>
                          <td style={{ textAlign: "left", color: "#64748b" }} className="font-mono">{currency(row.governorateTarget)}</td>
                          <td style={{ textAlign: "center", fontWeight: 900, color: "#10b981" }} className="font-mono">
                            {(row.achievementRate * 100).toFixed(1)}%
                          </td>
                          <td style={{ textAlign: "center", fontSize: "0.7rem", color: "#94a3b8" }}>{row.sheetSource}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", flexWrap: "wrap", gap: 8, fontSize: "0.75rem" }}>
                <span style={{ color: "#64748b" }}>
                  عرض {sortedAndPaginatedSales.rows.length} من أصل {sortedAndPaginatedSales.totalCount} حركة بيع
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="glass-btn text-xs py-1 px-3"
                  >
                    السابق
                  </button>

                  <span style={{ fontWeight: 800 }}>
                    صفحة {sortedAndPaginatedSales.safePage} من {sortedAndPaginatedSales.totalPages}
                  </span>

                  <button
                    disabled={currentPage >= sortedAndPaginatedSales.totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="glass-btn text-xs py-1 px-3"
                  >
                    التالي
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Delegates Leaderboard */}
          {activeTab === "delegates" && (
            <div className="matrix-table-container">
              <div style={{ overflowX: "auto" }}>
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center", width: 50 }}>#</th>
                      <th>المندوب</th>
                      <th>المحافظة</th>
                      <th>الكود</th>
                      <th style={{ textAlign: "left" }}>إجمالي المبيعات</th>
                      <th style={{ textAlign: "center" }}>القطع المباعة</th>
                      <th style={{ textAlign: "center" }}>عدد العمليات</th>
                      <th style={{ textAlign: "center" }}>مساهمته بالمحافظة</th>
                      <th>أفضل مادة باعها</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delegatesRanking.map((del) => (
                      <tr key={del.delegateName}>
                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-grid",
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              placeItems: "center",
                              fontWeight: 900,
                              fontSize: "0.75rem",
                              background: del.rank === 1 ? "#fbbf24" : del.rank === 2 ? "#cbd5e1" : del.rank === 3 ? "#d97706" : "rgba(255,255,255,0.08)",
                              color: del.rank <= 3 ? "#0f172a" : "inherit",
                            }}
                          >
                            {del.rank}
                          </span>
                        </td>
                        <td style={{ fontWeight: 900 }}>{del.delegateName}</td>
                        <td><span className="status-pill pill-teal">{del.governorate}</span></td>
                        <td style={{ color: "#64748b", fontFamily: "monospace" }}>{del.code || "—"}</td>
                        <td style={{ textAlign: "left", fontWeight: 900 }} className="font-mono">{currency(del.totalSales)}</td>
                        <td style={{ textAlign: "center", fontWeight: 800, color: "#0f766e" }} className="font-mono">{del.totalQuantity.toLocaleString()}</td>
                        <td style={{ textAlign: "center" }} className="font-mono">{del.transactionCount}</td>
                        <td style={{ textAlign: "center", fontWeight: 900, color: "#10b981" }} className="font-mono">{del.shareOfGovernorateRate.toFixed(1)}%</td>
                        <td style={{ fontWeight: 700, color: "#0f766e" }}>{del.topProduct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Product Performance */}
          {activeTab === "products" && (
            <div className="matrix-table-container">
              <div style={{ overflowX: "auto" }}>
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center", width: 50 }}>#</th>
                      <th>المادة الدوائية</th>
                      <th>الشركة</th>
                      <th style={{ textAlign: "left" }}>السعر المفرد</th>
                      <th style={{ textAlign: "center" }}>إجمالي الكمية المباعة</th>
                      <th style={{ textAlign: "left" }}>إجمالي الإيراد المالي</th>
                      <th>أفضل محافظة للمادة</th>
                      <th>أفضل مندوب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsPerformance.map((p) => (
                      <tr key={p.item}>
                        <td style={{ textAlign: "center", fontWeight: 800, color: "#64748b" }}>{p.rank}</td>
                        <td style={{ fontWeight: 900, fontSize: "0.85rem" }}>{p.item}</td>
                        <td><span className="status-pill pill-teal">{p.company}</span></td>
                        <td style={{ textAlign: "left", color: "#64748b" }} className="font-mono">{currency(p.unitPrice)}</td>
                        <td style={{ textAlign: "center", fontWeight: 900, color: "#0f766e" }} className="font-mono">{p.totalQuantity.toLocaleString()} قطعة</td>
                        <td style={{ textAlign: "left", fontWeight: 900 }} className="font-mono">{currency(p.totalRevenue)}</td>
                        <td style={{ fontWeight: 800 }}>{p.topGovernorate}</td>
                        <td style={{ color: "#64748b" }}>{p.topDelegate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Companies Analysis */}
          {activeTab === "companies" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyAnalytics.map((c) => (
                <div key={c.company} className="command-filter-box space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-600 grid place-items-center">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-base text-slate-900 dark:text-slate-100">شركة {c.company}</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{c.skuCount} مادة دوائية مسجلة</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-500 dark:text-slate-400">الحصة السوقية</span>
                      <h3 className="font-black text-xl text-teal-600 dark:text-teal-400 font-mono">
                        {c.marketShareRate.toFixed(1)}%
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">إجمالي مبيعات الشركة:</span>
                      <strong className="block text-sm font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
                        {currency(c.totalSales)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">إجمالي القطع المسحوبة:</span>
                      <strong className="block text-sm font-black text-teal-600 dark:text-teal-400 mt-1 font-mono">
                        {c.totalQuantity.toLocaleString()} قطعة
                      </strong>
                    </div>
                  </div>

                  {/* Governorate distribution */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">توزيع المبيعات على المحافظات:</span>
                    <div className="space-y-2">
                      {c.governoratesDistribution.map((gd) => {
                        const pct = c.totalSales > 0 ? (gd.sales / c.totalSales) * 100 : 0;
                        return (
                          <div key={gd.governorate} className="text-xs">
                            <div className="flex justify-between font-bold mb-1">
                              <span>{gd.governorate}</span>
                              <span className="font-mono">{currency(gd.sales)} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="progress-rail" style={{ margin: 0, height: 6 }}>
                              <div className="progress-fill fill-teal" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: Sales Timeline */}
          {activeTab === "timeline" && (
            <div className="command-filter-box">
              <div className="mb-4">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <LineChart size={16} className="text-teal-600" />
                  حركة ومسار المبيعات التراكمية بمرور الأيام
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  تتبع نمو الإيراد المالي الإجمالي عبر تواريخ الحركات المسجلة
                </p>
              </div>

              <div className="h-[320px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelinePoints} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F766E" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                    <XAxis dataKey="displayDate" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val: number) => currency(val)}
                      contentStyle={{ borderRadius: 12, direction: "rtl", textAlign: "right", background: "#0f172a", color: "#fff", border: "none" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativeSales"
                      name="المبيعات التراكمية"
                      stroke="#0F766E"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#salesGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =========================================================================
          MODAL 1: Single Governorate In-depth Focus Modal
          ========================================================================= */}
      {selectedGovModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setSelectedGovModal(null)}
        >
          <div
            className="command-filter-box"
            style={{ maxWidth: 650, width: "100%", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="text-teal-600" />
                <h3 className="font-black text-lg text-slate-900 dark:text-slate-100">
                  كشف تحليلي مفصل — محافظة {selectedGovModal.governorate}
                </h3>
              </div>
              <span className={`status-pill pill-${selectedGovModal.statusColor}`}>
                {selectedGovModal.status}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Financial Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-500 font-bold">المبيعات</span>
                  <strong className="block text-sm font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
                    {currency(selectedGovModal.totalSales)}
                  </strong>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-500 font-bold">التارغت</span>
                  <strong className="block text-sm font-black text-slate-500 mt-1 font-mono">
                    {currency(selectedGovModal.targetAmount)}
                  </strong>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-500 font-bold">نسبة الإنجاز</span>
                  <strong className="block text-sm font-black text-emerald-500 mt-1 font-mono">
                    {selectedGovModal.achievementRate.toFixed(1)}%
                  </strong>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-500 font-bold">القطع المباعة</span>
                  <strong className="block text-sm font-black text-teal-600 dark:text-teal-400 mt-1 font-mono">
                    {selectedGovModal.totalQuantity.toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Best in Gov */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-slate-500">أفضل مندوب:</span>
                  <strong className="block text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedGovModal.bestDelegate}
                  </strong>
                  <span className="text-teal-600 font-mono">{currency(selectedGovModal.bestDelegateSales)}</span>
                </div>

                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-slate-500">أفضل مادة:</span>
                  <strong className="block text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedGovModal.bestProduct}
                  </strong>
                  <span className="text-teal-600 font-mono">{currency(selectedGovModal.bestProductSales)}</span>
                </div>

                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-slate-500">أفضل شركة:</span>
                  <strong className="block text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedGovModal.bestCompany}
                  </strong>
                  <span className="text-slate-400">الأعلى طلباً</span>
                </div>
              </div>

              {/* Action */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => {
                    setFilters({ ...filters, governorate: selectedGovModal.governorate });
                    setSelectedGovModal(null);
                  }}
                  className="glass-btn btn-accent"
                >
                  تصفية لوحة التحكم لهذه المحافظة فقط
                </button>

                <button
                  onClick={() => setSelectedGovModal(null)}
                  className="glass-btn"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: Google Sheets URL Connect Modal
          ========================================================================= */}
      {configModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setConfigModalOpen(false)}
        >
          <div
            className="command-filter-box"
            style={{ maxWidth: 480, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-teal-600" />
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                  ربط مصدر بيانات Google Sheets
                </h3>
              </div>
              <button onClick={() => setConfigModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  رابط جدول Google Sheets المنشور:
                </span>
                <input
                  type="text"
                  value={tempUrlInput}
                  onChange={(e) => setTempUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml أو ID"
                  className="filter-custom-input"
                />
              </label>

              <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl space-y-1 text-slate-500 dark:text-slate-400">
                <strong className="text-slate-800 dark:text-slate-200 block font-bold">تعليمات النشر:</strong>
                <p>1. افتح الجدول في Google Sheets.</p>
                <p>2. اضغط على ملف (File) ⬅️ مشاركة (Share) ⬅️ نشر على الويب (Publish to web).</p>
                <p>3. الصق الرابط هنا واضغط حفظ وتحديث.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setConfigModalOpen(false)} className="glass-btn">
                  إلغاء
                </button>
                <button onClick={handleSaveSheetUrl} className="glass-btn btn-accent">
                  حفظ وجلب البيانات الحية
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
