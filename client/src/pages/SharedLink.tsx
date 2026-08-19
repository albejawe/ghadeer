import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Globe2,
  Loader2,
  MapPin,
  Printer,
  ShieldCheck,
  Wallet,
  Warehouse,
} from "lucide-react";
import { sharedIdFromPath } from "@/lib/sharedLinkUtils";
import { findLocalLink, invoicesFromLocalLink } from "@/lib/localWallet";
import { currency, statusChipClass, type Invoice } from "@/components/dashboard/types";

type SharedData = { name: string; invoices: Invoice[] };

const formatDate = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

export default function SharedLink() {
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const id = sharedIdFromPath(window.location.pathname);

  useEffect(() => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    let active = true;
    fetch(`/api/shared-links/public/${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("not-found");
        return response.json();
      })
      .then((payload) => {
        if (active)
          setData({
            name: payload.link.name,
            invoices: Array.isArray(payload.invoices) ? payload.invoices : [],
          });
      })
      .catch(() => {
        if (!active) return;
        const localLink = findLocalLink(id);
        if (localLink) {
          setData({ name: localLink.name, invoices: invoicesFromLocalLink(localLink) });
        } else {
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const totals = useMemo(() => {
    const invoices = data?.invoices ?? [];
    return {
      amount: invoices.reduce((n, i) => n + i.amount, 0),
      paid: invoices.reduce((n, i) => n + i.paid, 0),
      remaining: invoices.reduce((n, i) => n + i.remaining, 0),
      count: invoices.length,
    };
  }, [data]);

  const handlePrint = () => {
    window.print();
  };

  if (loading)
    return (
      <main className="shared-page" dir="rtl">
        <div className="shared-loading-card">
          <Loader2 className="animate-spin text-teal-600 size-8 mb-3" aria-hidden />
          <h3 className="font-bold text-lg">جارٍ تحميل التقرير المالي...</h3>
          <p className="text-sm text-muted-foreground">يتم جلب القيود المعتمدة من الخادم السحابي</p>
        </div>
      </main>
    );

  if (error || !data)
    return (
      <main className="shared-page" dir="rtl">
        <div className="shared-error-card">
          <div className="error-icon-circle">
            <ShieldCheck size={32} className="text-muted-foreground" aria-hidden />
          </div>
          <h1 className="text-xl font-bold">الرابط غير متاح أو منتهي الصلاحية</h1>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            تم تعطيل هذا الرابط المشترك من قِبل إدارة الحسابات أو أنه لم يعد صالحاً. يرجى التواصل مع المحاسب للحصول على رابط جديد.
          </p>
        </div>
      </main>
    );

  return (
    <main className="shared-page" dir="rtl">
      {/* Top Header / Branding Bar */}
      <div className="shared-head">
        <div className="shared-title-block">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="brand-badge">
              <Warehouse size={13} className="text-teal-600 dark:text-teal-400" />
              نظام غدير المحاسبي
            </span>
            <span className="readonly-pill">
              <ShieldCheck size={13} />
              تقرير عام معتمد للقراءة
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black">{data.name}</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            كشف حسابات موثق يحتوي على {totals.count} فاتورة — تم التحديث تلقائياً
          </p>
        </div>

        <div className="shared-actions no-print">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer size={15} className="ml-1.5" />
            طباعة الكشف / PDF
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="shared-summary" aria-label="ملخص التقرير">
        <Card className="stat-card tone-blue">
          <div className="stat-glow-bg" />
          <div className="stat-header">
            <div className="stat-icon-badge blue">
              <Wallet size={19} />
            </div>
          </div>
          <div className="stat-body">
            <span className="stat-label">إجمالي مبلغ الفواتير</span>
            <h3 className="stat-value tabular">{currency(totals.amount)}</h3>
            <span className="stat-footer-hint">
              <span className="hint-text">{totals.count} فاتورة مسجلة</span>
            </span>
          </div>
        </Card>

        <Card className="stat-card tone-green">
          <div className="stat-glow-bg" />
          <div className="stat-header">
            <div className="stat-icon-badge green">
              <CheckCircle2 size={19} />
            </div>
          </div>
          <div className="stat-body">
            <span className="stat-label">إجمالي المسدد</span>
            <h3 className="stat-value tabular text-emerald-600 dark:text-emerald-400">
              {currency(totals.paid)}
            </h3>
            <span className="stat-footer-hint">
              <span className="hint-text font-bold">
                نسبة السداد: {totals.amount > 0 ? Math.round((totals.paid / totals.amount) * 100) : 0}%
              </span>
            </span>
          </div>
        </Card>

        <Card className="stat-card tone-amber">
          <div className="stat-glow-bg" />
          <div className="stat-header">
            <div className="stat-icon-badge amber">
              <Clock size={19} />
            </div>
          </div>
          <div className="stat-body">
            <span className="stat-label">إجمالي المتبقي (الديون)</span>
            <h3 className="stat-value tabular text-amber-600 dark:text-amber-400">
              {currency(totals.remaining)}
            </h3>
            <span className="stat-footer-hint">
              <span className="hint-text">مستحق للمطالبة</span>
            </span>
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="table-card">
        {data.invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-orbit">
              <ShieldCheck size={30} aria-hidden />
            </div>
            <h3 className="font-bold text-base">لا توجد فواتير مدرجة في هذا التقرير</h3>
            <p className="text-xs text-muted-foreground">قد تكون الفواتير مسددة بالكامل أو لم تتم إضافتها بعد.</p>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="invoices-data-table">
                <thead>
                  <tr>
                    <th scope="col">الشركة / المحافظة</th>
                    <th scope="col">المذخر</th>
                    <th scope="col">رقم الفاتورة</th>
                    <th scope="col">تاريخ الاستحقاق</th>
                    <th scope="col">المبلغ الإجمالي</th>
                    <th scope="col">المدفوع</th>
                    <th scope="col">المتبقي</th>
                    <th scope="col">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((item) => {
                    const isOverdue = new Date(item.dueAt) <= new Date() && item.remaining > 0;
                    return (
                      <tr key={item.id} className={`table-data-row ${isOverdue ? "row-overdue" : ""}`}>
                        <td>
                          <div className="company-cell">
                            <strong className="company-name">{item.company}</strong>
                            {item.governorate && (
                              <span className="gov-badge">
                                <MapPin size={11} /> {item.governorate}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="truncate">{item.warehouse || "—"}</span>
                        </td>
                        <td>
                          <span className="invoice-number-pill tabular">#{item.number}</span>
                        </td>
                        <td className="tabular">
                          <div className="due-cell">
                            <span className={isOverdue ? "text-destructive font-bold" : ""}>
                              {formatDate(item.dueAt)}
                            </span>
                            {isOverdue && (
                              <span className="overdue-chip">
                                <AlertCircle size={10} /> مستحقة
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="tabular font-bold">{currency(item.amount)}</td>
                        <td className="tabular text-emerald-600 dark:text-emerald-400">
                          {currency(item.paid)}
                        </td>
                        <td className="tabular font-bold text-amber-600 dark:text-amber-400">
                          {currency(item.remaining)}
                        </td>
                        <td>
                          <span className={`status-chip ${statusChipClass[item.status as Invoice["status"]] ?? ""}`}>
                            <span className="chip-dot" />
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan={4} className="font-bold">
                      المجموع العام ({totals.count} فاتورة):
                    </td>
                    <td className="tabular font-black">{currency(totals.amount)}</td>
                    <td className="tabular font-bold text-emerald-600 dark:text-emerald-400">
                      {currency(totals.paid)}
                    </td>
                    <td className="tabular font-black text-amber-600 dark:text-amber-400">
                      {currency(totals.remaining)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile View */}
            <div className="mobile-cards-view">
              {data.invoices.map((item) => (
                <div key={item.id} className="invoice-mobile-card">
                  <div className="card-top">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base">{item.company}</h4>
                        <span className="invoice-number-pill tabular">#{item.number}</span>
                      </div>
                      <div className="card-sub-meta">
                        {item.warehouse && (
                          <span className="meta-tag">
                            <Warehouse size={12} /> {item.warehouse}
                          </span>
                        )}
                        {item.governorate && (
                          <span className="meta-tag">
                            <MapPin size={12} /> {item.governorate}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`status-chip ${statusChipClass[item.status as Invoice["status"]] ?? ""}`}>
                      <span className="chip-dot" />
                      {item.status}
                    </span>
                  </div>

                  <div className="card-amounts-grid">
                    <div className="amount-col">
                      <span className="amount-lbl">المبلغ الإجمالي</span>
                      <strong className="amount-val tabular">{currency(item.amount)}</strong>
                    </div>
                    <div className="amount-col">
                      <span className="amount-lbl">المدفوع</span>
                      <strong className="amount-val tabular text-emerald-600">{currency(item.paid)}</strong>
                    </div>
                    <div className="amount-col">
                      <span className="amount-lbl">المتبقي</span>
                      <strong className="amount-val tabular text-amber-600">{currency(item.remaining)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <footer className="shared-footer-note">
        <p>
          نظام غدير المحاسبي — تقرير موثق صادر بتاريخ{" "}
          {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())}
        </p>
      </footer>
    </main>
  );
}