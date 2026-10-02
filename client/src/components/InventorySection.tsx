import { Save, Search, Package, ChevronDown, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

const rowKey = (materialId: string, governorateId: string) =>
  `${materialId}::${governorateId}`;

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({
  material,
  governorate,
  oldQty,
  newQty,
  onConfirm,
  onCancel,
  saving,
}: {
  material: string;
  governorate: string;
  oldQty: number;
  newQty: number;
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: "var(--local-card, #fff)",
        borderRadius: 16,
        padding: "28px 32px",
        maxWidth: 400, width: "90%",
        boxShadow: "0 12px 40px rgba(0,0,0,.2)",
        textAlign: "center",
        direction: "rtl",
      }}>
        <div style={{ marginBottom: 14 }}>
          <AlertTriangle size={36} color="#f59e0b" style={{ marginBottom: 8 }} />
          <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700 }}>تأكيد حفظ المخزون</h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--local-muted, #666)", lineHeight: 1.6 }}>
            <strong>{material}</strong><br />
            📍 {governorate}<br /><br />
            الكمية الحالية: <strong style={{ color: "var(--local-muted)" }}>{fmt(oldQty)} قطعة</strong><br />
            الكمية الجديدة: <strong style={{ color: "var(--local-accent, #16a34a)", fontSize: 16 }}>{fmt(newQty)} قطعة</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              border: "1.5px solid var(--local-border, #d1d5db)",
              background: "transparent", color: "var(--local-text, #111)",
              fontSize: 14, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              border: "none",
              background: "var(--local-accent, #16a34a)", color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "جاري الحفظ…" : "✓ تأكيد الحفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  // "" = كل المحافظات (read-only mode), govId = محافظة محددة (edit mode)
  const [selectedGov, setSelectedGov] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGovMenu, setShowGovMenu] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  // Confirm dialog state
  const [confirmStock, setConfirmStock] = useState<Stock | null>(null);
  const govMenuRef = useRef<HTMLDivElement>(null);
  const companyMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (govMenuRef.current && !govMenuRef.current.contains(e.target as Node))
        setShowGovMenu(false);
      if (companyMenuRef.current && !companyMenuRef.current.contains(e.target as Node))
        setShowCompanyMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ inventory: Stock[]; governorates: Governorate[] }>("/inventory");
      setRecords(data.inventory);
      setAllGovs(data.governorates);
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

  // editMode = a specific governorate is selected
  const editMode = selectedGov !== "";
  const selectedGovName = allGovs.find(g => g.id === selectedGov)?.name ?? "";

  // Filtered records
  const shown = useMemo(() => {
    return records.filter(item => {
      if (selectedGov && item.governorateId !== selectedGov) return false;
      if (company && item.company !== company) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!`${item.material} ${item.company} ${item.governorate}`.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [records, selectedGov, company, search]);

  // Group by governorate
  const grouped = useMemo(() => {
    const map = new Map<string, { govName: string; govId: string; items: Stock[] }>();
    for (const item of shown) {
      if (!map.has(item.governorateId))
        map.set(item.governorateId, { govName: item.governorate, govId: item.governorateId, items: [] });
      map.get(item.governorateId)!.items.push(item);
    }
    return Array.from(map.values());
  }, [shown]);

  const doSave = async (stock: Stock) => {
    const key = rowKey(stock.materialId, stock.governorateId);
    const quantity = Number(drafts[key]);
    if (!Number.isInteger(quantity) || quantity < 0) {
      showToast("أدخل عدد قطع صحيحاً", "error");
      return;
    }
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
      setConfirmStock(null);
    }
  };

  const handleSaveClick = (stock: Stock) => {
    const key = rowKey(stock.materialId, stock.governorateId);
    const quantity = Number(drafts[key]);
    if (!Number.isInteger(quantity) || quantity < 0)
      return showToast("أدخل عدد قطع صحيحاً", "error");
    setConfirmStock(stock);
  };

  const totalItems = shown.length;
  const totalQuantity = shown.reduce((sum, s) => sum + s.quantity, 0);

  const dropdownBtnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 14px", borderRadius: 8,
    border: `1.5px solid ${active ? "var(--local-accent, #16a34a)" : "var(--local-border, #d1d5db)"}`,
    background: active ? "var(--local-accent, #16a34a)" : "transparent",
    color: active ? "#fff" : "var(--local-text, #111)",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
    fontWeight: active ? 600 : 400,
    transition: "all .15s",
    minWidth: 130, justifyContent: "space-between",
  });

  const menuStyle: React.CSSProperties = {
    position: "absolute", top: "110%", right: 0, zIndex: 200,
    background: "var(--local-card, #fff)",
    border: "1px solid var(--local-border, #d1d5db)",
    borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,.14)",
    minWidth: 180, overflow: "hidden",
  };

  const menuItemStyle = (active: boolean): React.CSSProperties => ({
    display: "block", width: "100%", textAlign: "right",
    padding: "10px 16px",
    background: active ? "var(--local-accent, #16a34a)" : "transparent",
    color: active ? "#fff" : "var(--local-text, #111)",
    border: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
    transition: "background .1s",
  });

  return (
    <section className="local-content">
      {/* Confirm dialog */}
      {confirmStock && (
        <ConfirmDialog
          material={confirmStock.material}
          governorate={confirmStock.governorate}
          oldQty={confirmStock.quantity}
          newQty={Number(drafts[rowKey(confirmStock.materialId, confirmStock.governorateId)]) || 0}
          saving={saving === rowKey(confirmStock.materialId, confirmStock.governorateId)}
          onConfirm={() => void doSave(confirmStock)}
          onCancel={() => setConfirmStock(null)}
        />
      )}

      {/* Header */}
      <div className="local-section-head">
        <div>
          <span className="local-kicker">المخزون الحالي</span>
          <h2>رصيد المواد حسب المحافظة</h2>
          <p>
            اختر محافظة من القائمة للتعديل. عند اختيار "كل المحافظات" يكون العرض فقط بدون تعديل.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--local-muted, #666)" }}>
            <Package size={14} style={{ verticalAlign: "middle", marginLeft: 4 }} />
            {fmt(totalQuantity)} قطعة · {totalItems} صنف
          </span>
        </div>
      </div>

      {/* Edit mode notice */}
      {!editMode && (
        <div style={{
          background: "rgba(245, 158, 11, 0.1)",
          border: "1.5px solid #f59e0b",
          borderRadius: 10, padding: "10px 16px",
          marginBottom: 14, fontSize: 13,
          color: "#92400e", display: "flex", alignItems: "center", gap: 8,
          direction: "rtl",
        }}>
          <AlertTriangle size={15} color="#f59e0b" />
          وضع العرض فقط — اختر محافظة محددة لتفعيل التعديل
        </div>
      )}

      {/* Filters row */}
      <div className="local-history-filters" style={{ marginBottom: 18, gap: 10 }}>
        {/* Search */}
        <label className="local-search">
          <Search size={15} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم المادة"
          />
        </label>

        {/* Governorate dropdown */}
        <div ref={govMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowGovMenu(v => !v)}
            style={dropdownBtnStyle(editMode)}
          >
            <span>{editMode ? selectedGovName : "كل المحافظات"}</span>
            <ChevronDown size={13} />
          </button>
          {showGovMenu && (
            <div style={menuStyle}>
              <button
                type="button"
                onClick={() => { setSelectedGov(""); setShowGovMenu(false); }}
                style={menuItemStyle(!editMode)}
              >
                كل المحافظات
              </button>
              {allGovs.map(gov => (
                <button
                  key={gov.id}
                  type="button"
                  onClick={() => { setSelectedGov(gov.id); setShowGovMenu(false); }}
                  style={menuItemStyle(selectedGov === gov.id)}
                >
                  {gov.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Company dropdown */}
        <div ref={companyMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowCompanyMenu(v => !v)}
            style={dropdownBtnStyle(!!company)}
          >
            <span>{company || "كل الشركات"}</span>
            <ChevronDown size={13} />
          </button>
          {showCompanyMenu && (
            <div style={menuStyle}>
              <button
                type="button"
                onClick={() => { setCompany(""); setShowCompanyMenu(false); }}
                style={menuItemStyle(!company)}
              >
                كل الشركات
              </button>
              {companies.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCompany(c); setShowCompanyMenu(false); }}
                  style={menuItemStyle(company === c)}
                >
                  {c}
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

      {/* Empty */}
      {!loading && grouped.length === 0 && (
        <div className="local-empty">لا توجد مواد مطابقة.</div>
      )}

      {/* Records grouped by governorate */}
      {!loading && grouped.map(({ govName, govId, items }) => (
        <div key={govId} style={{ marginBottom: 28 }}>
          {/* Group header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 10, paddingBottom: 6,
            borderBottom: "2px solid var(--local-accent, #16a34a)",
          }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--local-accent, #16a34a)" }}>
              📍 {govName}
            </span>
            <span style={{ fontSize: 12, color: "var(--local-muted, #666)" }}>
              ({items.length} مادة · {fmt(items.reduce((s, i) => s + i.quantity, 0))} قطعة)
            </span>
            {!editMode && (
              <span style={{
                marginRight: "auto", fontSize: 11,
                background: "rgba(245,158,11,.15)", color: "#92400e",
                padding: "2px 8px", borderRadius: 20,
              }}>
                عرض فقط
              </span>
            )}
          </div>

          <div className="local-list local-stock-list">
            {items.map(stock => {
              const key = rowKey(stock.materialId, stock.governorateId);
              const draft = drafts[key] ?? String(stock.quantity);
              const changed = Number(draft) !== stock.quantity;
              const isSaving = saving === key;

              return (
                <article className="local-list-row" key={key}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 14 }}>{stock.material}</strong>
                    <span style={{
                      fontSize: 12, color: "var(--local-muted, #666)",
                      display: "block", marginTop: 2,
                    }}>
                      {stock.company} · سعر القطعة {fmt(stock.unitPrice)} د.ع
                    </span>
                  </div>

                  <div className="local-stock-actions">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft}
                      disabled={!editMode}
                      onChange={e =>
                        setDrafts(prev => ({ ...prev, [key]: e.target.value }))
                      }
                      aria-label={`رصيد ${stock.material} في ${govName}`}
                      style={{
                        borderColor: editMode && changed ? "var(--local-accent, #16a34a)" : undefined,
                        opacity: !editMode ? 0.6 : 1,
                        cursor: !editMode ? "not-allowed" : "auto",
                      }}
                    />
                    <span>قطعة</span>

                    {/* Save button — always visible, disabled when not in edit mode or no change */}
                    <button
                      type="button"
                      className="local-secondary"
                      disabled={!editMode || !changed || isSaving}
                      onClick={() => handleSaveClick(stock)}
                      title={!editMode ? "اختر محافظة محددة للتعديل" : changed ? "حفظ التغييرات" : "لا يوجد تغيير"}
                      style={{
                        background: editMode && changed ? "var(--local-accent, #16a34a)" : undefined,
                        color: editMode && changed ? "#fff" : undefined,
                        borderColor: editMode && changed ? "var(--local-accent, #16a34a)" : undefined,
                        opacity: (!editMode || !changed) ? 0.4 : 1,
                        cursor: (!editMode || !changed) ? "not-allowed" : "pointer",
                        transition: "all .15s",
                      }}
                    >
                      <Save size={14} />
                      {isSaving ? "…" : "حفظ"}
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
