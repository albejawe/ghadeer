import { Download, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type Sale = {
  id: string;
  saleDate: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  supervisor: string;
  representative: string;
  governorate: string;
  company: string;
  material: string;
};
const number = (value: number) => value.toLocaleString("en-US");
const money = (value: number) => `${number(value)} د.ع`;
async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/local${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!response.ok) throw new Error("تعذر تنفيذ العملية");
  return response.json();
}

export function SalesHistory({
  sales,
  warehouseUnits,
  onRefresh,
  onMessage,
}: {
  sales: Sale[];
  warehouseUnits: number;
  onRefresh: () => void;
  onMessage: (text: string, type?: "success" | "error" | "info") => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    governorate: "",
    representative: "",
    supervisor: "",
    material: "",
  });
  const [editing, setEditing] = useState<Sale | null>(null);
  const [saving, setSaving] = useState(false);
  const options = useMemo(
    () => ({
      governorates: Array.from(new Set(sales.map(sale => sale.governorate))),
      representatives: Array.from(
        new Set(sales.map(sale => sale.representative))
      ),
      supervisors: Array.from(new Set(sales.map(sale => sale.supervisor))),
      materials: Array.from(new Set(sales.map(sale => sale.material))),
    }),
    [sales]
  );
  const filtered = useMemo(
    () =>
      sales.filter(sale => {
        const needle = query.trim().toLowerCase();
        return (
          (!needle ||
            [
              sale.material,
              sale.representative,
              sale.governorate,
              sale.supervisor,
              sale.saleDate,
            ].some(value => value.toLowerCase().includes(needle))) &&
          (!filters.governorate || sale.governorate === filters.governorate) &&
          (!filters.representative ||
            sale.representative === filters.representative) &&
          (!filters.supervisor || sale.supervisor === filters.supervisor) &&
          (!filters.material || sale.material === filters.material)
        );
      }),
    [sales, query, filters]
  );
  const filteredUnits = filtered.reduce((sum, sale) => sum + sale.quantity, 0);
  const filteredAmount = filtered.reduce(
    (sum, sale) => sum + sale.totalAmount,
    0
  );
  const exportReport = () => {
    if (!filtered.length) return onMessage("لا توجد مبيعات لتصديرها", "info");
    const units = filtered.reduce((sum, sale) => sum + sale.quantity, 0);
    const amount = filtered.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const rows = [
      ["تقرير إدخالات المبيعات"],
      ["إجمالي المذخر", number(warehouseUnits)],
      ["مبيعات المندوبين", number(units)],
      ["صافي المذخر المباشر", number(warehouseUnits - units)],
      ["مبالغ المندوبين", amount],
      [],
      [
        "التاريخ",
        "المحافظة",
        "المندوب",
        "الشركة",
        "المادة",
        "القطع",
        "سعر القطعة",
        "الإجمالي",
        "السوبرفايزر",
      ],
      ...filtered.map(sale => [
        sale.saleDate,
        sale.governorate,
        sale.representative,
        sale.company,
        sale.material,
        sale.quantity,
        sale.unitPrice,
        sale.totalAmount,
        sale.supervisor,
      ]),
    ];
    const csv = rows
      .map(row =>
        row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ghadeer-sales-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const saveEdit = async () => {
    if (
      !editing ||
      !editing.saleDate ||
      !Number.isInteger(editing.quantity) ||
      editing.quantity <= 0
    )
      return onMessage("أدخل تاريخاً وكمية صحيحة", "error");
    setSaving(true);
    try {
      await api(`/sales/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: editing.quantity,
          saleDate: editing.saleDate,
        }),
      });
      setEditing(null);
      onRefresh();
      onMessage("تم تعديل الإدخال");
    } catch {
      onMessage("تعذر تعديل الإدخال", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (sale: Sale) => {
    if (!window.confirm(`حذف مبيعات ${sale.material}؟`)) return;
    try {
      await api(`/sales/${sale.id}`, { method: "DELETE" });
      onRefresh();
      onMessage("تم حذف الإدخال");
    } catch {
      onMessage("تعذر حذف الإدخال", "error");
    }
  };
  return (
    <section className="local-content local-history">
      <div className="local-section-head compact">
        <div>
          <span className="local-kicker">سجل مفصل</span>
          <h2>جميع الإدخالات ({filtered.length})</h2>
          <p>ابحث، فلتر، عدّل، احذف أو صدّر التقرير.</p>
        </div>
        <button
          type="button"
          className="local-secondary"
          onClick={exportReport}
        >
          <Download size={14} /> تصدير التقرير
        </button>
      </div>
      <div className="local-history-summary">
        <div>
          <span>الإدخالات المطابقة</span>
          <strong>{number(filtered.length)}</strong>
        </div>
        <div>
          <span>القطع</span>
          <strong>{number(filteredUnits)}</strong>
        </div>
        <div>
          <span>المبلغ</span>
          <strong>{money(filteredAmount)}</strong>
        </div>
      </div>
      <div className="local-history-filters">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="بحث في الإدخالات"
        />
        {(
          ["governorate", "representative", "supervisor", "material"] as const
        ).map(key => (
          <select
            key={key}
            value={filters[key]}
            onChange={event =>
              setFilters({ ...filters, [key]: event.target.value })
            }
          >
            <option value="">
              كل{" "}
              {key === "governorate"
                ? "المحافظات"
                : key === "representative"
                  ? "المندوبين"
                  : key === "supervisor"
                    ? "السوبرفايزر"
                    : "المواد"}
            </option>
            {options[`${key}s` as keyof typeof options]?.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        ))}
      </div>
      <div className="local-list">
        {filtered.map(sale => (
          <article className="local-list-row" key={sale.id}>
            {editing?.id === sale.id ? (
              <div className="local-inline-editor">
                <strong>{sale.material}</strong>
                <input
                  type="date"
                  value={editing.saleDate}
                  onChange={event =>
                    setEditing({ ...editing, saleDate: event.target.value })
                  }
                />
                <input
                  type="number"
                  min="1"
                  value={editing.quantity}
                  onChange={event =>
                    setEditing({
                      ...editing,
                      quantity: Number(event.target.value),
                    })
                  }
                />
                <button
                  type="button"
                  className="local-secondary"
                  disabled={saving}
                  onClick={() => void saveEdit()}
                >
                  حفظ
                </button>
                <button
                  type="button"
                  className="local-plain-button"
                  onClick={() => setEditing(null)}
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <>
                <div>
                  <strong>{sale.material}</strong>
                  <span>
                    {sale.representative} · {sale.governorate} · {sale.saleDate}{" "}
                    · {sale.supervisor}
                  </span>
                </div>
                <div className="local-history-row-actions">
                  <b>
                    {number(sale.quantity)} قطعة
                    <br />
                    <small>{money(sale.totalAmount)}</small>
                  </b>
                  <button
                    type="button"
                    className="local-plain-button"
                    onClick={() => setEditing(sale)}
                    title="تعديل"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="local-danger-button"
                    onClick={() => void remove(sale)}
                    title="حذف"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
        {!filtered.length && (
          <div className="local-empty">لا توجد إدخالات مطابقة.</div>
        )}
      </div>
    </section>
  );
}
