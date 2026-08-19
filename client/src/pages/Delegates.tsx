import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currency } from "@/components/dashboard/types";
import { Topbar } from "@/components/dashboard/Topbar";
import { toast } from "sonner";

import { DelegateStockRecord, INITIAL_DELEGATES_DATA } from "./delegatesData";

const LOCAL_STORAGE_KEY = "hisabati_delegates_data_v3";

const emptyFormRecord = (): Omit<DelegateStockRecord, "id"> => ({
  delegateName: "أحمد علي حسين",
  phone: "07801234567",
  governorate: "الكوت",
  company: "LDP",
  item: "",
  prevStock: 0,
  currentStock: 0,
  salesAmount: 0,
  governorateTarget: 0,
  note: "",
  date: new Date().toISOString().slice(0, 10),
});

export function Delegates() {
  const [records, setRecords] = useState<DelegateStockRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_DELEGATES_DATA;
  });

  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("الكل");
  const [filterGovernorate, setFilterGovernorate] = useState("الكل");
  const [filterDelegate, setFilterDelegate] = useState("الكل");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyFormRecord());
  const [saving, setSaving] = useState(false);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore
    }
  }, [records]);

  // Unique Select Options
  const companyOptions = useMemo(() => {
    const set = new Set(records.map((r) => r.company).filter(Boolean));
    return Array.from(set);
  }, [records]);

  const governorateOptions = useMemo(() => {
    const set = new Set(records.map((r) => r.governorate).filter(Boolean));
    return Array.from(set);
  }, [records]);

  const delegateOptions = useMemo(() => {
    const set = new Set(records.map((r) => r.delegateName).filter(Boolean));
    return Array.from(set);
  }, [records]);

  // Filtered Records
  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        !search ||
        r.delegateName.includes(search) ||
        r.company.includes(search) ||
        r.item.includes(search) ||
        r.governorate.includes(search) ||
        r.phone.includes(search);

      const matchCompany = filterCompany === "الكل" || r.company === filterCompany;
      const matchGov = filterGovernorate === "الكل" || r.governorate === filterGovernorate;
      const matchDelegate = filterDelegate === "الكل" || r.delegateName === filterDelegate;

      return matchSearch && matchCompany && matchGov && matchDelegate;
    });
  }, [records, search, filterCompany, filterGovernorate, filterDelegate]);

  // Statistics Calculations
  const totalSales = filtered.reduce((sum, r) => sum + r.salesAmount, 0);
  const totalTarget = filtered.reduce((sum, r) => sum + r.governorateTarget, 0);
  const achievementRate = totalTarget > 0 ? Math.round((totalSales / totalTarget) * 100) : 0;
  const totalSoldUnits = filtered.reduce(
    (sum, r) => sum + Math.max(0, r.prevStock - r.currentStock),
    0
  );

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyFormRecord());
    setDialogOpen(true);
  };

  const openEditDialog = (record: DelegateStockRecord) => {
    setEditingId(record.id);
    setForm({
      delegateName: record.delegateName,
      phone: record.phone,
      governorate: record.governorate,
      company: record.company,
      item: record.item,
      prevStock: record.prevStock,
      currentStock: record.currentStock,
      salesAmount: record.salesAmount,
      governorateTarget: record.governorateTarget,
      note: record.note || "",
      date: record.date || new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const handleDelete = (record: DelegateStockRecord) => {
    if (!confirm(`هل أنت متأكد من حذف سجل مادة "${record.item}" للمندوب ${record.delegateName}؟`)) return;
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    toast.success("تم حذف السجل بنجاح");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.delegateName.trim() || !form.company.trim() || !form.item.trim()) {
      toast.error("يرجى إدخال اسم المندوب، اسم الشركة، واسم المادة");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        setRecords((prev) =>
          prev.map((r) => (r.id === editingId ? { ...form, id: editingId } : r))
        );
        toast.success("تم تحديث سجل المندوب والمادة بنجاح");
      } else {
        const newRecord: DelegateStockRecord = {
          ...form,
          id: `del-${Date.now()}`,
        };
        setRecords((prev) => [newRecord, ...prev]);
        toast.success("تمت إضافة سجل المندوب بنجاح");
      }
      setDialogOpen(false);
    } catch {
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    if (filtered.length === 0) return;
    const header = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/></head>
      <body>
      <table border="1">
        <thead>
          <tr style="background-color: #0f766e; color: #ffffff; font-weight: bold;">
            <th>المندوب</th>
            <th>رقم الهاتف</th>
            <th>المحافظة</th>
            <th>الشركة</th>
            <th>المادة</th>
            <th>ستوك سابق</th>
            <th>ستوك حالي</th>
            <th>المباع بالقطع</th>
            <th>مبلغ المبيعات</th>
            <th>تارجت المحافظة</th>
            <th>نسبة الإنجاز</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (r) => `
            <tr>
              <td>${r.delegateName}</td>
              <td>${r.phone}</td>
              <td>${r.governorate}</td>
              <td>${r.company}</td>
              <td>${r.item}</td>
              <td>${r.prevStock}</td>
              <td>${r.currentStock}</td>
              <td>${Math.max(0, r.prevStock - r.currentStock)}</td>
              <td>${r.salesAmount}</td>
              <td>${r.governorateTarget}</td>
              <td>${r.governorateTarget > 0 ? Math.round((r.salesAmount / r.governorateTarget) * 100) : 0}%</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      </body></html>
    `;

    const blob = new Blob(["\ufeff", header], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "delegates-stock-report.xls";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    toast.success("تم تصدير كشف المندوبين والمخزون إلى Excel");
  };

  const resetFilters = () => {
    setSearch("");
    setFilterCompany("الكل");
    setFilterGovernorate("الكل");
    setFilterDelegate("الكل");
  };

  return (
    <div className="app-shell" dir="rtl">
      <main className="main-content" style={{ paddingInlineStart: 0 }}>
        {/* Topbar with Safe Area */}
        <Topbar
          view="dashboard"
          syncing={false}
          lastSync={null}
          mobileOpen={false}
          onToggleMobile={() => {}}
          onSync={() => toast.success("البيانات محدثة")}
          ready={true}
        />

        <section className="page-container" aria-label="المندوبين">
          {/* Page Heading */}
          <div className="page-heading">
            <div className="heading-main-info">
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="w-8 h-8 rounded-lg bg-muted hover:bg-secondary grid place-items-center text-foreground transition-colors"
                  title="العودة للحسابات والمذاخر"
                >
                  <ArrowRight size={17} />
                </Link>
                <h1 className="text-xl md:text-2xl font-black text-foreground">
                  كشف المندوبين والمبيعات والمخزون
                </h1>
              </div>
            </div>

            <div className="heading-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={exportExcel}
                className="export-btn h-8 px-3 text-xs"
              >
                <FileSpreadsheet size={14} className="ml-1 text-emerald-600 dark:text-emerald-400" />
                <span>تصدير Excel</span>
              </Button>
              <Button
                size="sm"
                onClick={openCreateDialog}
                className="btn-primary h-8 px-3 text-xs font-bold"
              >
                <Plus size={15} className="ml-1" />
                <span>إضافة سجل مندوب</span>
              </Button>
            </div>
          </div>

          {/* Compact 2x2 Stats Grid on Mobile */}
          <div className="stats-grid">
            <Card className="stat-card tone-blue">
              <div className="stat-glow-bg" />
              <div className="stat-header">
                <div className="stat-icon-badge blue">
                  <Wallet size={18} />
                </div>
              </div>
              <p className="stat-label">إجمالي المبيعات</p>
              <h3 className="stat-value tabular">{currency(totalSales)}</h3>
              <div className="stat-footer-hint">
                <span>{filtered.length} سجل مبيعات</span>
              </div>
            </Card>

            <Card className="stat-card tone-green">
              <div className="stat-glow-bg" />
              <div className="stat-header">
                <div className="stat-icon-badge green">
                  <Target size={18} />
                </div>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular">
                  {achievementRate}%
                </span>
              </div>
              <p className="stat-label">تارجت المحافظات</p>
              <h3 className="stat-value tabular">{currency(totalTarget)}</h3>
              <div className="stat-footer-hint">
                <span>نسبة الإنجاز الإجمالية</span>
              </div>
            </Card>

            <Card className="stat-card tone-amber">
              <div className="stat-glow-bg" />
              <div className="stat-header">
                <div className="stat-icon-badge amber">
                  <Boxes size={18} />
                </div>
              </div>
              <p className="stat-label">إجمالي تصريف المواد</p>
              <h3 className="stat-value tabular">{totalSoldUnits.toLocaleString()} قطعة</h3>
              <div className="stat-footer-hint">
                <span>تم سحبها من الستوك</span>
              </div>
            </Card>

            <Card className="stat-card tone-red">
              <div className="stat-glow-bg" />
              <div className="stat-header">
                <div className="stat-icon-badge red">
                  <Users size={18} />
                </div>
              </div>
              <p className="stat-label">المندوبين النشطين</p>
              <h3 className="stat-value tabular">{delegateOptions.length} مندوب</h3>
              <div className="stat-footer-hint">
                <span>في {governorateOptions.length} محافظة</span>
              </div>
            </Card>
          </div>

          {/* Filter Toolbar */}
          <div className="filter-card">
            <div className="filter-main-grid">
              {/* Quick Search */}
              <div className="search-box">
                <Search size={15} className="search-icon" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث سريع بالمندوب، الشركة، أو المادة..."
                  className="search-input text-xs font-semibold h-10"
                />
                {search && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearch("")}
                    aria-label="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* 3 Select Dropdowns */}
              <div className="dropdown-filters-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                {/* الشركة */}
                <div className={`filter-select-wrapper ${filterCompany !== "الكل" ? "is-active" : ""}`}>
                  <Select value={filterCompany} onValueChange={setFilterCompany}>
                    <SelectTrigger className="filter-select-trigger h-10">
                      <div className="trigger-text">
                        <span className="trigger-label">الشركة:</span>
                        <span className="trigger-val">{filterCompany}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="الكل">الكل (الشركة)</SelectItem>
                      {companyOptions.map((comp) => (
                        <SelectItem key={comp} value={comp}>
                          {comp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* المحافظة */}
                <div className={`filter-select-wrapper ${filterGovernorate !== "الكل" ? "is-active" : ""}`}>
                  <Select value={filterGovernorate} onValueChange={setFilterGovernorate}>
                    <SelectTrigger className="filter-select-trigger h-10">
                      <div className="trigger-text">
                        <span className="trigger-label">المحافظة:</span>
                        <span className="trigger-val">{filterGovernorate}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="الكل">الكل (المحافظة)</SelectItem>
                      {governorateOptions.map((gov) => (
                        <SelectItem key={gov} value={gov}>
                          {gov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* المندوب */}
                <div className={`filter-select-wrapper ${filterDelegate !== "الكل" ? "is-active" : ""}`}>
                  <Select value={filterDelegate} onValueChange={setFilterDelegate}>
                    <SelectTrigger className="filter-select-trigger h-10">
                      <div className="trigger-text">
                        <span className="trigger-label">المندوب:</span>
                        <span className="trigger-val">{filterDelegate}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="الكل">الكل (المندوب)</SelectItem>
                      {delegateOptions.map((del) => (
                        <SelectItem key={del} value={del}>
                          {del}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Real Data Table (Retains Table format on Mobile with horizontal touch scrolling) */}
          <Card className="table-card" dir="rtl">
            <div className="table-header">
              <div className="table-title-area">
                <div className="table-title-row">
                  <h3 className="text-base font-bold">جدول سجلات المندوبين والمخزون والمبيعات</h3>
                  <span className="table-counter-chip tabular">
                    {filtered.length} سجل مطابقة
                  </span>
                </div>
              </div>
            </div>

            <div className="table-scroll">
              <table className="invoices-data-table">
                <thead>
                  <tr>
                    <th>المندوب</th>
                    <th>المحافظة</th>
                    <th>الشركة</th>
                    <th>المادة</th>
                    <th className="text-center">ستوك سابق</th>
                    <th className="text-center">ستوك حالي</th>
                    <th className="text-center">الفرق المباع</th>
                    <th>مبلغ المبيعات</th>
                    <th>تارجت المحافظة</th>
                    <th className="text-center">نسبة الإنجاز</th>
                    <th className="text-center w-[90px]">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-10 text-muted-foreground text-xs">
                        لا توجد سجلات مطابقة للفلاتر الحالية
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const soldUnits = Math.max(0, r.prevStock - r.currentStock);
                      const pct = r.governorateTarget > 0 ? Math.round((r.salesAmount / r.governorateTarget) * 100) : 0;

                      return (
                        <tr key={r.id} className="table-data-row">
                          {/* المندوب */}
                          <td>
                            <div className="flex flex-col">
                              <strong className="font-extrabold text-foreground text-xs">
                                {r.delegateName}
                              </strong>
                              <span className="text-[11px] text-muted-foreground tabular">
                                {r.phone}
                              </span>
                            </div>
                          </td>

                          {/* المحافظة */}
                          <td>
                            <span className="gov-badge font-bold">
                              <MapPin size={11} />
                              {r.governorate}
                            </span>
                          </td>

                          {/* الشركة */}
                          <td>
                            <strong className="text-xs font-bold text-foreground">{r.company}</strong>
                          </td>

                          {/* المادة */}
                          <td>
                            <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                              {r.item}
                            </span>
                          </td>

                          {/* ستوك سابق */}
                          <td className="text-center tabular font-semibold text-xs">
                            {r.prevStock.toLocaleString()}
                          </td>

                          {/* ستوك حالي */}
                          <td className="text-center tabular font-semibold text-xs">
                            <span className={r.currentStock < 200 ? "text-red-500 font-bold" : ""}>
                              {r.currentStock.toLocaleString()}
                            </span>
                          </td>

                          {/* الفرق المباع */}
                          <td className="text-center tabular font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {soldUnits.toLocaleString()}
                          </td>

                          {/* مبلغ المبيعات */}
                          <td className="tabular font-black text-xs text-foreground">
                            {currency(r.salesAmount)}
                          </td>

                          {/* تارجت المحافظة */}
                          <td className="tabular font-bold text-xs text-muted-foreground">
                            {currency(r.governorateTarget)}
                          </td>

                          {/* نسبة الإنجاز */}
                          <td className="text-center">
                            <span
                              className={`status-chip tabular text-xs font-bold ${
                                pct >= 100 ? "chip-paid" : pct >= 70 ? "chip-partial" : "chip-due"
                              }`}
                            >
                              <span className="chip-dot" />
                              {pct}%
                            </span>
                          </td>

                          {/* الإجراءات */}
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                onClick={() => openEditDialog(r)}
                                className="action-btn edit"
                                title="تعديل السجل"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(r)}
                                className="action-btn delete"
                                title="حذف السجل"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan={4} className="font-extrabold text-xs">
                      المجموع الكلي:
                    </td>
                    <td colSpan={3} className="text-center tabular font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      إجمالي المباع: {totalSoldUnits.toLocaleString()} قطعة
                    </td>
                    <td className="tabular font-black text-xs text-foreground">
                      {currency(totalSales)}
                    </td>
                    <td className="tabular font-bold text-xs text-muted-foreground">
                      {currency(totalTarget)}
                    </td>
                    <td colSpan={2} className="text-center tabular font-bold text-xs">
                      متوسط الإنجاز: {achievementRate}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </section>
      </main>

      {/* Add / Edit Delegate Record Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="invoice-dialog sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingId ? "تعديل سجل مندوب ومخزون" : "إضافة سجل مندوب ومبيعات جديد"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 pt-2">
            <div className="form-grid">
              {/* المندوب */}
              <label>
                <span>اسم المندوب <strong className="text-red-500">*</strong></span>
                <Input
                  value={form.delegateName}
                  onChange={(e) => setForm({ ...form, delegateName: e.target.value })}
                  placeholder="مثال: علي حسين العبيدي"
                  required
                />
              </label>

              {/* رقم الهاتف */}
              <label>
                <span>رقم هاتف المندوب</span>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0770xxxxxxx"
                />
              </label>

              {/* المحافظة */}
              <label>
                <span>المحافظة <strong className="text-red-500">*</strong></span>
                <Input
                  list="dlg-gov-options"
                  value={form.governorate}
                  onChange={(e) => setForm({ ...form, governorate: e.target.value })}
                  placeholder="اختر أو اكتب المحافظة"
                  required
                />
                <datalist id="dlg-gov-options">
                  <option value="الكوت" />
                  <option value="البصرة" />
                  <option value="الناصرية" />
                  <option value="العمارة" />
                </datalist>
              </label>

              {/* الشركة */}
              <label>
                <span>الشركة <strong className="text-red-500">*</strong></span>
                <Input
                  list="dlg-company-options"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="LDP أو MEDREICH"
                  required
                />
                <datalist id="dlg-company-options">
                  <option value="LDP" />
                  <option value="MEDREICH" />
                </datalist>
              </label>

              {/* المادة */}
              <label>
                <span>المادة (المنتج) <strong className="text-red-500">*</strong></span>
                <Input
                  value={form.item}
                  onChange={(e) => setForm({ ...form, item: e.target.value })}
                  placeholder="مثال: بانادول إكسترا 500 ملغم"
                  required
                />
              </label>

              {/* ستوك سابق */}
              <label>
                <span>ستوك سابق (قطع)</span>
                <Input
                  type="number"
                  min={0}
                  value={form.prevStock || ""}
                  onChange={(e) => setForm({ ...form, prevStock: Number(e.target.value) || 0 })}
                  placeholder="0"
                />
              </label>

              {/* ستوك حالي */}
              <label>
                <span>ستوك حالي (قطع)</span>
                <Input
                  type="number"
                  min={0}
                  value={form.currentStock || ""}
                  onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) || 0 })}
                  placeholder="0"
                />
              </label>

              {/* مبلغ المبيعات */}
              <label>
                <span>مبلغ المبيعات (د.ع) <strong className="text-red-500">*</strong></span>
                <Input
                  type="number"
                  min={0}
                  value={form.salesAmount || ""}
                  onChange={(e) => setForm({ ...form, salesAmount: Number(e.target.value) || 0 })}
                  placeholder="المبيعات المحققة"
                  required
                />
              </label>

              {/* تارجت المحافظة */}
              <label>
                <span>تارجت المحافظة (د.ع) <strong className="text-red-500">*</strong></span>
                <Input
                  type="number"
                  min={0}
                  value={form.governorateTarget || ""}
                  onChange={(e) => setForm({ ...form, governorateTarget: Number(e.target.value) || 0 })}
                  placeholder="الهدف المالي للمحافظة"
                  required
                />
              </label>
            </div>

            {/* Live Calculations preview */}
            <div className="computed-preview">
              <div>
                <span>القطع المباعة</span>
                <strong>{Math.max(0, form.prevStock - form.currentStock).toLocaleString()} قطعة</strong>
              </div>
              <div>
                <span>نسبة إنجاز التارجت</span>
                <strong>
                  {form.governorateTarget > 0
                    ? Math.round((form.salesAmount / form.governorateTarget) * 100)
                    : 0}
                  %
                </strong>
              </div>
            </div>

            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={saving} className="btn-primary">
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "إضافة السجل"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Delegates;
