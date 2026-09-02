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
type WarehouseBatch = {
  id: string;
  saleDate: string;
  governorate: string;
  totalQuantity: number;
  totalAmount: number;
  note: string;
  createdByName?: string;
  items: {
    material: string;
    company: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }[];
};
type LegacyWarehouse = {
  id: string;
  saleDate: string;
  governorate: string;
  quantity: number;
  amount: number | null;
  note?: string;
  createdByName: string;
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
  warehouseBatches,
  legacyWarehouse,
  periodLabel,
  onRefresh,
  onMessage,
}: {
  sales: Sale[];
  warehouseBatches: WarehouseBatch[];
  legacyWarehouse: LegacyWarehouse[];
  periodLabel: string;
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
      governorates: Array.from(
        new Set([
          ...sales.map(sale => sale.governorate),
          ...warehouseBatches.map(batch => batch.governorate),
          ...legacyWarehouse.map(item => item.governorate),
        ])
      ).filter(Boolean),
      representatives: Array.from(
        new Set(sales.map(sale => sale.representative))
      ).filter(Boolean),
      supervisors: Array.from(new Set(sales.map(sale => sale.supervisor))).filter(
        Boolean
      ),
      materials: Array.from(
        new Set([
          ...sales.map(sale => sale.material),
          ...warehouseBatches.flatMap(batch =>
            batch.items.map(item => item.material)
          ),
        ])
      ).filter(Boolean),
    }),
    [sales, warehouseBatches, legacyWarehouse]
  );

  const filtered = useMemo(
    () =>
      sales.filter(sale => {
        const needle = query.trim().toLowerCase();
        return (
          (!needle ||
            [
              sale.material,
              sale.company,
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

  const filteredBatches = useMemo(
    () =>
      warehouseBatches
        .filter(batch => {
          const needle = query.trim().toLowerCase();
          return (
            (!filters.governorate ||
              batch.governorate === filters.governorate) &&
            (!needle ||
              [
                batch.governorate,
                batch.saleDate,
                batch.note,
                batch.createdByName || "",
                ...batch.items.flatMap(item => [item.material, item.company]),
              ].some(value => value.toLowerCase().includes(needle)))
          );
        })
        .map(batch => ({
          ...batch,
          items: batch.items.filter(
            item => !filters.material || item.material === filters.material
          ),
        }))
        .filter(batch => batch.items.length),
    [warehouseBatches, query, filters.governorate, filters.material]
  );

  const filteredLegacy = useMemo(
    () =>
      legacyWarehouse.filter(item => {
        const needle = query.trim().toLowerCase();
        return (
          !filters.material &&
          (!filters.governorate || item.governorate === filters.governorate) &&
          (!needle ||
            [item.governorate, item.saleDate, item.note || "", item.createdByName]
              .join(" ")
              .toLowerCase()
              .includes(needle))
        );
      }),
    [legacyWarehouse, query, filters.governorate, filters.material]
  );

  const filteredUnits = filtered.reduce((sum, sale) => sum + sale.quantity, 0);
  const filteredAmount = filtered.reduce(
    (sum, sale) => sum + sale.totalAmount,
    0
  );
  const warehouseUnits =
    filteredBatches.reduce(
      (sum, batch) =>
        sum + batch.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    ) + filteredLegacy.reduce((sum, item) => sum + item.quantity, 0);
  const warehouseAmount =
    filteredBatches.reduce(
      (sum, batch) =>
        sum +
        batch.items.reduce((itemSum, item) => itemSum + item.totalAmount, 0),
      0
    ) +
    filteredLegacy.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const directUnits = Math.max(warehouseUnits - filteredUnits, 0);

  const exportReport = () => {
    if (!filtered.length && !filteredBatches.length && !filteredLegacy.length)
      return onMessage("لا توجد بيانات لتصديرها", "info");
    const rows: Array<Array<string | number>> = [
      ["تقرير مبيعات غدير", periodLabel],
      ["إجمالي خروج المذخر", warehouseUnits, warehouseAmount],
      ["مبيعات المندوبين", filteredUnits, filteredAmount],
      ["صافي البيع المباشر", directUnits],
      [],
      ["مبيعات المندوبين"],
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
      [],
      ["مبيعات المذاخر"],
      [
        "التاريخ",
        "المحافظة",
        "الشركة",
        "المادة",
        "القطع",
        "سعر القطعة",
        "الإجمالي",
        "أنشأها",
        "الملاحظة",
      ],
      ...filteredBatches.flatMap(batch =>
        batch.items.map(item => [
          batch.saleDate,
          batch.governorate,
          item.company,
          item.material,
          item.quantity,
          item.unitPrice,
          item.totalAmount,
          batch.createdByName || "",
          batch.note || "",
        ])
      ),
      ...filteredLegacy.map(item => [
        item.saleDate,
        item.governorate,
        "",
        "إدخال قديم بلا تفاصيل مواد",
        item.quantity,
        "",
        Number(item.amount || 0),
        item.createdByName,
        item.note || "",
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
    link.download = `ghadeer-sales-${periodLabel.replaceAll(" ", "-")}.csv`;
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
          <span className="local-kicker">سجل مفصل · {periodLabel}</span>
          <h2>جميع الإدخالات ({number(filtered.length)})</h2>
          <p>الفترة والفلاتر تغيّر الأرقام والقوائم والتقرير معاً.</p>
        </div>
        <button type="button" className="local-secondary" onClick={exportReport}>
          <Download size={14} /> تصدير التقرير
        </button>
      </div>

      <div className="local-history-summary">
        <div>
          <span>إجمالي المذخر</span>
          <strong>{number(warehouseUnits)} قطعة</strong>
          <small>{money(warehouseAmount)}</small>
        </div>
        <div>
          <span>مبيعات المندوبين</span>
          <strong>{number(filteredUnits)} قطعة</strong>
          <small>{money(filteredAmount)}</small>
        </div>
        <div>
          <span>البيع المباشر</span>
          <strong>{number(directUnits)} قطعة</strong>
        </div>
        <div>
          <span>الإدخالات المطابقة</span>
          <strong>{number(filtered.length)}</strong>
        </div>
      </div>

      <div className="local-history-filters">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="بحث في كل الإدخالات"
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

      <div className="local-section-head compact">
        <div>
          <h2>مبيعات المندوبين</h2>
          <p>{number(filteredUnits)} قطعة ضمن التحديد الحالي.</p>
        </div>
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
                    {sale.representative} · {sale.governorate} · {sale.saleDate} ·{" "}
                    {sale.supervisor}
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
          <div className="local-empty">لا توجد مبيعات مندوبين مطابقة.</div>
        )}
      </div>

      <div className="local-section-head compact">
        <div>
          <h2>مبيعات المذاخر</h2>
          <p>{number(warehouseUnits)} قطعة ضمن التحديد الحالي.</p>
        </div>
      </div>
      <div className="local-list">
        {filteredBatches.map(batch => (
          <article className="local-list-row" key={batch.id}>
            <div>
              <strong>{batch.governorate} · {batch.saleDate}</strong>
              <span>
                {batch.items
                  .map(item => `${item.material} (${number(item.quantity)})`)
                  .join("، ")}
                {batch.createdByName ? ` · سجلها: ${batch.createdByName}` : ""}
              </span>
            </div>
            <b>
              {number(
                batch.items.reduce((sum, item) => sum + item.quantity, 0)
              )}{" "}
              قطعة
            </b>
          </article>
        ))}
        {filteredLegacy.map(item => (
          <article className="local-list-row" key={item.id}>
            <div>
              <strong>{item.governorate} · {item.saleDate}</strong>
              <span>إدخال قديم بلا تفاصيل مواد · سجلها: {item.createdByName}</span>
            </div>
            <b>{number(item.quantity)} قطعة</b>
          </article>
        ))}
        {!filteredBatches.length && !filteredLegacy.length && (
          <div className="local-empty">لا توجد مبيعات مذاخر مطابقة.</div>
        )}
      </div>
    </section>
  );
}