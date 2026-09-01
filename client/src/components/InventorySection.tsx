import { Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Stock = {
  materialId: string;
  material: string;
  company: string;
  unitPrice: number;
  quantity: number;
  updatedAt?: string;
};
const number = (value: number) => value.toLocaleString("en-US");

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/local${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ العملية");
  return payload;
}

export function InventorySection({
  showToast,
}: {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [records, setRecords] = useState<Stock[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const load = async () => {
    try {
      const next = (await api<{ inventory: Stock[] }>("/inventory")).inventory;
      setRecords(next);
      setDrafts(
        Object.fromEntries(
          next.map(item => [item.materialId, String(item.quantity)])
        )
      );
    } catch {
      showToast("تعذر تحميل المخزون", "error");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const companies = useMemo(
    () => Array.from(new Set(records.map(item => item.company))),
    [records]
  );
  const shown = useMemo(
    () =>
      records.filter(
        item =>
          (!company || item.company === company) &&
          (!search.trim() ||
            `${item.material} ${item.company}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()))
      ),
    [records, company, search]
  );
  const save = async (stock: Stock) => {
    const quantity = Number(drafts[stock.materialId]);
    if (!Number.isInteger(quantity) || quantity < 0)
      return showToast("أدخل عدد قطع صحيحاً", "error");
    setSaving(stock.materialId);
    try {
      await api(`/inventory/${stock.materialId}`, {
        method: "PUT",
        body: JSON.stringify({ quantity }),
      });
      setRecords(items =>
        items.map(item =>
          item.materialId === stock.materialId ? { ...item, quantity } : item
        )
      );
      showToast(`تم تحديث مخزون ${stock.material}`);
    } catch {
      showToast("تعذر حفظ المخزون", "error");
    } finally {
      setSaving(null);
    }
  };
  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">المخزون الحالي</span>
          <h2>رصيد المواد</h2>
          <p>
            حدد الرصيد الفعلي لكل مادة. هذا الرصيد يدوي ويمكن تعديله في أي وقت.
          </p>
        </div>
      </div>
      <div className="local-history-filters">
        <label className="local-search">
          <Search size={15} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="بحث باسم المادة"
          />
        </label>
        <select
          value={company}
          onChange={event => setCompany(event.target.value)}
        >
          <option value="">كل الشركات</option>
          {companies.map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="local-list local-stock-list">
        {shown.map(stock => (
          <article className="local-list-row" key={stock.materialId}>
            <div>
              <strong>{stock.material}</strong>
              <span>
                {stock.company} · سعر القطعة {number(stock.unitPrice)} د.ع
              </span>
            </div>
            <div className="local-stock-actions">
              <input
                type="number"
                min="0"
                step="1"
                value={drafts[stock.materialId] ?? ""}
                onChange={event =>
                  setDrafts({
                    ...drafts,
                    [stock.materialId]: event.target.value,
                  })
                }
                aria-label={`رصيد ${stock.material}`}
              />
              <span>قطعة</span>
              <button
                type="button"
                className="local-secondary"
                disabled={saving === stock.materialId}
                onClick={() => void save(stock)}
              >
                <Save size={15} /> حفظ
              </button>
            </div>
          </article>
        ))}
        {!shown.length && (
          <div className="local-empty">لا توجد مواد مطابقة.</div>
        )}
      </div>
    </section>
  );
}
