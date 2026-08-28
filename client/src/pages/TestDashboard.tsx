import { useState, useEffect, useMemo } from "react";
import {
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

const DEFAULT_GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1AbC_Example_Sheet_ID/edit";

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
  const [activeTab, setActiveTab] = useState("table");

  // Table Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState<keyof UnifiedSaleRecord>("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Visible Columns in Table
  const [visibleColumns, setVisibleColumns] = useState({
    delegateName: true,
    governorate: true,
    company: true,
    item: true,
    quantity: true,
    unitPrice: true,
    totalAmount: true,
    date: true,
    governorateTarget: true,
    achievementRate: true,
    sheetSource: true,
  });

  // Load Data on Mount or URL change
  const loadData = async (urlToUse?: string) => {
    setLoading(true);
    try {
      const result = await fetchGoogleSpreadsheetData(urlToUse || sheetUrl);
      setData(result);
      if (result.sourceType === "live-sheets") {
        toast.success("تم تحديث البيانات مباشرة من Google Sheets بنجاح");
      } else {
        toast.info("تم تحميل البيانات الموثقة للنظام (جاهز لربط Google Sheets)");
      }
    } catch (err) {
      toast.error("تعذر جلب البيانات من الرابط، تم استخدام البيانات الاحتياطية");
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

  const topProductsChartData = useMemo(() => {
    return productsPerformance.slice(0, 6).map((p) => ({
      name: p.item,
      "إجمالي المبيعات": p.totalRevenue,
      "الكمية المباعة": p.totalQuantity,
    }));
  }, [productsPerformance]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 grid place-items-center animate-pulse">
            <RefreshCw size={32} className="animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-foreground">جاري جلب وتحليل البيانات الذكية...</h2>
          <p className="text-sm text-muted-foreground">
            نقوم بمسح الـ 8 صفحات وتوحيد سجلات المبيعات والمندوبين وتدقيق جودة البيانات.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-foreground transition-colors duration-200" dir="rtl">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-[1560px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Mode */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-9 h-9 rounded-xl bg-muted hover:bg-secondary grid place-items-center text-foreground transition-colors"
              title="العودة للحسابات والمذاخر"
            >
              <ArrowRight size={18} />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  مراقبة الأداء والمبيعات الميدانية
                </h1>
                <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 text-xs font-bold py-0.5">
                  <Sparkles size={11} className="ml-1 text-teal-500" />
                  تحليلات ذكية
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                متابعة أداء المندوبين والمحافظات والشركات عبر Google Sheets
              </p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Data Source Pill */}
            <button
              onClick={() => {
                setTempUrlInput(sheetUrl);
                setConfigModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all bg-card hover:bg-secondary border-border"
              title="تعديل رابط Google Sheets"
            >
              <span className={`w-2 h-2 rounded-full ${data?.sourceType === "live-sheets" ? "bg-emerald-500 animate-pulse" : "bg-teal-500"}`} />
              <span className="text-foreground">
                {data?.sourceType === "live-sheets" ? "Google Sheets مباشر" : "البيانات الموثقة"}
              </span>
              <span className="text-[10px] text-muted-foreground hidden md:inline">
                ({data?.lastUpdated})
              </span>
              <ExternalLink size={12} className="text-muted-foreground mr-0.5" />
            </button>

            {/* Month / Period Selector */}
            <Select
              value={filters.selectedMonthKey}
              onValueChange={(val) => setFilters({ ...filters, selectedMonthKey: val })}
            >
              <SelectTrigger className="h-9 min-w-[130px] text-xs font-bold bg-card border-border">
                <SelectValue placeholder="الفترة الزمنية" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">جميع الفترات (الكل)</SelectItem>
                {data?.availableMonths.map((m) => (
                  <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 px-3 text-xs font-bold border-border"
              title="تحديث البيانات"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-teal-500 ml-1" : "ml-1"} />
              <span className="hidden sm:inline">تحديث</span>
            </Button>

            {/* Export Report */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              className="h-9 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
              title="تصدير تقرير شامل إلى Excel"
            >
              <FileSpreadsheet size={14} className="ml-1 text-emerald-600" />
              <span className="hidden md:inline">تصدير Excel</span>
            </Button>

            {/* Theme Toggle */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl border border-border bg-card hover:bg-secondary grid place-items-center text-foreground transition-colors"
                title="تبديل الوضع الليلي / الفاتح"
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

      {/* Main Container */}
      <main className="max-w-[1560px] mx-auto p-4 sm:p-6 space-y-6">
        {/* =========================================================================
            SECTION 1: Executive KPI Cards (Top Metrics)
            ========================================================================= */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Sales */}
            <Card className="p-4 sm:p-5 border-border bg-gradient-to-br from-card to-teal-50/20 dark:to-teal-950/20 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground">إجمالي المبيعات</span>
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 grid place-items-center">
                  <Wallet size={16} />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight tabular">
                {currency(kpis.totalSales)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                <TrendingUp size={14} />
                <span>{kpis.transactionCount} حركة مبيعات مسجلة</span>
              </div>
            </Card>

            {/* Total Units */}
            <Card className="p-4 sm:p-5 border-border bg-gradient-to-br from-card to-blue-50/20 dark:to-blue-950/20 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground">إجمالي القطع المباعة</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center">
                  <Boxes size={16} />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight tabular">
                {kpis.totalQuantity.toLocaleString()} قطعة
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Package size={14} />
                <span>عبر {kpis.productsCount} مادة دوائية</span>
              </div>
            </Card>

            {/* Total Target */}
            <Card className="p-4 sm:p-5 border-border bg-gradient-to-br from-card to-indigo-50/20 dark:to-indigo-950/20 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground">التارغت الإجمالي</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 grid place-items-center">
                  <Target size={16} />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight tabular">
                {currency(kpis.totalTarget)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <MapPin size={14} />
                <span>لـ {kpis.governoratesCount} محافظات مستهدفة</span>
              </div>
            </Card>

            {/* Achievement Rate */}
            <Card className="p-4 sm:p-5 border-border bg-gradient-to-br from-card to-emerald-50/20 dark:to-emerald-950/20 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground">نسبة الإنجاز الكلية</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
                  <Flame size={16} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular">
                  {kpis.achievementRate.toFixed(2)}%
                </h3>
              </div>
              {/* Mini Progress */}
              <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, kpis.achievementRate)}%` }}
                />
              </div>
            </Card>

            {/* Remaining & Summary Stats */}
            <Card className="p-4 sm:p-5 border-border bg-gradient-to-br from-card to-amber-50/20 dark:to-amber-950/20 relative overflow-hidden shadow-sm col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground">المتبقي للهدف</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center">
                  <Zap size={16} />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight tabular">
                {currency(kpis.remainingBalance)}
              </h3>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground font-semibold truncate">
                <span>أفضل: <strong className="text-foreground">{kpis.bestGovernorate.name}</strong> ({kpis.bestGovernorate.rate.toFixed(0)}%)</span>
              </div>
            </Card>
          </div>
        )}

        {/* =========================================================================
            SECTION 2: Data Health & Quality Alerts Strip
            ========================================================================= */}
        {data?.dataHealth && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card border border-border rounded-2xl shadow-xs text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 grid place-items-center">
                <ShieldCheck size={16} />
              </div>
              <div>
                <span className="font-bold text-foreground">تدقيق جودة البيانات:</span>{" "}
                <span className="text-muted-foreground">
                  تم فحص {data.dataHealth.totalRowsScanned} صف، واستبعاد {data.dataHealth.ignoredTemplateRows} صف فارغ، واعتماد {data.dataHealth.validSalesCount} حركة بيع صحيحة.
                </span>
              </div>
            </div>

            {/* Anomaly Filter Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {data.dataHealth.missingDelegateCount > 0 && (
                <button
                  onClick={() => setFilters({ ...filters, healthFilter: "missing-delegate" })}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[11px] hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                >
                  <AlertTriangle size={12} />
                  <span>{data.dataHealth.missingDelegateCount} بدون مندوب</span>
                </button>
              )}
              {data.dataHealth.missingCompanyCount > 0 && (
                <button
                  onClick={() => setFilters({ ...filters, healthFilter: "missing-company" })}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold text-[11px] hover:bg-rose-500/20 transition-colors flex items-center gap-1"
                >
                  <AlertCircle size={12} />
                  <span>{data.dataHealth.missingCompanyCount} بدون شركة</span>
                </button>
              )}
              {filters.healthFilter !== "all" && (
                <button
                  onClick={() => setFilters({ ...filters, healthFilter: "all" })}
                  className="px-2.5 py-1 rounded-lg bg-muted text-foreground font-bold text-[11px] hover:bg-secondary transition-colors"
                >
                  إلغاء فلتر الجودة ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 3: Governorates Performance Cards
            ========================================================================= */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
                مراقبة أداء المحافظات المستهدفة
              </h2>
              <p className="text-xs text-muted-foreground">
                اضغط على أي محافظة لفتح الكشف التفصيلي والتحليلات المعمقة
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {govPerformances.map((gov) => {
              const isOverTarget = gov.achievementRate >= 100;
              return (
                <Card
                  key={gov.governorate}
                  onClick={() => setSelectedGovModal(gov)}
                  className={`p-4 sm:p-5 border cursor-pointer transition-all duration-200 hover:shadow-md relative overflow-hidden group ${
                    isOverTarget
                      ? "border-emerald-500/40 bg-gradient-to-b from-card to-emerald-50/15 dark:to-emerald-950/20"
                      : gov.achievementRate >= 75
                      ? "border-teal-500/30 bg-gradient-to-b from-card to-teal-50/10 dark:to-teal-950/15"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Status Strip & Top */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-muted group-hover:bg-teal-500/20 group-hover:text-teal-600 grid place-items-center transition-colors">
                        <MapPin size={16} />
                      </div>
                      <h4 className="font-black text-base text-foreground">{gov.governorate}</h4>
                    </div>

                    <Badge
                      className={`text-xs font-bold py-0.5 px-2 ${
                        gov.statusColor === "emerald"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : gov.statusColor === "teal"
                          ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
                          : gov.statusColor === "amber"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                      }`}
                    >
                      {gov.status}
                    </Badge>
                  </div>

                  {/* Numbers Grid */}
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">المبيعات المحققة:</span>
                      <strong className="text-sm sm:text-base font-black text-foreground tabular">
                        {currency(gov.totalSales)}
                      </strong>
                    </div>

                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-muted-foreground">التارغت المطلوب:</span>
                      <span className="tabular font-semibold text-muted-foreground">
                        {currency(gov.targetAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-muted-foreground">القطع المباعة:</span>
                      <span className="tabular font-bold text-teal-600 dark:text-teal-400">
                        {gov.totalQuantity.toLocaleString()} قطعة
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1 border-t border-border/60">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted-foreground">نسبة الإنجاز:</span>
                      <span className={`tabular ${isOverTarget ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-foreground"}`}>
                        {gov.achievementRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          gov.statusColor === "emerald"
                            ? "bg-emerald-500"
                            : gov.statusColor === "teal"
                            ? "bg-teal-500"
                            : gov.statusColor === "amber"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(100, gov.achievementRate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer hint */}
                  <div className="mt-3 pt-2 text-[11px] text-muted-foreground flex justify-between items-center">
                    <span>{gov.delegatesCount} مندوبين نشطين</span>
                    <span className="text-teal-600 dark:text-teal-400 group-hover:underline font-bold flex items-center gap-0.5">
                      تفاصيل <ChevronLeft size={12} />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            SECTION 4: Visual Analytics Charts
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart 1: Sales vs Target by Governorate */}
          <Card className="p-4 sm:p-5 border-border bg-card shadow-xs lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <BarChart3 size={17} className="text-teal-600" />
                  مقارنة المبيعات المحققة مقابل التارغت لكل محافظة
                </h3>
                <p className="text-xs text-muted-foreground">
                  مقارنة بالأعمدة المزدوجة بين الفعلي والمستهدف
                </p>
              </div>
            </div>

            <div className="h-[280px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={govBarChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12, fontWeight: "bold" }} />
                  <YAxis
                    tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(val: number) => currency(val)}
                    labelStyle={{ fontWeight: "bold", textAlign: "right" }}
                    contentStyle={{ borderRadius: 12, direction: "rtl", textAlign: "right" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10 }} />
                  <Bar dataKey="المبيعات المحققة" fill="#0F766E" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="الهدف (التارغت)" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Chart 2: Governorates Market Share Donut */}
          <Card className="p-4 sm:p-5 border-border bg-card shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <PieChartIcon size={17} className="text-teal-600" />
                  توزيع الحصة البيعية للمحافظات
                </h3>
                <p className="text-xs text-muted-foreground">
                  نسبة مساهمة كل محافظة في إجمالي المبيعات
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
                    contentStyle={{ borderRadius: 12, direction: "rtl", textAlign: "right" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* =========================================================================
            SECTION 5: Cascading Multi-Dimension Filter Bar
            ========================================================================= */}
        <Card className="p-4 sm:p-5 border-border bg-card shadow-xs space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/70">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-teal-600" />
              <h3 className="font-bold text-sm text-foreground">تصفية وبحث متعدد الأبعاد</h3>
              <Badge variant="outline" className="text-xs font-bold tabular">
                {filteredSales.length} حركة مطابقة
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              إعادة تعيين الفلاتر ✕
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Governorate Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">المحافظة:</label>
              <Select
                value={filters.governorate}
                onValueChange={(val) => {
                  setFilters({ ...filters, governorate: val, delegate: "all" });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">الكل (جميع المحافظات)</SelectItem>
                  {data?.availableGovernorates.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Delegate Filter (Cascading) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">المندوب:</label>
              <Select
                value={filters.delegate}
                onValueChange={(val) => {
                  setFilters({ ...filters, delegate: val });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">الكل (جميع المندوبين)</SelectItem>
                  {availableDelegatesForGov.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Company Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">الشركة:</label>
              <Select
                value={filters.company}
                onValueChange={(val) => {
                  setFilters({ ...filters, company: val });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">الكل (جميع الشركات)</SelectItem>
                  {data?.availableCompanies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Product Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">المادة الدوائية:</label>
              <Select
                value={filters.product}
                onValueChange={(val) => {
                  setFilters({ ...filters, product: val });
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">الكل (جميع المواد)</SelectItem>
                  {data?.availableProducts.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 5. Quick Search */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">بحث سريع:</label>
              <div className="relative">
                <Search size={14} className="absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  value={filters.searchQuery}
                  onChange={(e) => {
                    setFilters({ ...filters, searchQuery: e.target.value });
                    setCurrentPage(1);
                  }}
                  placeholder="ابحث بأي نص..."
                  className="h-9 pr-8 text-xs bg-background"
                />
                {filters.searchQuery && (
                  <button
                    onClick={() => setFilters({ ...filters, searchQuery: "" })}
                    className="absolute left-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* =========================================================================
            SECTION 6: Tabbed Deep Analytics Section (5 Views)
            ========================================================================= */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-1 border-b border-border">
            <TabsList className="bg-muted p-1 rounded-xl">
              <TabsTrigger value="table" className="text-xs font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-lg">
                <TableProperties size={14} />
                <span>جدول المبيعات الموحد ({filteredSales.length})</span>
              </TabsTrigger>
              <TabsTrigger value="delegates" className="text-xs font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-lg">
                <Users size={14} />
                <span>ترتيب المندوبين ({delegatesRanking.length})</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-lg">
                <Package size={14} />
                <span>تحليل المواد ({productsPerformance.length})</span>
              </TabsTrigger>
              <TabsTrigger value="companies" className="text-xs font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-lg">
                <Building2 size={14} />
                <span>تحليل الشركات ({companyAnalytics.length})</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-lg">
                <LineChart size={14} />
                <span>المسار الزمني للمبيعات</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* =====================================================================
              TAB 1: Unified Sales Data Table
              ===================================================================== */}
          <TabsContent value="table" className="space-y-4">
            <Card className="border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/70 border-b border-border text-muted-foreground font-bold">
                      <th onClick={() => handleSort("delegateName")} className="p-3 cursor-pointer hover:text-foreground">
                        <div className="flex items-center gap-1">
                          <span>المندوب</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("governorate")} className="p-3 cursor-pointer hover:text-foreground">
                        <div className="flex items-center gap-1">
                          <span>المحافظة</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("company")} className="p-3 cursor-pointer hover:text-foreground">
                        <div className="flex items-center gap-1">
                          <span>الشركة</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("item")} className="p-3 cursor-pointer hover:text-foreground">
                        <div className="flex items-center gap-1">
                          <span>المادة</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("quantity")} className="p-3 text-center cursor-pointer hover:text-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <span>العدد</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("unitPrice")} className="p-3 text-left cursor-pointer hover:text-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <span>سعر المادة</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("totalAmount")} className="p-3 text-left cursor-pointer hover:text-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <span>إجمالي المبلغ</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("date")} className="p-3 text-center cursor-pointer hover:text-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <span>التاريخ</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("governorateTarget")} className="p-3 text-left cursor-pointer hover:text-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <span>تارجت المحافظة</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th onClick={() => handleSort("achievementRate")} className="p-3 text-center cursor-pointer hover:text-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <span>نسبة الإنجاز</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th className="p-3 text-center">المصدر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedAndPaginatedSales.rows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-muted-foreground">
                          لا توجد سجلات مبيعات مطابقة للفلاتر الحالية
                        </td>
                      </tr>
                    ) : (
                      sortedAndPaginatedSales.rows.map((row) => {
                        const hasAnomaly = row.anomalies.length > 0;
                        return (
                          <tr
                            key={row.id}
                            className={`hover:bg-muted/40 transition-colors ${
                              hasAnomaly ? "bg-amber-500/5" : ""
                            }`}
                          >
                            <td className="p-3 font-bold text-foreground">
                              {row.delegateName}
                              {hasAnomaly && (
                                <span className="mr-1.5 text-amber-500" title={row.anomalies.join("، ")}>
                                  ⚠️
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[11px] font-semibold">
                                {row.governorate}
                              </Badge>
                            </td>
                            <td className="p-3 font-semibold text-muted-foreground">{row.company}</td>
                            <td className="p-3 font-bold text-teal-700 dark:text-teal-300">{row.item}</td>
                            <td className="p-3 text-center font-bold tabular">{row.quantity.toLocaleString()}</td>
                            <td className="p-3 text-left font-semibold text-muted-foreground tabular">
                              {currency(row.unitPrice)}
                            </td>
                            <td className="p-3 text-left font-black text-foreground tabular">
                              {currency(row.totalAmount)}
                            </td>
                            <td className="p-3 text-center text-muted-foreground tabular">{row.date}</td>
                            <td className="p-3 text-left text-muted-foreground tabular">
                              {currency(row.governorateTarget)}
                            </td>
                            <td className="p-3 text-center font-black text-emerald-600 dark:text-emerald-400 tabular">
                              {(row.achievementRate * 100).toFixed(1)}%
                            </td>
                            <td className="p-3 text-center text-[10px] text-muted-foreground">{row.sheetSource}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Pagination Controls */}
              <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30 flex-wrap gap-2 text-xs">
                <div className="text-muted-foreground">
                  عرض {sortedAndPaginatedSales.rows.length} من أصل {sortedAndPaginatedSales.totalCount} حركة بيع
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2.5 text-xs"
                  >
                    <ChevronRight size={14} className="ml-1" />
                    السابق
                  </Button>

                  <span className="font-bold text-foreground tabular">
                    صفحة {sortedAndPaginatedSales.safePage} من {sortedAndPaginatedSales.totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= sortedAndPaginatedSales.totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="h-8 px-2.5 text-xs"
                  >
                    التالي
                    <ChevronLeft size={14} className="mr-1" />
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* =====================================================================
              TAB 2: Delegates Leaderboard
              ===================================================================== */}
          <TabsContent value="delegates" className="space-y-4">
            <Card className="border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/70 border-b border-border text-muted-foreground font-bold">
                      <th className="p-3 text-center w-12">#</th>
                      <th className="p-3">المندوب</th>
                      <th className="p-3">المحافظة</th>
                      <th className="p-3">الكود</th>
                      <th className="p-3 text-left">إجمالي المبيعات</th>
                      <th className="p-3 text-center">القطع المباعة</th>
                      <th className="p-3 text-center">عدد العمليات</th>
                      <th className="p-3 text-center">مساهمته بالمحافظة</th>
                      <th className="p-3">أفضل مادة باعها</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {delegatesRanking.map((del) => (
                      <tr key={del.delegateName} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3 text-center">
                          <span
                            className={`w-6 h-6 rounded-full inline-grid place-items-center font-black text-xs ${
                              del.rank === 1
                                ? "bg-amber-400 text-slate-900"
                                : del.rank === 2
                                ? "bg-slate-300 text-slate-900"
                                : del.rank === 3
                                ? "bg-amber-600 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {del.rank}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-foreground">{del.delegateName}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[11px]">
                            {del.governorate}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-[11px]">{del.code || "—"}</td>
                        <td className="p-3 text-left font-black text-foreground tabular">{currency(del.totalSales)}</td>
                        <td className="p-3 text-center font-bold text-teal-600 dark:text-teal-400 tabular">
                          {del.totalQuantity.toLocaleString()}
                        </td>
                        <td className="p-3 text-center tabular">{del.transactionCount}</td>
                        <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400 tabular">
                          {del.shareOfGovernorateRate.toFixed(1)}%
                        </td>
                        <td className="p-3 font-semibold text-teal-700 dark:text-teal-300">{del.topProduct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* =====================================================================
              TAB 3: Products Performance Analytics
              ===================================================================== */}
          <TabsContent value="products" className="space-y-4">
            <Card className="border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/70 border-b border-border text-muted-foreground font-bold">
                      <th className="p-3 text-center w-12">#</th>
                      <th className="p-3">المادة الدوائية</th>
                      <th className="p-3">الشركة</th>
                      <th className="p-3 text-left">السعر المفرد</th>
                      <th className="p-3 text-center">إجمالي الكمية المباعة</th>
                      <th className="p-3 text-left">إجمالي الإيراد المالي</th>
                      <th className="p-3">أفضل محافظة للمادة</th>
                      <th className="p-3">أفضل مندوب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productsPerformance.map((p) => (
                      <tr key={p.item} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3 text-center font-bold text-muted-foreground">{p.rank}</td>
                        <td className="p-3 font-black text-foreground text-sm">{p.item}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[11px] font-bold">
                            {p.company}
                          </Badge>
                        </td>
                        <td className="p-3 text-left text-muted-foreground tabular font-semibold">
                          {currency(p.unitPrice)}
                        </td>
                        <td className="p-3 text-center font-black text-teal-600 dark:text-teal-400 tabular">
                          {p.totalQuantity.toLocaleString()} قطعة
                        </td>
                        <td className="p-3 text-left font-black text-foreground tabular text-sm">
                          {currency(p.totalRevenue)}
                        </td>
                        <td className="p-3 font-bold text-foreground">{p.topGovernorate}</td>
                        <td className="p-3 text-muted-foreground font-semibold">{p.topDelegate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* =====================================================================
              TAB 4: Companies Market Share
              ===================================================================== */}
          <TabsContent value="companies" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyAnalytics.map((c) => (
                <Card key={c.company} className="p-5 border-border bg-card space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 grid place-items-center">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h4 className="font-black text-base text-foreground">شركة {c.company}</h4>
                        <span className="text-xs text-muted-foreground">{c.skuCount} مادة دوائية مسجلة</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-muted-foreground">الحصة السوقية</span>
                      <h3 className="font-black text-lg text-teal-600 dark:text-teal-400 tabular">
                        {c.marketShareRate.toFixed(1)}%
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-muted/40">
                      <span className="text-muted-foreground">إجمالي مبيعات الشركة:</span>
                      <strong className="block text-sm font-black text-foreground mt-1 tabular">
                        {currency(c.totalSales)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40">
                      <span className="text-muted-foreground">إجمالي القطع المسحوبة:</span>
                      <strong className="block text-sm font-black text-teal-600 dark:text-teal-400 mt-1 tabular">
                        {c.totalQuantity.toLocaleString()} قطعة
                      </strong>
                    </div>
                  </div>

                  {/* Governorate distribution */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-muted-foreground">توزيع المبيعات على المحافظات:</span>
                    <div className="space-y-1.5">
                      {c.governoratesDistribution.map((gd) => {
                        const pct = c.totalSales > 0 ? (gd.sales / c.totalSales) * 100 : 0;
                        return (
                          <div key={gd.governorate} className="text-xs">
                            <div className="flex justify-between font-semibold mb-0.5">
                              <span>{gd.governorate}</span>
                              <span className="tabular">{currency(gd.sales)} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div className="bg-teal-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* =====================================================================
              TAB 5: Sales Velocity Timeline
              ===================================================================== */}
          <TabsContent value="timeline" className="space-y-4">
            <Card className="p-5 border-border bg-card shadow-xs">
              <div className="mb-4">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <LineChart size={17} className="text-teal-600" />
                  حركة ومسار المبيعات التراكمية بمرور الأيام
                </h3>
                <p className="text-xs text-muted-foreground">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="displayDate" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val: number) => currency(val)}
                      contentStyle={{ borderRadius: 12, direction: "rtl", textAlign: "right" }}
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
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* =========================================================================
          MODAL 1: Single Governorate Focus Detail Modal
          ========================================================================= */}
      <Dialog open={!!selectedGovModal} onOpenChange={(open) => !open && setSelectedGovModal(null)}>
        {selectedGovModal && (
          <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl font-black flex items-center gap-2">
                  <MapPin className="text-teal-600" />
                  كشف تحليلي مفصل — محافظة {selectedGovModal.governorate}
                </DialogTitle>
                <Badge
                  className={`text-xs font-bold ${
                    selectedGovModal.statusColor === "emerald"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-teal-500/15 text-teal-700 dark:text-teal-300"
                  }`}
                >
                  {selectedGovModal.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs">
                ملخص الأداء المالي، والمندوبين، وأفضل المواد تصريفاً في المحافظة
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Financial Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-muted/40 rounded-xl">
                  <span className="text-[11px] text-muted-foreground font-bold">المبيعات المحققة</span>
                  <strong className="block text-sm font-black text-foreground mt-1 tabular">
                    {currency(selectedGovModal.totalSales)}
                  </strong>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl">
                  <span className="text-[11px] text-muted-foreground font-bold">التارغت المطلوب</span>
                  <strong className="block text-sm font-black text-muted-foreground mt-1 tabular">
                    {currency(selectedGovModal.targetAmount)}
                  </strong>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl">
                  <span className="text-[11px] text-muted-foreground font-bold">نسبة الإنجاز</span>
                  <strong className="block text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular">
                    {selectedGovModal.achievementRate.toFixed(1)}%
                  </strong>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl">
                  <span className="text-[11px] text-muted-foreground font-bold">القطع المباعة</span>
                  <strong className="block text-sm font-black text-teal-600 dark:text-teal-400 mt-1 tabular">
                    {selectedGovModal.totalQuantity.toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Best Performers in Gov */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 border border-border rounded-xl">
                  <span className="text-muted-foreground">أفضل مندوب بالمحافظة:</span>
                  <strong className="block text-sm font-bold text-foreground mt-0.5">
                    {selectedGovModal.bestDelegate}
                  </strong>
                  <span className="text-[11px] text-teal-600 tabular">
                    {currency(selectedGovModal.bestDelegateSales)}
                  </span>
                </div>

                <div className="p-3 border border-border rounded-xl">
                  <span className="text-muted-foreground">أفضل مادة طلباً:</span>
                  <strong className="block text-sm font-bold text-foreground mt-0.5">
                    {selectedGovModal.bestProduct}
                  </strong>
                  <span className="text-[11px] text-teal-600 tabular">
                    {currency(selectedGovModal.bestProductSales)}
                  </span>
                </div>

                <div className="p-3 border border-border rounded-xl">
                  <span className="text-muted-foreground">أفضل شركة موردة:</span>
                  <strong className="block text-sm font-bold text-foreground mt-0.5">
                    {selectedGovModal.bestCompany}
                  </strong>
                  <span className="text-[11px] text-muted-foreground">الأعلى طلباً</span>
                </div>
              </div>

              {/* Recent Sales in this Gov */}
              <div>
                <h5 className="font-bold text-xs text-foreground mb-2">آخر الحركات في {selectedGovModal.governorate}:</h5>
                <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px] text-right">
                    <thead className="bg-muted/70 text-muted-foreground font-bold sticky top-0">
                      <tr>
                        <th className="p-2">المندوب</th>
                        <th className="p-2">المادة</th>
                        <th className="p-2 text-center">العدد</th>
                        <th className="p-2 text-left">المبلغ</th>
                        <th className="p-2 text-center">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedGovModal.recentSales.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="p-2 font-bold">{r.delegateName}</td>
                          <td className="p-2 text-teal-700 dark:text-teal-300">{r.item}</td>
                          <td className="p-2 text-center tabular">{r.quantity}</td>
                          <td className="p-2 text-left font-bold tabular">{currency(r.totalAmount)}</td>
                          <td className="p-2 text-center text-muted-foreground tabular">{r.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters({ ...filters, governorate: selectedGovModal.governorate });
                  setSelectedGovModal(null);
                }}
              >
                تصفية Dashboard لهذه المحافظة فقط
              </Button>
              <Button size="sm" onClick={() => setSelectedGovModal(null)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* =========================================================================
          MODAL 2: Google Sheets URL Connect Modal
          ========================================================================= */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Globe size={18} className="text-teal-600" />
              ربط مصدر بيانات Google Sheets
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              أدخل رابط أو معرف جدول Google Sheets المنشور لجلب البيانات الحية مباشرة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <label className="space-y-1 block">
              <span className="text-xs font-bold text-foreground">رابط Google Sheets:</span>
              <Input
                value={tempUrlInput}
                onChange={(e) => setTempUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml أو ID"
                className="text-xs"
              />
            </label>

            <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1 text-muted-foreground">
              <strong className="text-foreground block font-bold">تعليمات النشر في Google Sheets:</strong>
              <p>1. افتح الجدول في Google Sheets.</p>
              <p>2. اضغط على ملف (File) ⬅️ مشاركة (Share) ⬅️ نشر على الويب (Publish to web).</p>
              <p>3. الصق الرابط هنا واضغط حفظ وتحديث.</p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfigModalOpen(false)}>
              إلغاء
            </Button>
            <Button size="sm" onClick={handleSaveSheetUrl} className="btn-primary">
              حفظ وجلب البيانات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TestDashboard;
