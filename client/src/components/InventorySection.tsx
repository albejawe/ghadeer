import { Save, Search, Package, X, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Stock = {
  materialId: string;
  material: string;
  company: string;
  unitPrice: number;
  governorateId: string;
  governorate: string;
  quantity: number;
  updatedAt?: string;
};

type Governorate = { id: string; name: string };

const fmt = (v: number) => v.toLocaleString("en-US");

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

// Unique key for a (material, governorate) pair
const rowKey = (materialId: string, governorateId: string) =>
  `${materialId}::${governorateId}`;

export function InventorySection({
  showToast,
}: {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [records, setRecords] = useState<Stock[]>([]);
  const [allGovs, setAllGovs] = useState<Governorate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  // Multi-select governorates (empty = all)
  const [selGovs, setSelGovs] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ inventory: Stock[]; governorates: Governorate[] }>("/inventory");
      setRecords(data.inventory);
      setAllGovs(data.governorates);
      // Initialize drafts from fetched quantities
      setDrafts(
        Object.fromEntries(
          data.inventory.map(item => [
            rowKey(item.materialId, item.governorateId),
            String(item.quantity),
          ])
        )
      );
    } catch {
      showToast("تعذر تحميل المخزون", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const companies = useMemo(
    () => Array.from(new Set(records.map(item => item.company))).sort(),
    [records]
  );

  // Toggle a governorate chip
  const toggleGov = (id: string) => {
    setSelGovs(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const clearGovs = () => setSelGovs([]);

  // Filtered records
  const shown = useMemo(() => {
    return records.filter(item => {
      if (selGovs.length && !selGovs.includes(item.governorateId)) return false;
      if (company && item.company !== company) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!`${item.material} ${item.company} ${item.governorate}`.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [records, selGovs, company, search]);

  // Group by governorate
  const grouped = useMemo(() => {
    const map = new Map<string, { govName: string; items: Stock[] }>();
    for (const item of shown) {
      if (!map.has(item.governorateId))
        map.set(item.governorateId, { govName: item.governorate, items: [] });
      map.get(item.governorateId)!.items.push(item);
    }
    return Array.from(map.values());
  }, [shown]);

  const save = async (stock: Stock) => {
    const key = rowKey(stock.materialId, stock.governorateId);
    const quantity = Number(drafts[key]);
    if (!Number.isInteger(quantity) || quantity < 0)
      return showToast("أدخل عدد قطع صحيحاً", "error");
    setSaving(key);
    try {
      await api(`/inventory/${stock.materialId}`, {
        method: "PUT",
        body: JSON.stringify({ quantity, governorateId: stock.governorateId }),
      });
      setRecords(items =>
        items.map(item =>
          item.materialId === stock.materialId && item.governorateId === stock.governorateId
            ? { ...item, quantity }
            : item
        )
      );
      showToast(`✓ تم تحديث ${stock.material} — ${stock.governorate}`);
    } catch {
      showToast("تعذر حفظ المخزون", "error");
    } finally {
      setSaving(null);
    }
  };

  const totalItems = shown.length;
  const totalQuantity = shown.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <section className="local-content">
      {/* Header */}
      <div className="local-section-head">
        <div>
          <span className="local-kicker">المخزون الحالي</span>
          <h2>رصيد المواد حسب المحافظة</h2>
          <p>حدّد الرصيد الفعلي لكل مادة في كل محافظة. المشرف يعدّل محافظته فقط.</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--local-muted)" }}>
            <Package size={14} style={{ verticalAlign: "middle", marginLeft: 4 }} />
            {fmt(totalQuantity)} قطعة · {totalItems} صنف
          </span>
        </div>
      </div>

      {/* Governorate chips */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={clearGovs}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: `1.5px solid ${selGovs.length === 0 ? "var(--local-accent)" : "var(--local-border)"}`,
              background: selGovs.length === 0 ? "var(--local-accent)" : "transparent",
              color: selGovs.length === 0 ? "#fff" : "var(--local-text)",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all .15s",
            }}
          >
            كل المحافظات
          </button>
          {allGovs.map(gov => {
            const active = selGovs.includes(gov.id);
            return (
              <button
                key={gov.id}
                type="button"
                onClick={() => toggleGov(gov.id)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${active ? "var(--local-accent)" : "var(--local-border)"}`,
                  background: active ? "var(--local-accent)" : "transparent",
                  color: active ? "#fff" : "var(--local-text)",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all .15s",
                  position: "relative",
                }}
              >
                {gov.name}
                {active && (
                  <X size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters row */}
      <div className="local-history-filters" style={{ marginBottom: 16 }}>
        <label className="local-search">
          <Search size={15} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم المادة أو المحافظة"
          />
        </label>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowCompanyMenu(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8,
              border: "1.5px solid var(--local-border)",
              background: company ? "var(--local-accent-soft, #e6f4ea)" : "transparent",
              color: "var(--local-text)", fontSize: 13, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {company || "كل الشركات"} <ChevronDown size={13} />
          </button>
          {showCompanyMenu && (
            <div style={{
              position: "absolute", top: "110%", right: 0, zIndex: 50,
              background: "var(--local-card)", border: "1px solid var(--local-border)",
              borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,.12)",
              minWidth: 170, overflow: "hidden",
            }}>
              {["", ...companies].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCompany(c); setShowCompanyMenu(false); }}
                  style={{
                    display: "block", width: "100%", textAlign: "right",
                    padding: "9px 16px", background: company === c ? "var(--local-accent)" : "transparent",
                    color: company === c ? "#fff" : "var(--local-text)",
                    border: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                  }}
                >
                  {c || "كل الشركات"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="local-empty" style={{ padding: 40 }}>جاري التحميل…</div>
      )}

      {/* Grouped by governorate */}
      {!loading && grouped.length === 0 && (
        <div className="local-empty">لا توجد مواد مطابقة.</div>
      )}

      {!loading && grouped.map(({ govName, items }) => (
        <div key={govName} style={{ marginBottom: 28 }}>
          {/* Governorate header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 10, paddingBottom: 6,
            borderBottom: "2px solid var(--local-accent)",
          }}>
            <span style={{
              fontWeight: 700, fontSize: 15, color: "var(--local-accent)",
            }}>
              📍 {govName}
            </span>
            <span style={{ fontSize: 12, color: "var(--local-muted)" }}>
              ({items.length} مادة · {fmt(items.reduce((s, i) => s + i.quantity, 0))} قطعة)
            </span>
          </div>

          <div className="local-list local-stock-list">
            {items.map(stock => {
              const key = rowKey(stock.materialId, stock.governorateId);
              const draft = drafts[key] ?? String(stock.quantity);
              const changed = Number(draft) !== stock.quantity;
              return (
                <article className="local-list-row" key={key}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 14 }}>{stock.material}</strong>
                    <span style={{ fontSize: 12, color: "var(--local-muted)", display: "block", marginTop: 2 }}>
                      {stock.company} · سعر القطعة {fmt(stock.unitPrice)} د.ع
                    </span>
                  </div>
                  <div className="local-stock-actions">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft}
                      onChange={e =>
                        setDrafts(prev => ({ ...prev, [key]: e.target.value }))
                      }
                      aria-label={`رصيد ${stock.material} في ${govName}`}
                      style={{
                        borderColor: changed ? "var(--local-accent)" : undefined,
                      }}
                    />
                    <span>قطعة</span>
                    <button
                      type="button"
                      className="local-secondary"
                      disabled={saving === key || !changed}
                      onClick={() => void save(stock)}
                      style={{
                        opacity: !changed ? 0.45 : 1,
                        background: changed ? "var(--local-accent)" : undefined,
                        color: changed ? "#fff" : undefined,
                        borderColor: changed ? "var(--local-accent)" : undefined,
                      }}
                    >
                      <Save size={14} />
                      {saving === key ? "…" : "حفظ"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
