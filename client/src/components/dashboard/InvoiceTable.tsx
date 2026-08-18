import { ArrowDown, ArrowUp, ChevronsUpDown, ClipboardList, FileText, Link2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
};

const COLUMNS: Column[] = [
  { key: "company", label: "الشركة", sortable: true },
  { key: "warehouse", label: "المذخر", sortable: true },
  { key: "number", label: "رقم الفاتورة", sortable: true },
  { key: "dueAt", label: "تاريخ الاستحقاق", sortable: true },
  { key: "amount", label: "مبلغ الفاتورة", sortable: true },
  { key: "remaining", label: "المتبقي", sortable: true },
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
    <th scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
      <button
        className="sort-button"
        onClick={() => onSort(column.key)}
        aria-label={`ترتيب حسب ${column.label}`}
      >
        {column.label}
        {dir ? (
          dir === "asc" ? (
            <ArrowUp size={12} aria-hidden />
          ) : (
            <ArrowDown size={12} aria-hidden />
          )
        ) : (
          <ChevronsUpDown size={12} aria-hidden />
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
          <RefreshCw size={28} className="animate-spin" aria-hidden />
        ) : (
          <ClipboardList size={28} aria-hidden />
        )}
      </div>
      <h3>{loading ? "جارٍ تحميل الفواتير" : syncing ? "جارٍ تحديث البيانات" : "لا توجد فواتير"}</h3>
      <p>
        {busy
          ? "يتم جلب أحدث البيانات من Google Sheets."
          : "أضف فاتورة جديدة أو نفّذ المزامنة لجلب البيانات."}
      </p>
      {!loading && (
        <div className="empty-actions">
          <Button onClick={onAdd}>
            <Plus size={17} aria-hidden />
            إضافة فاتورة
          </Button>
          <Button variant="outline" onClick={onSync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} aria-hidden />
            مزامنة الآن
          </Button>
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  const widths = [34, 26, 20, 28, 24, 22, 18];
  return (
    <div className="table-scroll" aria-hidden>
      <table>
        <tbody className="skeleton-rows">
          {Array.from({ length: 5 }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {widths.map((width, colIndex) => (
                <td key={colIndex}>
                  <div className="skeleton-bar" style={{ width: `${width}%` }} />
                </td>
              ))}
              <td>
                <div className="skeleton-bar" style={{ width: "70%" }} />
              </td>
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
  const visibleInvoices = invoices.slice(0, 100);
  const totals = visibleInvoices.reduce(
    (acc, item) => ({
      amount: acc.amount + item.amount,
      remaining: acc.remaining + item.remaining,
    }),
    { amount: 0, remaining: 0 }
  );
  const visible = visibleInvoices.length;
  return (
    <Card className="table-card">
      <div className="table-header">
        <div>
          <h3>الفواتير</h3>
          <p>
            عرض {totalCount ? 1 : 0}–{visible} من {totalCount}
          </p>
        </div>
        <div className="table-tools">
          <Button variant="outline" size="sm" onClick={onPrint}>
            <FileText size={15} aria-hidden />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={onShare}>
            <Link2 size={15} aria-hidden />
            مشاركة النتائج
          </Button>
        </div>
      </div>

      {loading && invoices.length === 0 ? (
        <SkeletonRows />
      ) : invoices.length === 0 ? (
        <EmptyState onAdd={onAdd} onSync={onSync} syncing={syncing} loading={loading} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <SortableHeader key={column.key} column={column} sort={sort} onSort={onSort} />
                ))}
                <th scope="col">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((item) => {
                const paidPct = item.amount > 0 ? Math.min(100, (item.paid / item.amount) * 100) : 0;
                const isOverdue = new Date(item.dueAt) <= new Date() && item.remaining > 0;
                return (
                <tr key={item.id}>
                  <td>
                    <strong>{item.company}</strong>
                    {item.governorate && <small>{item.governorate}</small>}
                  </td>
                  <td>{item.warehouse || "—"}</td>
                  <td className="ltr tabular">{item.number}</td>
                  <td className="tabular">{formatDate(item.dueAt)}</td>
                  <td className="tabular">{currency(item.amount)}</td>
                  <td>
                    <div className="balance-cell" title={`نسبة السداد ${Math.round(paidPct)}%`}>
                      <span className="tabular">{currency(item.remaining)}</span>
                      <span
                        className={`mini-track ${isOverdue ? "overdue" : ""}`}
                        aria-hidden
                      >
                        <span className="mini-fill" style={{ width: `${paidPct}%` }} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <Badge variant="outline" className={statusChipClass[item.status]}>
                      {item.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => onEdit(item)} aria-label="تعديل الفاتورة">
                        <Pencil size={15} aria-hidden />
                      </button>
                      <button className="danger" onClick={() => onDelete(item)} aria-label="حذف الفاتورة">
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="totals-row">
                <td colSpan={5}>إجمالي النتائج المعروضة</td>
                <td className="tabular">{currency(totals.amount)}</td>
                <td className="tabular amber-total">{currency(totals.remaining)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}