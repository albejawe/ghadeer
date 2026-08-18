import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, WalletCards } from "lucide-react";
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

  if (loading)
    return (
      <main className="shared-page" dir="rtl">
        <Card className="shared-state">
          <Loader2 className="animate-spin" aria-hidden />
          <p>جارٍ تحميل التقرير</p>
        </Card>
      </main>
    );

  if (error || !data)
    return (
      <main className="shared-page" dir="rtl">
        <Card className="shared-state">
          <ShieldCheck size={30} aria-hidden />
          <h1>الرابط غير متاح</h1>
          <p>قد يكون الرابط متوقفاً أو محذوفاً.</p>
        </Card>
      </main>
    );

  return (
    <main className="shared-page" dir="rtl">
      <div className="shared-head">
        <div>
          <p className="eyebrow">عرض للقراءة فقط</p>
          <h1>{data.name}</h1>
          <p>
            بيانات محدثة من حساباتي — {totals.count} فاتورة
          </p>
        </div>
        <span className="readonly-pill">
          <ShieldCheck size={16} aria-hidden />
          قراءة فقط
        </span>
      </div>

      <div className="shared-summary" aria-label="ملخص التقرير">
        <Card className="stat-card">
          <div className="stat-icon blue">
            <WalletCards size={19} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="stat-label">إجمالي الفواتير</p>
            <p className="stat-value tabular truncate">{currency(totals.amount)}</p>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon green">
            <WalletCards size={19} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="stat-label">إجمالي المدفوع</p>
            <p className="stat-value tabular truncate">{currency(totals.paid)}</p>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon amber">
            <WalletCards size={19} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="stat-label">إجمالي المتبقي</p>
            <p className="stat-value tabular truncate">{currency(totals.remaining)}</p>
          </div>
        </Card>
      </div>

      <Card className="table-card">
        {data.invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-orbit">
              <ShieldCheck size={26} aria-hidden />
            </div>
            <h3>لا توجد فواتير ضمن هذه الفلاتر</h3>
            <p>جرّب إنشاء رابط جديد من صفحة الحسابات مع فلاتر مختلفة.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">الشركة</th>
                  <th scope="col">المذخر</th>
                  <th scope="col">رقم الفاتورة</th>
                  <th scope="col">الاستحقاق</th>
                  <th scope="col">المبلغ</th>
                  <th scope="col">المدفوع</th>
                  <th scope="col">المتبقي</th>
                  <th scope="col">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.company}</strong>
                      {item.governorate && <small>{item.governorate}</small>}
                    </td>
                    <td>{item.warehouse || "—"}</td>
                    <td className="ltr tabular">{item.number}</td>
                    <td className="tabular">{formatDate(item.dueAt)}</td>
                    <td className="tabular">{currency(item.amount)}</td>
                    <td className="tabular">{currency(item.paid)}</td>
                    <td className="tabular">{currency(item.remaining)}</td>
                    <td>
                      <span className={statusChipClass[item.status as Invoice["status"]] ?? "status-chip"}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td colSpan={5}>الإجمالي</td>
                  <td className="tabular">{currency(totals.amount)}</td>
                  <td className="tabular">{currency(totals.paid)}</td>
                  <td className="tabular amber-total">{currency(totals.remaining)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <p className="sheet-note">
        تقرير للقراءة فقط — أُنشئ من حساباتي بتاريخ{" "}
        {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())}
      </p>
    </main>
  );
}