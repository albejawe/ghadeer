import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Check, FileSpreadsheet, Plus, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { StatCard } from "@/components/dashboard/StatCards";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { InvoiceTable } from "@/components/dashboard/InvoiceTable";
import { InvoiceDialog, type InvoiceForm } from "@/components/dashboard/InvoiceDialog";
import { LinksPanel } from "@/components/dashboard/LinksPanel";
import type { Invoice, SharedLink, SortKey, SortState } from "@/components/dashboard/types";
import { normalizeSelectOptions, applyInvoiceFilters } from "@shared/invoiceLogic";
import { buildExcelHtml, buildPrintTitle } from "@/lib/exportUtils";
import { createSharedLinkRequest, sharedLinkPath } from "@/lib/sharedLinkUtils";

const toDateInputValue = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const emptyForm = (): InvoiceForm => ({
  company: "",
  governorate: "",
  warehouse: "",
  number: "",
  createdAt: new Date().toISOString().slice(0, 10),
  amount: "",
  paid: "",
  note: "",
});

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [activeView, setActiveView] = useState<"dashboard" | "links">("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("الكل");
  const [governorate, setGovernorate] = useState("الكل");
  const [warehouse, setWarehouse] = useState("الكل");
  const [status, setStatus] = useState("الكل");
  const [quick, setQuick] = useState("الكل");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "createdAt", dir: "desc" });
  const [form, setForm] = useState<InvoiceForm>(emptyForm);

  const filtered = useMemo(
    () =>
      applyInvoiceFilters(invoices, {
        company,
        governorate,
        warehouse,
        status,
        number: search,
        quick,
        dueFrom: dueFrom || undefined,
        dueTo: dueTo || undefined,
        amountMin: amountMin || undefined,
        amountMax: amountMax || undefined,
      }),
    [invoices, company, governorate, warehouse, status, quick, search, dueFrom, dueTo, amountMin, amountMax]
  );

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "createdAt" || sort.key === "dueAt") {
        cmp = new Date(a[sort.key]).getTime() - new Date(b[sort.key]).getTime();
      } else if (typeof a[sort.key] === "number") {
        cmp = Number(a[sort.key]) - Number(b[sort.key]);
      } else {
        cmp = String(a[sort.key]).localeCompare(String(b[sort.key]), "ar");
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sort]);

  const stats = useMemo(
    () => ({
      amount: filtered.reduce((n, i) => n + i.amount, 0),
      paid: filtered.reduce((n, i) => n + i.paid, 0),
      remaining: filtered.reduce((n, i) => n + i.remaining, 0),
      overdue: filtered
        .filter((i) => new Date(i.dueAt) <= new Date() && i.remaining > 0)
        .reduce((n, i) => n + i.remaining, 0),
    }),
    [filtered]
  );

  const options = (key: keyof Invoice) => normalizeSelectOptions(invoices.map((item) => item[key]));

  const collectionRate = stats.amount > 0 ? (stats.paid / stats.amount) * 100 : 0;
  const debtRate = stats.amount > 0 ? (stats.remaining / stats.amount) * 100 : 0;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (item: Invoice) => {
    setEditing(item);
    setForm({
      company: item.company,
      governorate: item.governorate,
      warehouse: item.warehouse,
      number: item.number,
      createdAt: toDateInputValue(item.createdAt),
      amount: String(item.amount),
      paid: String(item.paid),
      note: item.note,
    });
    setFormOpen(true);
  };

  const saveInvoice = async () => {
    const amount = Number(form.amount);
    const paid = Number(form.paid || 0);
    if (!form.company || !form.number || !amount) {
      toast.error("يرجى إكمال الشركة ورقم الفاتورة والمبلغ");
      return;
    }
    const next: Invoice = {
      id: editing?.id ?? crypto.randomUUID(),
      company: form.company,
      governorate: form.governorate,
      warehouse: form.warehouse,
      number: form.number,
      createdAt: form.createdAt,
      dueAt: "",
      amount,
      paid,
      remaining: 0,
      status: "غير مسدد",
      note: form.note,
    };
    try {
      const response = await fetch(editing ? `/api/invoices/${editing.id}` : "/api/invoices", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("save");
      const payload = await response.json();
      const saved = payload.invoice as Invoice;
      setInvoices((old) =>
        editing ? old.map((i) => (i.id === editing.id ? saved : i)) : [saved, ...old]
      );
      setFormOpen(false);
      toast.success(editing ? "تم تحديث الفاتورة" : "تمت إضافة الفاتورة");
    } catch {
      toast.error("تعذر حفظ الفاتورة");
    }
  };

  const deleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`هل أنت متأكد من حذف فاتورة ${invoice.company} رقم ${invoice.number}؟ سيتم حذفها نهائياً من الموقع وGoogle Sheet.`)) return;
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete");
      setInvoices((old) => old.filter((i) => i.id !== invoice.id));
      toast.success("تم حذف الفاتورة نهائياً");
    } catch {
      toast.error("تعذر حذف الفاتورة");
    }
  };

  const currentFilters = { company, governorate, warehouse, status, quick, search, dueFrom, dueTo, amountMin, amountMax };

  const exportExcel = () => {
    if (filtered.length === 0) return;
    const blob = new Blob(["\ufeff", buildExcelHtml(filtered)], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "hisabati-invoices.xls";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    toast.success("تم تنزيل ملف Excel للنتائج الحالية");
  };

  const printReport = () => {
    const previousTitle = document.title;
    document.title = buildPrintTitle();
    document.body.classList.add("print-report");
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
      document.body.classList.remove("print-report");
    }, 700);
  };

  const loadSharedLinks = async () => {
    try {
      const response = await fetch("/api/shared-links");
      if (!response.ok) throw new Error("links");
      const payload = await response.json();
      setSharedLinks(payload.links || []);
    } catch {
      toast.error("تعذر تحميل الروابط المشتركة");
    }
  };

  const createShared = async () => {
    try {
      const response = await fetch("/api/shared-links", createSharedLinkRequest(currentFilters));
      if (!response.ok) throw new Error("create-link");
      const payload = await response.json();
      const link = payload.link as SharedLink;
      setSharedLinks((old) => [link, ...old]);
      await navigator.clipboard?.writeText(sharedLinkPath(window.location.origin, link.id));
      toast.success("تم إنشاء الرابط ونسخه");
    } catch {
      toast.error("تعذر إنشاء الرابط");
    }
  };

  const copyShared = async (link: SharedLink) => {
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}/shared/${link.id}`);
      toast.success("تم نسخ الرابط");
    } catch {
      toast.error("تعذر نسخ الرابط");
    }
  };

  const toggleShared = async (link: SharedLink) => {
    try {
      const response = await fetch(`/api/shared-links/${link.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !link.active }),
      });
      if (!response.ok) throw new Error("toggle");
      setSharedLinks((old) =>
        old.map((item) => (item.id === link.id ? { ...item, active: !item.active } : item))
      );
      toast.success(link.active ? "تم إيقاف الرابط" : "تم تفعيل الرابط");
    } catch {
      toast.error("تعذر تحديث الرابط");
    }
  };

  const removeShared = async (link: SharedLink) => {
    if (!confirm("هل أنت متأكد من حذف هذا الرابط؟ لن يعمل بعد الآن.")) return;
    try {
      const response = await fetch(`/api/shared-links/${link.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("remove");
      setSharedLinks((old) => old.filter((item) => item.id !== link.id));
      toast.success("تم حذف الرابط");
    } catch {
      toast.error("تعذر حذف الرابط");
    }
  };

  const resetFilters = () => {
    setCompany("الكل");
    setGovernorate("الكل");
    setWarehouse("الكل");
    setStatus("الكل");
    setQuick("الكل");
    setSearch("");
    setDueFrom("");
    setDueTo("");
    setAmountMin("");
    setAmountMax("");
  };

  const runSync = async (silent = false) => {
    setSyncing(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/sync/run", { signal: controller.signal });
      if (!response.ok) throw new Error("sync");
      const payload = await response.json();
      if (!Array.isArray(payload.invoices)) throw new Error("invalid-sync");
      setInvoices(payload.invoices);
      setLastSync(
        new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      );
      if (!silent) toast.success("تمت المزامنة بنجاح");
    } catch {
      if (!silent) toast.error("تعذر إتمام المزامنة؛ تم الاحتفاظ بالبيانات المخزنة");
    } finally {
      window.clearTimeout(timeout);
      setSyncing(false);
      setLoadingData(false);
    }
  };

  const loadCachedInvoices = async () => {
    try {
      const response = await fetch("/api/invoices");
      if (!response.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload.invoices)) setInvoices(payload.invoices);
      setLoadingData(false);
    } catch {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    void loadCachedInvoices();
    void runSync(true);
  }, []);

  useEffect(() => {
    if (activeView === "links") void loadSharedLinks();
  }, [activeView]);

  return (
    <div className="app-shell" dir="rtl">
      <Sidebar
        view={activeView}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onNavigate={(view) => {
          setActiveView(view);
          setMobileOpen(false);
        }}
        onSettings={() => toast.info("إعدادات المزامنة ستظهر بعد ربط Google Apps Script")}
        onSecurity={() => toast.info("يمكن تغيير كلمة السر من هنا بعد تفعيل المصادقة")}
        badges={{ invoices: invoices.length, links: sharedLinks.length }}
      />
      {mobileOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="إغلاق القائمة"
        />
      )}

      <main className="main-content">
        <Topbar
          view={activeView}
          syncing={syncing}
          lastSync={lastSync}
          mobileOpen={mobileOpen}
          onToggleMobile={setMobileOpen}
          onSync={() => void runSync()}
          ready={!loadingData}
        />

        {activeView === "links" ? (
          <LinksPanel
            links={sharedLinks}
            onCreate={() => void createShared()}
            onOpen={(link) => window.open(`/shared/${link.id}`, "_blank", "noopener,noreferrer")}
            onCopy={(link) => void copyShared(link)}
            onToggle={(link) => void toggleShared(link)}
            onRemove={(link) => void removeShared(link)}
            onBack={() => setActiveView("dashboard")}
          />
        ) : (
          <section className="page-container" aria-label="الحسابات">
            <div className="page-heading compact-heading">
              <div>
                <p className="eyebrow">نظرة عامة</p>
                <h1>حساباتي</h1>
              </div>
              <div className="heading-actions">
                <Button variant="outline" onClick={exportExcel}>
                  <FileSpreadsheet size={17} aria-hidden />
                  تصدير Excel
                </Button>
                <Button onClick={openCreate}>
                  <Plus size={18} aria-hidden />
                  إضافة فاتورة
                </Button>
              </div>
            </div>

            <FilterBar
              invoices={invoices}
              resultCount={filtered.length}
              search={search}
              company={company}
              governorate={governorate}
              warehouse={warehouse}
              status={status}
              quick={quick}
              dueFrom={dueFrom}
              dueTo={dueTo}
              amountMin={amountMin}
              amountMax={amountMax}
              onSearch={setSearch}
              onCompany={setCompany}
              onGovernorate={setGovernorate}
              onWarehouse={setWarehouse}
              onStatus={setStatus}
              onQuick={setQuick}
              onDueFrom={setDueFrom}
              onDueTo={setDueTo}
              onAmountMin={setAmountMin}
              onAmountMax={setAmountMax}
              onReset={resetFilters}
            />

            <div className="stats-grid">
              <StatCard
                title="إجمالي الفواتير"
                value={stats.amount}
                hint={`${filtered.length} فاتورة`}
                icon={WalletCards}
                tone="blue"
                loading={loadingData}
              />
              <StatCard
                title="إجمالي المدفوع"
                value={stats.paid}
                hint="نسبة التحصيل"
                icon={Check}
                tone="green"
                loading={loadingData}
                progress={collectionRate}
                variant="ring"
              />
              <StatCard
                title="إجمالي المتبقي"
                value={stats.remaining}
                hint="إجمالي الديون"
                icon={BarChart3}
                tone="amber"
                loading={loadingData}
                progress={debtRate}
              />
              <StatCard
                title="الديون المستحقة"
                value={stats.overdue}
                hint="تحتاج إلى متابعة"
                icon={CalendarDays}
                tone="red"
                loading={loadingData}
              />
            </div>

            <InvoiceTable
              invoices={sorted}
              totalCount={filtered.length}
              loading={loadingData}
              syncing={syncing}
              sort={sort}
              onSort={(key: SortKey) =>
                setSort((prev) =>
                  prev.key === key
                    ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
                    : { key, dir: "desc" }
                )
              }
              onEdit={openEdit}
              onDelete={deleteInvoice}
              onAdd={openCreate}
              onSync={() => void runSync()}
              onPrint={printReport}
              onShare={() => void createShared()}
            />
          </section>
        )}
      </main>

      <InvoiceDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        form={form}
        onFormChange={setForm}
        options={options}
        onSave={() => void saveInvoice()}
      />
    </div>
  );
}