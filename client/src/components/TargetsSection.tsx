import { useEffect, useMemo, useState } from "react";
import {
  Target,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Package,
  Layers,
  ChevronDown,
  X,
} from "lucide-react";

export type TargetMaterialItem = {
  materialId: string;
  material: string;
  company: string;
  unitPrice: number;
  targetQuantity: number;
};

export type TargetRecord = {
  id: string;
  governorateId: string;
  governorate: string;
  year: number;
  month: number;
  targetQuantity: number;
  targetAmount: number | null;
  items?: TargetMaterialItem[];
};

type Company = { id: string; name: string };
type Material = {
  id: string;
  name: string;
  unitPrice: number;
  companyId: string;
  company: string;
};
type Governorate = { id: string; name: string };

type Reference = {
  governorates: Governorate[];
  companies: Company[];
  materials: Material[];
};

type WarehouseSale = {
  id: string;
  governorateId: string;
  governorate: string;
  saleDate: string;
  year: number;
  month: number;
  quantity: number;
  amount: number | null;
};

type WarehouseBatch = {
  id: string;
  governorateId: string;
  governorate: string;
  saleDate: string;
  year: number;
  month: number;
  totalQuantity: number;
  totalAmount: number;
  items: {
    materialId: string;
    material: string;
    company: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }[];
};

const fmt = (v: number) => v.toLocaleString("en-US");
const fmtMoney = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

export function TargetsSection({
  reference,
  records,
  setTargets,
  warehouse,
  warehouseBatches,
  showToast,
  reload,
}: {
  reference: Reference;
  records: TargetRecord[];
  setTargets: React.Dispatch<React.SetStateAction<TargetRecord[]>>;
  warehouse: WarehouseSale[];
  warehouseBatches: WarehouseBatch[];
  showToast: (text: string, type?: "success" | "error" | "info") => void;
  reload: (silent?: boolean) => void;
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [savingGov, setSavingGov] = useState<string | null>(null);

  // Local state for material items per governorate: { [govId]: [{ materialId, targetQuantity }] }
  const [govItems, setGovItems] = useState<
    Record<string, Array<{ materialId: string; targetQuantity: number | string }>>
  >(() => {
    const initialMap: Record<
      string,
      Array<{ materialId: string; targetQuantity: number | string }>
    > = {};
    for (const t of records || []) {
      if (t.items && t.items.length > 0) {
        initialMap[t.governorateId] = t.items.map(i => ({
          materialId: i.materialId,
          targetQuantity: i.targetQuantity,
        }));
      }
    }
    return initialMap;
  });

  // Sync from records prop when it changes
  useEffect(() => {
    if (records && records.length > 0) {
      setGovItems(prev => {
        const next = { ...prev };
        let hasChanges = false;
        for (const t of records) {
          if (t.items && t.items.length > 0 && !next[t.governorateId]?.length) {
            next[t.governorateId] = t.items.map(i => ({
              materialId: i.materialId,
              targetQuantity: i.targetQuantity,
            }));
            hasChanges = true;
          }
        }
        return hasChanges ? next : prev;
      });
    }
  }, [records]);

  // Which governorate currently has the "Add Material" dropdown open
  const [openAddDropdown, setOpenAddDropdown] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState("");

  const periodPrefix = `${year}-${String(month).padStart(2, "0")}`;

  // Map materials for instant lookup
  const materialMap = useMemo(() => {
    return new Map(reference.materials.map(m => [m.id, m]));
  }, [reference.materials]);

  // Fetch targets when year or month changes
  useEffect(() => {
    let isMounted = true;
    async function fetchPeriodTargets() {
      if (!year || !month) return;
      setLoadingMonth(true);
      try {
        const res = await api<{ targets: TargetRecord[] }>(
          `/targets?year=${year}&month=${month}`
        );
        if (isMounted && res?.targets) {
          setTargets(res.targets);
          // Initialize local items state from fetched targets
          const initialMap: Record<
            string,
            Array<{ materialId: string; targetQuantity: number | string }>
          > = {};
          for (const t of res.targets) {
            if (t.items && t.items.length > 0) {
              initialMap[t.governorateId] = t.items.map(i => ({
                materialId: i.materialId,
                targetQuantity: i.targetQuantity,
              }));
            }
          }
          setGovItems(initialMap);
        }
      } catch {
        // Fallback silently
      } finally {
        if (isMounted) setLoadingMonth(false);
      }
    }
    void fetchPeriodTargets();
    return () => {
      isMounted = false;
    };
  }, [year, month, setTargets]);

  // Calculate actual sold units for a specific material in a governorate
  const getMaterialAchieved = (govId: string, matId: string): number => {
    return warehouseBatches
      .filter(b => b.governorateId === govId && b.saleDate.startsWith(periodPrefix))
      .reduce((sum, b) => {
        const item = b.items.find(i => i.materialId === matId);
        return sum + (item ? item.quantity : 0);
      }, 0);
  };

  // Add a material to a governorate's target list
  const handleAddMaterial = (govId: string, materialId: string) => {
    setGovItems(prev => {
      const current = prev[govId] || [];
      if (current.some(i => i.materialId === materialId)) return prev;
      return {
        ...prev,
        [govId]: [...current, { materialId, targetQuantity: 10 }],
      };
    });
    setOpenAddDropdown(null);
    setAddSearch("");
  };

  // Update target quantity for a material
  const handleQuantityChange = (
    govId: string,
    materialId: string,
    value: string
  ) => {
    setGovItems(prev => {
      const current = prev[govId] || [];
      return {
        ...prev,
        [govId]: current.map(item =>
          item.materialId === materialId ? { ...item, targetQuantity: value } : item
        ),
      };
    });
  };

  // Remove a material from a governorate
  const handleRemoveMaterial = (govId: string, materialId: string) => {
    setGovItems(prev => {
      const current = prev[govId] || [];
      return {
        ...prev,
        [govId]: current.filter(item => item.materialId !== materialId),
      };
    });
  };

  // Save targets for a single governorate
  const handleSaveGovernorate = async (govId: string) => {
    const govObj = reference.governorates.find(g => g.id === govId);
    const items = govItems[govId] || [];

    // Filter valid positive items
    const validItems = items
      .map(i => ({
        materialId: i.materialId,
        targetQuantity: Math.max(0, Math.floor(Number(i.targetQuantity) || 0)),
      }))
      .filter(i => i.targetQuantity > 0);

    setSavingGov(govId);
    try {
      await api("/targets", {
        method: "PUT",
        body: JSON.stringify({
          governorateId: govId,
          year: Number(year),
          month: Number(month),
          items: validItems,
        }),
      });

      // Refresh targets from server
      const refreshed = await api<{ targets: TargetRecord[] }>(
        `/targets?year=${year}&month=${month}`
      );
      if (refreshed?.targets) {
        setTargets(refreshed.targets);
        setGovItems(prev => {
          const next = { ...prev };
          for (const t of refreshed.targets) {
            if (t.items) {
              next[t.governorateId] = t.items.map(i => ({
                materialId: i.materialId,
                targetQuantity: i.targetQuantity,
              }));
            }
          }
          return next;
        });
      }
      showToast(`✓ تم حفظ خطة ${govObj?.name || ""} بنجاح`, "success");
      reload(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذر حفظ الخطة", "error");
    } finally {
      setSavingGov(null);
    }
  };

  // Global KPIs for the month
  const overallKPIs = useMemo(() => {
    let plannedGovs = 0;
    let totalTargetUnits = 0;
    let totalTargetAmount = 0;
    let totalAchievedUnits = 0;

    for (const gov of reference.governorates) {
      const items = govItems[gov.id] || [];
      if (items.length > 0) {
        plannedGovs++;
        for (const item of items) {
          const qty = Number(item.targetQuantity) || 0;
          const mat = materialMap.get(item.materialId);
          const price = mat?.unitPrice || 0;
          totalTargetUnits += qty;
          totalTargetAmount += qty * price;
          totalAchievedUnits += getMaterialAchieved(gov.id, item.materialId);
        }
      }
    }

    const percentage =
      totalTargetUnits > 0
        ? Math.round((totalAchievedUnits / totalTargetUnits) * 100)
        : 0;

    return {
      plannedGovs,
      totalTargetUnits,
      totalTargetAmount,
      totalAchievedUnits,
      percentage,
    };
  }, [reference.governorates, govItems, materialMap, warehouseBatches, periodPrefix]);

  return (
    <section className="local-content">
      {/* SECTION HEADER */}
      <div className="local-section-head" style={{ marginBottom: 20 }}>
        <div>
          <span className="local-kicker">خطة الشهر ومتابعة الإنجاز</span>
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
            <Target size={24} color="#059669" />
            أهداف المحافظات حسب المواد (التارغت)
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            حدّد المواد والكميات المستهدفة لكل محافظة على حدة. يتم احتساب المبالغ ونسب الإنجاز تلقائياً.
          </p>
        </div>
      </div>

      {/* PERIOD PICKER & OVERALL KPI BAR */}
      <div className="local-targets-header-card">
        {/* Month selector */}
        <div className="local-targets-month-picker">
          <label className="local-targets-month-label">
            📅 شهر الخطة:
          </label>
          <div className="local-targets-month-inputs">
            <input
              type="month"
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={e => {
                const [y, m] = e.target.value.split("-");
                if (y && m) {
                  setYear(y);
                  setMonth(String(Number(m)));
                }
              }}
              className="local-targets-month-input"
            />
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setYear(String(now.getFullYear()));
                setMonth(String(now.getMonth() + 1));
              }}
              className="local-targets-current-month-btn"
            >
              الشهر الحالي
            </button>
          </div>
        </div>

        {/* Global KPI stats */}
        <div className="local-targets-kpi-grid">
          <div className="local-targets-kpi-item">
            <span className="local-targets-kpi-label">المحافظات المخططة</span>
            <strong className="local-targets-kpi-val" style={{ color: "#0f172a" }}>
              {overallKPIs.plannedGovs} / {reference.governorates.length}
            </strong>
          </div>
          <div className="local-targets-kpi-item">
            <span className="local-targets-kpi-label">إجمالي المستهدف</span>
            <strong className="local-targets-kpi-val" style={{ color: "#059669" }}>
              {fmt(overallKPIs.totalTargetUnits)} قطعة
            </strong>
          </div>
          <div className="local-targets-kpi-item">
            <span className="local-targets-kpi-label">القيمة التقديرية</span>
            <strong className="local-targets-kpi-val" style={{ color: "#0284c7" }}>
              {fmtMoney(overallKPIs.totalTargetAmount)} د.ع
            </strong>
          </div>
          <div className="local-targets-kpi-item">
            <span className="local-targets-kpi-label">الإنجاز العام</span>
            <strong
              className="local-targets-kpi-val"
              style={{
                color:
                  overallKPIs.percentage >= 100
                    ? "#16a34a"
                    : overallKPIs.percentage >= 65
                    ? "#d97706"
                    : "#64748b",
              }}
            >
              {overallKPIs.percentage}% ({fmt(overallKPIs.totalAchievedUnits)} قطعة)
            </strong>
          </div>
        </div>
      </div>

      {loadingMonth && (
        <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
          جاري تحميل بيانات الأهداف للشهر المحدد…
        </div>
      )}

      {/* GOVERNORATE CARDS GRID */}
      {!loadingMonth && (
        <div className="local-target-cards-grid">
          {reference.governorates.map(gov => {
            const items = govItems[gov.id] || [];
            const isSaving = savingGov === gov.id;

            // Compute totals for this governorate card
            let govTargetQty = 0;
            let govTargetAmt = 0;
            let govAchievedQty = 0;

            for (const it of items) {
              const qty = Number(it.targetQuantity) || 0;
              const mat = materialMap.get(it.materialId);
              const price = mat?.unitPrice || 0;
              govTargetQty += qty;
              govTargetAmt += qty * price;
              govAchievedQty += getMaterialAchieved(gov.id, it.materialId);
            }

            const percentage =
              govTargetQty > 0
                ? Math.min(Math.round((govAchievedQty / govTargetQty) * 100), 100)
                : 0;

            const badgeBg =
              govTargetQty === 0
                ? "#f1f5f9"
                : percentage >= 100
                ? "#dcfce7"
                : percentage >= 65
                ? "#fef3c7"
                : "#e0f2fe";

            const badgeColor =
              govTargetQty === 0
                ? "#64748b"
                : percentage >= 100
                ? "#15803d"
                : percentage >= 65
                ? "#b45309"
                : "#0369a1";

            const badgeText =
              govTargetQty === 0
                ? "لم تحدد مواد"
                : percentage >= 100
                ? "✓ محقق بالكامل"
                : percentage >= 65
                ? `قريب (${percentage}%)`
                : `قيد الإنجاز (${percentage}%)`;

            // Available materials not yet added to this governorate
            const availableMaterials = reference.materials.filter(
              m => !items.some(i => i.materialId === m.id)
            );

            // Filtered available materials for search
            const filteredMaterials = availableMaterials.filter(m =>
              !addSearch.trim() ||
              `${m.name} ${m.company}`.toLowerCase().includes(addSearch.trim().toLowerCase())
            );

            // Group available materials by company
            const groupedByCompany = Array.from(
              new Set(filteredMaterials.map(m => m.company))
            ).map(comp => ({
              company: comp,
              materials: filteredMaterials.filter(m => m.company === comp),
            }));

            return (
              <div
                key={gov.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
                  position: "relative",
                }}
              >
                {/* CARD HEADER */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    paddingBottom: 12,
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>📍</span>
                      {gov.name}
                    </h3>
                    <span style={{ fontSize: 12, color: "#64748b", marginTop: 2, display: "block" }}>
                      {items.length === 0
                        ? "لا توجد مواد مضافة"
                        : `${items.length} مواد مستهدفة`}
                    </span>
                  </div>

                  <span
                    style={{
                      background: badgeBg,
                      color: badgeColor,
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badgeText}
                  </span>
                </div>

                {/* PROGRESS & SUMMARY BAR */}
                {govTargetQty > 0 && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      borderRadius: 10,
                      padding: "10px 14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 6,
                        color: "#334155",
                      }}
                    >
                      <span>
                        المتحقق: <strong style={{ color: "#0f172a" }}>{fmt(govAchievedQty)}</strong> /
                        المستهدف: <strong style={{ color: "#059669" }}>{fmt(govTargetQty)}</strong> قطعة
                      </span>
                      <span style={{ fontWeight: 700, color: badgeColor }}>
                        {percentage}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: 7,
                        background: "#e2e8f0",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: "100%",
                          background:
                            percentage >= 100
                              ? "linear-gradient(90deg, #10b981, #059669)"
                              : percentage >= 65
                              ? "linear-gradient(90deg, #f59e0b, #d97706)"
                              : "linear-gradient(90deg, #38bdf8, #0284c7)",
                          borderRadius: 999,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 8,
                        fontSize: 11,
                        color: "#64748b",
                      }}
                    >
                      <span>💰 القيمة الإجمالية التقديرية:</span>
                      <strong style={{ color: "#0284c7", fontSize: 12 }}>
                        {fmtMoney(govTargetAmt)} د.ع
                      </strong>
                    </div>
                  </div>
                )}

                {/* MATERIALS LIST / TABLE */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                      المواد وعدد القطع المستهدفة:
                    </span>
                    {items.length > 0 && (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {items.length} مادة
                      </span>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <div
                      style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        borderRadius: 10,
                        background: "#f8fafc",
                        border: "1px dashed #cbd5e1",
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      لم يتم تحديد مواد مستهدفة لهذه المحافظة بعد.
                      <br />
                      اضغط على زر <strong>إضافة مادة</strong> أدناه للبدء.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        maxHeight: 280,
                        overflowY: "auto",
                        paddingLeft: 2,
                      }}
                    >
                      {items.map(it => {
                        const mat = materialMap.get(it.materialId);
                        const matName = mat?.name || it.materialId;
                        const company = mat?.company || "";
                        const price = mat?.unitPrice || 0;
                        const qtyNum = Number(it.targetQuantity) || 0;
                        const itemAmt = qtyNum * price;
                        const itemAchieved = getMaterialAchieved(gov.id, it.materialId);
                        const itemPercent =
                          qtyNum > 0
                            ? Math.min(Math.round((itemAchieved / qtyNum) * 100), 100)
                            : 0;

                        return (
                          <div
                            key={it.materialId}
                            className="local-target-mat-card"
                          >
                            {/* Material & Trash button */}
                            <div className="local-target-mat-head">
                              <div
                                className="local-target-mat-name"
                                title={matName}
                              >
                                {matName}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial(gov.id, it.materialId)}
                                title="إزالة المادة من الخطة"
                                className="local-target-mat-trash"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            {/* Meta info: company, price, sold */}
                            <div className="local-target-mat-meta">
                              {company && (
                                <span className="local-target-mat-badge">
                                  {company}
                                </span>
                              )}
                              <span>{fmtMoney(price)} د.ع</span>
                              <span>· بيع: <b>{fmt(itemAchieved)}</b></span>
                            </div>

                            {/* Quantity input & total amount */}
                            <div className="local-target-mat-actions">
                              <div className="local-target-mat-input-group">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={it.targetQuantity}
                                  onChange={e =>
                                    handleQuantityChange(gov.id, it.materialId, e.target.value)
                                  }
                                  className="local-target-mat-qty-input"
                                  placeholder="الكمية"
                                />
                                <span>قطعة</span>
                              </div>

                              <div className="local-target-mat-total">
                                {fmtMoney(itemAmt)} د.ع
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ADD MATERIAL DROPDOWN */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenAddDropdown(openAddDropdown === gov.id ? null : gov.id);
                      setAddSearch("");
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1.5px dashed #cbd5e1",
                      background: openAddDropdown === gov.id ? "#f1f5f9" : "transparent",
                      color: "#0f766e",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontFamily: "inherit",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Plus size={15} />
                    إضافة مادة للهدف
                    <ChevronDown size={13} />
                  </button>

                  {/* Dropdown Menu */}
                  {openAddDropdown === gov.id && (
                    <div
                      style={{
                        position: "absolute",
                        top: "105%",
                        right: 0,
                        left: 0,
                        zIndex: 40,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        maxHeight: 280,
                        overflowY: "auto",
                        padding: 6,
                      }}
                    >
                      {/* Search box inside dropdown */}
                      <div style={{ padding: "4px 4px 8px" }}>
                        <input
                          type="text"
                          placeholder="ابحث باسم المادة..."
                          value={addSearch}
                          onChange={e => setAddSearch(e.target.value)}
                          autoFocus
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            fontFamily: "inherit",
                            outline: "none",
                            background: "#f8fafc",
                          }}
                        />
                      </div>

                      {availableMaterials.length === 0 ? (
                        <div style={{ padding: 12, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                          تمت إضافة كل المواد المتاحة لهذه المحافظة!
                        </div>
                      ) : filteredMaterials.length === 0 ? (
                        <div style={{ padding: 12, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                          لا توجد مواد مطابقة للبحث
                        </div>
                      ) : (
                        groupedByCompany.map(group => (
                          <div key={group.company} style={{ marginBottom: 6 }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#64748b",
                                padding: "4px 8px",
                                background: "#f1f5f9",
                                borderRadius: 4,
                                marginBottom: 2,
                              }}
                            >
                              {group.company}
                            </div>
                            {group.materials.map(mat => (
                              <button
                                key={mat.id}
                                type="button"
                                onClick={() => handleAddMaterial(gov.id, mat.id)}
                                style={{
                                  width: "100%",
                                  textAlign: "right",
                                  padding: "7px 10px",
                                  border: "none",
                                  background: "transparent",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontFamily: "inherit",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  transition: "background 0.1s",
                                }}
                                onMouseEnter={e => {
                                  (e.currentTarget as HTMLElement).style.background = "#ecfdf5";
                                }}
                                onMouseLeave={e => {
                                  (e.currentTarget as HTMLElement).style.background = "transparent";
                                }}
                              >
                                <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                  {mat.name}
                                </span>
                                <span style={{ fontSize: 11, color: "#059669" }}>
                                  {fmtMoney(mat.unitPrice)} د.ع
                                </span>
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* SAVE BUTTON */}
                <button
                  type="button"
                  disabled={isSaving || loadingMonth}
                  onClick={() => void handleSaveGovernorate(gov.id)}
                  style={{
                    marginTop: "auto",
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isSaving ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontFamily: "inherit",
                    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                    opacity: isSaving ? 0.7 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  <Save size={15} />
                  {isSaving ? "جاري الحفظ..." : `حفظ خطة ${gov.name}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
