import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  Calendar,
  ChevronsUpDown,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Link2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currency, statusChipClass, type Invoice, type SortKey, type SortState } from "./types";

type InvoiceTableProps = {
  invoices: Invoice[];
  totalCount: number;
  loading: boolean;
  syncing: boolean;
  sort: SortState;
  onSort: (key: SortKey) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onAdd: () => void;
  onSync: () => void;
  onPrint: () => void;
  onShare: () => void;
};

type Column = {
  key: SortKey;
  label: string;
  sortable: boolean;
  className?: string;
};

const COLUMNS: Column[] = [
  { key: "company", label: "الشركة / المحافظة", sortable: true },
  { key: "warehouse", label: "المذخر", sortable: true },
  { key: "number", label: "رقم الفاتورة", sortable: true },
  { key: "createdAt", label: "تاريخ الإنشاء", sortable: true },
  { key: "dueAt", label: "تاريخ الاستحقاق", sortable: true },
  { key: "amount", label: "المبلغ الإجمالي", sortable: true },
  { key: "remaining", label: "المتبقي / السداد", sortable: true },
  { key: "status", label: "الحالة", sortable: true },
];

function SortableHeader({
  column,
  sort,
  onSort,
}: {
  column: Column;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column.key;
  const dir = active ? sort.dir : null;
  return (
    <th scope="col" className={column.className} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
      <button
        className={`sort-button ${active ? "is-active" : ""}`}
        onClick={() => onSort(column.key)}
        aria-label={`ترتيب حسب ${column.label}`}
      >
        <span>{column.label}</span>
        {dir ? (
          dir === "asc" ? (
            <ArrowUp size={13} className="text-teal-600 dark:text-teal-400" aria-hidden />
          ) : (
            <ArrowDown size={13} className="text-teal-600 dark:text-teal-400" aria-hidden />
          )
        ) : (
          <ChevronsUpDown size={13} className="opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}

function EmptyState({
  onAdd,
  onSync,
  syncing,
  loading,
}: {
  onAdd: () => void;
  onSync: () => void;
  syncing: boolean;
  loading: boolean;
}) {
  const busy = loading || syncing;
  return (
    <div className="empty-state">
      <div className="empty-orbit">
        {busy ? (
          <RefreshCw size={30} className="animate-spin text-teal-600" aria-hidden />
        ) : (
          <ClipboardList size={32} className="text-muted-foreground" aria-hidden />
        )}
      </div>
      <h3 className="text-lg font-bold">
        {loading ? "جارٍ تحميل الفواتير..." : syncing ? "جارٍ مزامنة البيانات من Google Sheets..." : "لا توجد فواتير مطابقة"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {busy
          ? "يتم جلب أحدث القيود والمستحقات، يرجى الانتظار لحظات."
          : "لم يتم العثور على فواتير بالمعايير المحددة. جرب تغيير الفلاتر أو إضافة فاتورة جديدة."}
      </p>
      {!busy && (
        <div className="empty-actions">
          <Button onClick={onAdd}>
            <Plus size={16} aria-hidden />
            إضافة فاتورة جديدة
          </Button>
          <Button variant="outline" onClick={onSync}>
            <RefreshCw size={15} aria-hidden />
            مزامنة البيانات الآن
          </Button>
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="table-scroll" aria-hidden>
      <table className="w-full">
        <tbody className="skeleton-rows">
          {Array.from({ length: 6 }, (_, rowIndex) => (
            <tr key={rowIndex} className="border-b">
              {Array.from({ length: 9 }, (_, colIndex) => (
                <td key={colIndex} className="p-3.5">
                  <div
                    className="skeleton-bar h-4 rounded bg-muted/60 animate-pulse"
                    style={{ width: `${Math.max(40, (colIndex * 19 + 45) % 95)}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const formatDate = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

export function InvoiceTable({
  invoices,
  totalCount,
  loading,
  syncing,
  sort,
  onSort,
  onEdit,
  onDelete,
  onAdd,
  onSync,
  onPrint,
  onShare,
}: InvoiceTableProps) {
  const visibleInvoices = invoices.slice(0, 150);
  const totals = visibleInvoices.reduce(
    (acc, item) => ({
      amount: acc.amount + item.amount,
      paid: acc.paid + item.paid,
      remaining: acc.remaining + item.remaining,
    }),
    { amount: 0, paid: 0, remaining: 0 }
  );
  const visible = visibleInvoices.length;

  return (
    <Card className="table-card" dir="rtl">
      {/* Table Top Header Bar */}
      <div className="table-header">
        <div className="table-title-area">
          <div className="table-title-row">
            <h3 className="text-base font-bold">سجل الفواتير والمستحقات</h3>
            <span className="table-counter-chip">
              {totalCount > 0 ? `${visible} من أصل ${totalCount} فاتورة` : "0 فواتير"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            عرض وتعديل فواتير المذاخر، تتبع تواريخ الاستحقاق والديون
          </p>
        </div>

        <div className="table-tools">
          <Button variant="outline" size="sm" onClick={onPrint} title="طباعة أو تصدير PDF">
            <FileText size={15} aria-hidden />
            <span>طباعة / PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onShare} title="توليد رابط مشاركة مباشر">
            <Share2 size={15} aria-hidden />
            <span>مشاركة الرابط</span>
          </Button>
          <Button size="sm" onClick={onAdd} className="add-invoice-btn">
            <Plus size={16} aria-hidden />
            <span>إضافة فاتورة</span>
          </Button>
        </div>
      </div>

      {loading && invoices.length === 0 ? (
        <SkeletonRows />
      ) : invoices.length === 0 ? (
        <EmptyState onAdd={onAdd} onSync={onSync} syncing={syncing} loading={loading} />
      ) : (
        <>
          {/* Desktop & Tablet Table */}
          <div className="table-scroll">
            <table className="invoices-data-table">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <SortableHeader key={column.key} column={column} sort={sort} onSort={onSort} />
                  ))}
                  <th scope="col" className="text-center w-[90px]">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.map((item) => {
                  const paidPct = item.amount > 0 ? Math.min(100, (item.paid / item.amount) * 100) : 0;
                  const isOverdue = new Date(item.dueAt) <= new Date() && item.remaining > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`table-data-row ${isOverdue ? "row-overdue" : ""}`}
                    >
                      {/* Company & Governorate */}
                      <td>
                        <div className="company-cell">
                          <strong className="company-name">{item.company}</strong>
                          {item.governorate && (
                            <span className="gov-badge">
                              <MapPin size={11} aria-hidden />
                              {item.governorate}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Warehouse */}
                      <td>
                        <div className="warehouse-cell">
                          <Warehouse size={13} className="text-muted-foreground shrink-0" aria-hidden />
                          <span className="truncate">{item.warehouse || "—"}</span>
                        </div>
                      </td>

                      {/* Invoice Number */}
                      <td>
                        <span className="invoice-number-pill tabular">
                          #{item.number}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="tabular text-muted-foreground text-xs">
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Due At */}
                      <td>
                        <div className="due-cell">
                          <span className={`tabular ${isOverdue ? "text-destructive font-bold" : ""}`}>
                            {formatDate(item.dueAt)}
                          </span>
                          {isOverdue && (
                            <span className="overdue-chip" title="فاتورة متأخرة عن موعد الاستحقاق">
                              <AlertCircle size={11} />
                              مستحقة
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="tabular font-bold text-foreground">
                        {currency(item.amount)}
                      </td>

                      {/* Remaining / Progress */}
                      <td>
                        <div className="balance-cell" title={`المدفوع: ${currency(item.paid)} (${Math.round(paidPct)}%)`}>
                          <span className={`tabular font-bold ${item.remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {currency(item.remaining)}
                          </span>
                          <div className="progress-mini-track" aria-hidden>
                            <div
                              className={`progress-mini-fill ${item.remaining === 0 ? "bg-emerald-500" : isOverdue ? "bg-red-500" : "bg-amber-500"}`}
                              style={{ width: `${paidPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-chip ${statusChipClass[item.status]}`}>
                          <span className="chip-dot" aria-hidden />
                          {item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-center">
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            aria-label={`تعديل فاتورة ${item.company} رقم ${item.number}`}
                            className="action-btn edit"
                            title="تعديل الفاتورة"
                          >
                            <Pencil size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            aria-label={`حذف فاتورة ${item.company} رقم ${item.number}`}
                            className="action-btn delete"
                            title="حذف الفاتورة"
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td colSpan={5} className="font-bold">
                    إجمالي النتائج المعروضة ({visible} فاتورة):
                  </td>
                  <td className="tabular font-extrabold text-foreground">
                    {currency(totals.amount)}
                  </td>
                  <td className="tabular font-extrabold text-amber-600 dark:text-amber-400">
                    {currency(totals.remaining)}
                  </td>
                  <td colSpan={2} className="text-xs text-muted-foreground">
                    المدفوع: {currency(totals.paid)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="mobile-cards-view">
            {visibleInvoices.map((item) => {
              const paidPct = item.amount > 0 ? Math.min(100, (item.paid / item.amount) * 100) : 0;
              const isOverdue = new Date(item.dueAt) <= new Date() && item.remaining > 0;

              return (
                <div key={item.id} className={`invoice-mobile-card ${isOverdue ? "is-overdue" : ""}`}>
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
                    <span className={`status-chip ${statusChipClass[item.status]}`}>
                      <span className="chip-dot" aria-hidden />
                      {item.status}
                    </span>
                  </div>

                  <div className="card-amounts-grid">
                    <div className="amount-col">
                      <span className="amount-lbl">المبلغ الإجمالي</span>
                      <strong className="amount-val tabular">{currency(item.amount)}</strong>
                    </div>
                    <div className="amount-col">
                      <span className="amount-lbl">المتبقي</span>
                      <strong className="amount-val tabular text-amber-600 dark:text-amber-400">
                        {currency(item.remaining)}
                      </strong>
                    </div>
                    <div className="amount-col">
                      <span className="amount-lbl">تاريخ الاستحقاق</span>
                      <span className={`tabular text-xs font-semibold ${isOverdue ? "text-red-500 font-bold" : ""}`}>
                        {formatDate(item.dueAt)}
                      </span>
                    </div>
                  </div>

                  <div className="card-footer-actions">
                    <span className="text-xs text-muted-foreground">
                      أنشئت: {formatDate(item.createdAt)}
                    </span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                        <Pencil size={13} className="ml-1" />
                        تعديل
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(item)}>
                        <Trash2 size={13} className="ml-1" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}