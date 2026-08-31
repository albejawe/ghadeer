import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  Layers,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import "./delegates.css";

// =========================================================================
// TYPES
// =========================================================================

type User = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "supervisor";
  governorateId: string | null;
  active: boolean;
};

type Governorate = { id: string; name: string };
type Company = { id: string; name: string };
type Material = {
  id: string;
  name: string;
  unitPrice: number;
  companyId: string;
  company: string;
};
type Representative = { id: string; name: string; governorateId: string };
type Sale = {
  id: string;
  saleDate: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  supervisor: string;
  representative: string;
  governorateId: string;
  governorate: string;
  companyId: string;
  company: string;
  materialId: string;
  material: string;
};
type WarehouseSale = {
  id: string;
  governorateId: string;
  governorate: string;
  year: number;
  month: number;
  quantity: number;
  amount: number | null;
  createdByName: string;
};
type TargetRecord = {
  id: string;
  governorateId: string;
  governorate: string;
  year: number;
  month: number;
  targetQuantity: number;
  targetAmount: number | null;
};
type Reference = {
  user: User;
  governorates: Governorate[];
  companies: Company[];
  materials: Material[];
  representatives: Representative[];
};

type ToastMessage = {
  id: string;
  text: string;
  type: "success" | "error" | "info";
};

// =========================================================================
// API & HELPERS
// =========================================================================

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/local${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload.error || "تعذر تنفيذ الطلب"));
  return payload as T;
}

const number = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("ar-IQ");
const money = (value: number | string | null | undefined) =>
  `${number(value)} د.ع`;
const today = new Date().toISOString().slice(0, 10);

// =========================================================================
// UI COMPONENTS (Combobox, Toast, Presets)
// =========================================================================

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="local-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`local-toast ${toast.type}`}>
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              padding: 2,
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function SearchableCombobox<T extends { id: string; name: string; extra?: string; price?: number }>({
  label,
  items,
  value,
  onChange,
  placeholder = "ابحث أو اختر...",
  disabled = false,
  required = false,
}: {
  label: string;
  items: T[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === value),
    [items, value]
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        (item.extra && item.extra.toLowerCase().includes(lower))
    );
  }, [items, query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="local-field" ref={containerRef}>
      <span>{label} {required && <strong style={{ color: "#bd4545" }}>*</strong>}</span>
      <div className="local-combobox">
        <input
          type="text"
          disabled={disabled}
          className="local-combobox-input"
          placeholder={selectedItem ? selectedItem.name : placeholder}
          value={open ? query : selectedItem ? selectedItem.name : ""}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              setQuery("");
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && filteredItems.length > 0 && open) {
              e.preventDefault();
              onChange(filteredItems[0].id);
              setOpen(false);
            }
          }}
        />
        <Search className="local-combobox-icon-search" />

        {value && !disabled && (
          <button
            type="button"
            className="local-combobox-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQuery("");
            }}
            title="مسح الاختيار"
          >
            ✕
          </button>
        )}

        {open && !disabled && (
          <div className="local-combobox-dropdown">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`local-combobox-item ${
                  item.id === value ? "selected" : ""
                }`}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{item.name}</span>
                {item.price !== undefined && (
                  <span className="local-combobox-price">
                    {money(item.price)}
                  </span>
                )}
                {item.extra && (
                  <small style={{ color: "#667a75", fontSize: 10 }}>
                    {item.extra}
                  </small>
                )}
              </div>
            ))}
            {!filteredItems.length && (
              <div className="local-combobox-empty">
                لا توجد نتائج مطابقة لـ "{query}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="local-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

// =========================================================================
// LOGIN COMPONENT
// =========================================================================

function Login({
  setup,
  onDone,
}: {
  setup: boolean;
  onDone: (user: User) => void;
}) {
  const [username, setUsername] = useState("ghadeer");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("غدير");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = setup
        ? await api<{ user: User }>("/auth/bootstrap", {
            method: "POST",
            body: JSON.stringify({ username, password, displayName }),
          })
        : await api<{ user: User }>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
          });
      onDone(result.user);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "تعذر تسجيل الدخول"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="local-login">
      <div className="local-login-card">
        <div className="local-mark">
          <ShieldCheck />
        </div>
        <span className="local-kicker">نبع الغدير العلمي</span>
        <h1>{setup ? "تهيئة حساب الأدمن" : "تسجيل الدخول"}</h1>
        <p>
          {setup
            ? "أنشئ الحساب الرئيسي مرة واحدة، ثم ابدأ بإضافة المشرفين."
            : "ادخل باسم المستخدم وكلمة المرور فقط."}
        </p>
        <form onSubmit={submit}>
          {setup && (
            <Field label="اسم الأدمن">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </Field>
          )}
          <Field label="اسم المستخدم">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field label="كلمة المرور">
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && <div className="local-error">{error}</div>}
          <button className="local-primary" disabled={busy}>
            {busy
              ? "جارٍ التحقق..."
              : setup
              ? "إنشاء الحساب والدخول"
              : "دخول"}
          </button>
        </form>
      </div>
    </main>
  );
}

// =========================================================================
// MAIN DELEGATES PAGE
// =========================================================================

export default function Delegates() {
  const [user, setUser] = useState<User | null>(null);
  const [setup, setSetup] = useState(false);
  const [reference, setReference] = useState<Reference | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [warehouse, setWarehouse] = useState<WarehouseSale[]>([]);
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [section, setSection] = useState<
    "sales" | "warehouse" | "targets" | "people"
  >("sales");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const load = async (currentUser?: User, silent = false) => {
    if (!silent) {
      if (!reference) setInitialLoading(true);
      else setRefreshing(true);
    }
    setError("");
    try {
      const me =
        currentUser || (await api<{ user: User | null }>("/auth/me")).user;
      if (!me) {
        setUser(null);
        setSetup(false);
        try {
          await api("/users");
        } catch (cause) {
          setSetup(String(cause).includes("UNAUTHORIZED") ? true : false);
        }
        return;
      }
      setUser(me);
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const [ref, saleData, warehouseData, targetData] = await Promise.all([
        api<Reference>("/reference"),
        api<{ sales: Sale[] }>("/sales"),
        api<{ sales: WarehouseSale[] }>(
          `/warehouse-sales?year=${currentYear}&month=${currentMonth}`
        ),
        api<{ targets: TargetRecord[] }>(
          `/targets?year=${currentYear}&month=${currentMonth}`
        ),
      ]);
      setReference(ref);
      setSales(saleData.sales);
      setWarehouse(warehouseData.sales);
      setTargets(targetData.targets);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "تعذر تحميل البيانات"
      );
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!user && !initialLoading) {
    return <Login setup={setup} onDone={(next) => void load(next)} />;
  }

  if (initialLoading || !reference || !user) {
    return (
      <main className="local-app">
        <div className="local-loading">جارٍ تجهيز لوحة العمل الفائقة...</div>
      </main>
    );
  }

  return (
    <>
      <AppShell
        user={user}
        reference={reference}
        setReference={setReference}
        sales={sales}
        setSales={setSales}
        warehouse={warehouse}
        setWarehouse={setWarehouse}
        targets={targets}
        setTargets={setTargets}
        section={section}
        setSection={setSection}
        error={error}
        refreshing={refreshing}
        showToast={showToast}
        reload={(silent = true) => void load(user, silent)}
        onLogout={async () => {
          await api("/auth/logout", { method: "POST" });
          setUser(null);
        }}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

// =========================================================================
// APP SHELL
// =========================================================================

function AppShell({
  user,
  reference,
  setReference,
  sales,
  setSales,
  warehouse,
  setWarehouse,
  targets,
  setTargets,
  section,
  setSection,
  error,
  refreshing,
  showToast,
  reload,
  onLogout,
}: {
  user: User;
  reference: Reference;
  setReference: React.Dispatch<React.SetStateAction<Reference | null>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  warehouse: WarehouseSale[];
  setWarehouse: React.Dispatch<React.SetStateAction<WarehouseSale[]>>;
  targets: TargetRecord[];
  setTargets: React.Dispatch<React.SetStateAction<TargetRecord[]>>;
  section: "sales" | "warehouse" | "targets" | "people";
  setSection: (value: "sales" | "warehouse" | "targets" | "people") => void;
  error: string;
  refreshing: boolean;
  showToast: (text: string, type?: "success" | "error" | "info") => void;
  reload: (silent?: boolean) => void;
  onLogout: () => void;
}) {
  const govName = reference.governorates.find(
    (item) => item.id === user.governorateId
  )?.name;
  const currentSales =
    user.role === "admin"
      ? sales
      : sales.filter((item) => item.governorateId === user.governorateId);
  const totalUnits = currentSales.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = currentSales.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  );
  const warehouseUnits = warehouse.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const netWarehouseUnits = warehouseUnits - totalUnits;

  return (
    <main className="local-app">
      <header className="local-header">
        <div>
          <span className="local-kicker">نبع الغدير العلمي</span>
          <h1>{user.role === "admin" ? "لوحة الإدارة والمتابعة" : "إدخال المبيعات السريعة"}</h1>
          <p>
            {user.role === "admin"
              ? "التحكم بالمواد، المحافظات، الأهداف، والمندوبين باستجابة فورية."
              : `${user.displayName}${govName ? ` · ${govName}` : ""}`}
          </p>
        </div>
        <div className="local-header-actions">
          <button
            className="local-icon"
            onClick={() => reload(false)}
            aria-label="تحديث"
            title="تحديث البيانات لحظياً"
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            className="local-icon"
            onClick={onLogout}
            aria-label="خروج"
            title="تسجيل الخروج"
          >
            <LogOut />
          </button>
        </div>
      </header>

      {error && <div className="local-error local-wide">{error}</div>}

      <section className="local-summary">
        <div>
          <span>قطع المندوبين</span>
          <strong>{number(totalUnits)}</strong>
        </div>
        <div>
          <span>مبالغ المندوبين</span>
          <strong>{money(totalAmount)}</strong>
        </div>
        <div>
          <span>{user.role === "admin" ? "صافي المذخر" : "العمليات"}</span>
          <strong>
            {user.role === "admin"
              ? number(netWarehouseUnits)
              : number(currentSales.length)}
          </strong>
        </div>
        {user.role === "admin" && (
          <div>
            <span>إجمالي المذخر</span>
            <strong>{number(warehouseUnits)}</strong>
          </div>
        )}
      </section>

      {user.role === "admin" && (
        <nav className="local-nav">
          {(
            [
              ["sales", "المبيعات والإدخال", ClipboardList],
              ["warehouse", "مبيعات المذاخر", Store],
              ["targets", "الأهداف والتارغت", Target],
              ["people", "المستخدمون والمندوبون", Users],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              className={section === key ? "active" : ""}
              onClick={() => setSection(key)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      {section === "sales" && (
        <SalesSection
          user={user}
          reference={reference}
          sales={currentSales}
          setSales={setSales}
          showToast={showToast}
          reload={reload}
        />
      )}
      {section === "warehouse" && user.role === "admin" && (
        <WarehouseSection
          reference={reference}
          records={warehouse}
          setWarehouse={setWarehouse}
          showToast={showToast}
          reload={reload}
        />
      )}
      {section === "targets" && user.role === "admin" && (
        <TargetsSection
          reference={reference}
          records={targets}
          setTargets={setTargets}
          showToast={showToast}
          reload={reload}
        />
      )}
      {section === "people" && user.role === "admin" && (
        <PeopleSection
          reference={reference}
          setReference={setReference}
          showToast={showToast}
          reload={reload}
        />
      )}
    </main>
  );
}

// =========================================================================
// SALES SECTION (Smart Combobox, Presets, Multi-Item Batch & Optimistic UI)
// =========================================================================

type BatchItem = {
  id: string;
  materialId: string;
  quantity: number;
};

function SalesSection({
  user,
  reference,
  sales,
  setSales,
  showToast,
  reload,
}: {
  user: User;
  reference: Reference;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  showToast: (text: string, type?: "success" | "error" | "info") => void;
  reload: (silent?: boolean) => void;
}) {
  // Mode: single item vs multi-item batch
  const [entryMode, setEntryMode] = useState<"single" | "batch">("single");

  // Common Header State
  const [governorateId, setGovernorateId] = useState(
    user.governorateId || reference.governorates[0]?.id || ""
  );
  const [representativeId, setRepresentativeId] = useState("");
  const [companyId, setCompanyId] = useState(
    reference.companies[0]?.id || ""
  );
  const [saleDate, setSaleDate] = useState(today);

  // Single Item State
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState<string>("10");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Multi-Item Batch State
  const [batchItems, setBatchItems] = useState<BatchItem[]>([
    { id: "1", materialId: "", quantity: 10 },
  ]);

  // Search in sales history
  const [historySearch, setHistorySearch] = useState("");

  const reps = useMemo(
    () => reference.representatives.filter((r) => r.governorateId === governorateId),
    [reference.representatives, governorateId]
  );

  const materials = useMemo(
    () =>
      reference.materials
        .filter((m) => !companyId || m.companyId === companyId)
        .map((m) => ({ id: m.id, name: m.name, price: m.unitPrice })),
    [reference.materials, companyId]
  );

  const chosenMaterial = useMemo(
    () => reference.materials.find((m) => m.id === materialId),
    [reference.materials, materialId]
  );

  const singleTotal = (Number(quantity) || 0) * (chosenMaterial?.unitPrice || 0);

  // Auto pick representative if only 1 exists
  useEffect(() => {
    if (reps.length === 1) {
      setRepresentativeId(reps[0].id);
    } else if (!reps.some((r) => r.id === representativeId)) {
      setRepresentativeId(reps[0]?.id || "");
    }
  }, [governorateId, reps]);

  // Add preset quantity helper
  const addPreset = (val: number) => {
    setQuantity((prev) => {
      const current = Number(prev) || 0;
      return String(current + val);
    });
  };

  // Submit Single Sale (Optimistic)
  const submitSingle = async (event: FormEvent) => {
    event.preventDefault();
    if (!representativeId || !materialId || !chosenMaterial) {
      showToast("يرجى اختيار المندوب والمادة", "error");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      showToast("يرجى إدخال كمية صحيحة أكبر من صفر", "error");
      return;
    }

    const currentRep = reps.find((r) => r.id === representativeId);
    const currentGov = reference.governorates.find((g) => g.id === governorateId);
    const currentComp = reference.companies.find((c) => c.id === companyId);

    // Create optimistic sale object
    const optimisticSale: Sale = {
      id: `opt-${Date.now()}`,
      saleDate,
      quantity: qty,
      unitPrice: chosenMaterial.unitPrice,
      totalAmount: singleTotal,
      supervisor: user.displayName,
      representative: currentRep?.name || "",
      governorateId,
      governorate: currentGov?.name || "",
      companyId,
      company: currentComp?.name || "",
      materialId,
      material: chosenMaterial.name,
    };

    // 0ms Latency UI update
    setSales((prev) => [optimisticSale, ...prev]);
    showToast(`✓ تم حفظ ${qty} قطعة (${money(singleTotal)}) بنجاح`);

    // Reset material for next rapid entry
    setMaterialId("");
    setQuantity("10");
    setNote("");

    // Send API in background
    try {
      await api("/sales", {
        method: "POST",
        body: JSON.stringify({
          governorateId,
          representativeId,
          companyId,
          materialId,
          quantity: qty,
          unitPrice: chosenMaterial.unitPrice,
          totalAmount: singleTotal,
          saleDate,
          note,
        }),
      });
      reload(true);
    } catch (err) {
      // Revert if failed
      setSales((prev) => prev.filter((s) => s.id !== optimisticSale.id));
      showToast(err instanceof Error ? err.message : "فشل حفظ البيع", "error");
    }
  };

  // Submit Multi-Item Batch (Optimistic)
  const submitBatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!representativeId) {
      showToast("يرجى اختيار المندوب", "error");
      return;
    }
    const validItems = batchItems.filter(
      (item) => item.materialId && item.quantity > 0
    );
    if (!validItems.length) {
      showToast("يرجى اختيار مادة واحدة على الأقل وكمية صحيحة", "error");
      return;
    }

    setBusy(true);
    const currentRep = reps.find((r) => r.id === representativeId);
    const currentGov = reference.governorates.find((g) => g.id === governorateId);
    const currentComp = reference.companies.find((c) => c.id === companyId);

    // Optimistic batch sales
    const optimisticList: Sale[] = validItems.map((item, idx) => {
      const mat = reference.materials.find((m) => m.id === item.materialId);
      const unitP = mat?.unitPrice || 0;
      const tot = item.quantity * unitP;
      return {
        id: `opt-batch-${Date.now()}-${idx}`,
        saleDate,
        quantity: item.quantity,
        unitPrice: unitP,
        totalAmount: tot,
        supervisor: user.displayName,
        representative: currentRep?.name || "",
        governorateId,
        governorate: currentGov?.name || "",
        companyId,
        company: currentComp?.name || "",
        materialId: item.materialId,
        material: mat?.name || "",
      };
    });

    setSales((prev) => [...optimisticList, ...prev]);
    const batchTotalAmount = optimisticList.reduce((s, x) => s + x.totalAmount, 0);
    const batchTotalPieces = optimisticList.reduce((s, x) => s + x.quantity, 0);
    showToast(
      `✓ تم تسجيل ${validItems.length} مواد (${number(batchTotalPieces)} قطعة - ${money(batchTotalAmount)})`
    );

    // Reset batch rows
    setBatchItems([{ id: Date.now().toString(), materialId: "", quantity: 10 }]);

    try {
      // Execute all sales in parallel
      await Promise.all(
        validItems.map((item) => {
          const mat = reference.materials.find((m) => m.id === item.materialId);
          const unitPrice = mat?.unitPrice || 0;
          return api("/sales", {
            method: "POST",
            body: JSON.stringify({
              governorateId,
              representativeId,
              companyId,
              materialId: item.materialId,
              quantity: item.quantity,
              unitPrice,
              totalAmount: item.quantity * unitPrice,
              saleDate,
              note: "إدخال متعدد",
            }),
          });
        })
      );
      reload(true);
    } catch (err) {
      setSales((prev) =>
        prev.filter((s) => !optimisticList.some((opt) => opt.id === s.id))
      );
      showToast(err instanceof Error ? err.message : "تعذر حفظ الإدخال المتعدد", "error");
    } finally {
      setBusy(false);
    }
  };

  // Filtered sales in real-time
  const filteredSales = useMemo(() => {
    if (!historySearch.trim()) return sales;
    const lower = historySearch.toLowerCase().trim();
    return sales.filter(
      (s) =>
        s.material.toLowerCase().includes(lower) ||
        s.representative.toLowerCase().includes(lower) ||
        s.governorate.toLowerCase().includes(lower) ||
        s.saleDate.includes(lower)
    );
  }, [sales, historySearch]);

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">إدخال فائق السلاسة</span>
          <h2>تسجيل مبيعات المندوبين</h2>
          <p>استجابة فورية 0ms، دعم البحث بالكيبورد، وأزرار كميات جاهزة.</p>
        </div>
        <BarChart3 />
      </div>

      {/* Mode Switcher */}
      <div className="local-mode-toggle">
        <button
          type="button"
          className={entryMode === "single" ? "active" : ""}
          onClick={() => setEntryMode("single")}
        >
          <Sparkles size={14} />
          <span>إدخال فردي سريع</span>
        </button>
        <button
          type="button"
          className={entryMode === "batch" ? "active" : ""}
          onClick={() => setEntryMode("batch")}
        >
          <Layers size={14} />
          <span>إدخال متعدد (دفعة واحدة)</span>
        </button>
      </div>

      {/* ================= SINGLE ITEM FORM ================= */}
      {entryMode === "single" ? (
        <form className="local-form-card" onSubmit={submitSingle}>
          <div className="local-form-grid">
            {/* المحافظة */}
            <Field label="المحافظة">
              <select
                value={governorateId}
                disabled={user.role !== "admin"}
                onChange={(e) => setGovernorateId(e.target.value)}
              >
                {reference.governorates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* المندوب */}
            <SearchableCombobox
              label="المندوب"
              items={reps.map((r) => ({ id: r.id, name: r.name }))}
              value={representativeId}
              onChange={setRepresentativeId}
              placeholder="اختر المندوب..."
              required
            />

            {/* الشركة */}
            <Field label="الشركة">
              <select
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setMaterialId("");
                }}
                required
              >
                {reference.companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* المادة (Searchable Combobox) */}
            <SearchableCombobox
              label="المادة الدوائية"
              items={materials}
              value={materialId}
              onChange={setMaterialId}
              placeholder="اكتب اسم المادة للبحث الفوري..."
              required
            />

            {/* الكمية مع Presets */}
            <div className="local-field">
              <span>عدد القطع</span>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                required
              />
              <div className="local-presets">
                <span style={{ fontSize: 10, color: "#667a75", marginLeft: 4 }}>
                  سريع:
                </span>
                {[1, 5, 10, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="local-preset-chip"
                    onClick={() => addPreset(val)}
                  >
                    +{val}
                  </button>
                ))}
                <button
                  type="button"
                  className="local-preset-chip clear"
                  onClick={() => setQuantity("")}
                >
                  تفريغ
                </button>
              </div>
            </div>

            {/* تاريخ البيع */}
            <Field label="تاريخ البيع">
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="local-total">
            <span>
              سعر المفرد: {chosenMaterial ? money(chosenMaterial.unitPrice) : "—"}
            </span>
            <strong>المجموع: {money(singleTotal)}</strong>
          </div>

          <button className="local-primary">
            <Check /> حفظ البيع فوراً (0ms)
          </button>
        </form>
      ) : (
        /* ================= MULTI-ITEM BATCH FORM ================= */
        <form className="local-form-card" onSubmit={submitBatch}>
          <div className="local-form-grid">
            <Field label="المحافظة">
              <select
                value={governorateId}
                disabled={user.role !== "admin"}
                onChange={(e) => setGovernorateId(e.target.value)}
              >
                {reference.governorates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <SearchableCombobox
              label="المندوب"
              items={reps.map((r) => ({ id: r.id, name: r.name }))}
              value={representativeId}
              onChange={setRepresentativeId}
              placeholder="اختر المندوب..."
              required
            />

            <Field label="الشركة">
              <select
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setBatchItems([{ id: Date.now().toString(), materialId: "", quantity: 10 }]);
                }}
                required
              >
                {reference.companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="تاريخ البيع">
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
              />
            </Field>
          </div>

          <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 900 }}>
              قائمة المواد المطلوبة ({batchItems.length} أسطر)
            </h4>

            {batchItems.map((item, index) => {
              const mat = reference.materials.find((m) => m.id === item.materialId);
              const subtotal = (item.quantity || 0) * (mat?.unitPrice || 0);

              return (
                <div key={item.id} className="local-batch-row">
                  <SearchableCombobox
                    label={`المادة ${index + 1}`}
                    items={materials}
                    value={item.materialId}
                    onChange={(mId) => {
                      setBatchItems((prev) =>
                        prev.map((b) => (b.id === item.id ? { ...b, materialId: mId } : b))
                      );
                    }}
                    placeholder="اختر المادة..."
                    required
                  />
                  <Field label="الكمية">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBatchItems((prev) =>
                          prev.map((b) => (b.id === item.id ? { ...b, quantity: val } : b))
                        );
                      }}
                      required
                    />
                  </Field>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 10, color: "#667a75", display: "block" }}>
                      الإجمالي الفرعي
                    </span>
                    <strong style={{ fontSize: 12, color: "#087f6a" }}>
                      {money(subtotal)}
                    </strong>
                  </div>
                  {batchItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBatchItems((prev) => prev.filter((b) => b.id !== item.id))
                      }
                      style={{
                        background: "#fee2e2",
                        color: "#dc2626",
                        border: "none",
                        borderRadius: 8,
                        padding: 8,
                        cursor: "pointer",
                      }}
                      title="حذف السطر"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}

            <div className="local-batch-actions">
              <button
                type="button"
                className="local-btn-add-row"
                onClick={() =>
                  setBatchItems((prev) => [
                    ...prev,
                    { id: Math.random().toString(), materialId: "", quantity: 10 },
                  ])
                }
              >
                <Plus size={14} /> إضافة مادة أخرى للطلبية
              </button>

              <div style={{ textAlign: "left" }}>
                <span style={{ fontSize: 11, color: "#667a75", marginLeft: 8 }}>
                  إجمالي كل المواد:
                </span>
                <strong style={{ fontSize: 16, color: "#087f6a" }}>
                  {money(
                    batchItems.reduce((sum, item) => {
                      const m = reference.materials.find((x) => x.id === item.materialId);
                      return sum + (item.quantity || 0) * (m?.unitPrice || 0);
                    }, 0)
                  )}
                </strong>
              </div>
            </div>
          </div>

          <button
            className="local-primary"
            style={{ marginTop: 18, width: "100%" }}
            disabled={busy}
          >
            {busy ? "جارٍ الحفظ..." : <><Check /> حفظ جميع المواد دفعة واحدة</>}
          </button>
        </form>
      )}

      {/* ================= RECENT SALES LIST ================= */}
      <div className="local-section-head compact">
        <div>
          <h2>آخر الإدخالات ({filteredSales.length})</h2>
          <p>بحث وفلترة فورية دون أي تأخير.</p>
        </div>
        <div style={{ position: "relative", width: 220 }}>
          <input
            type="text"
            placeholder="بحث في العمليات..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            style={{
              width: "100%",
              height: 36,
              padding: "0 30px 0 10px",
              borderRadius: 10,
              border: "1px solid #dfe8e5",
              background: "#fff",
              fontSize: 11,
              fontWeight: 700,
            }}
          />
          <Search
            size={14}
            style={{
              position: "absolute",
              right: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
            }}
          />
          {historySearch && (
            <button
              type="button"
              onClick={() => setHistorySearch("")}
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="local-list">
        {filteredSales.slice(0, 15).map((item) => (
          <div className="local-list-row" key={item.id}>
            <div>
              <strong>{item.material}</strong>
              <span>
                {item.representative} · {item.governorate} · {item.saleDate}
              </span>
            </div>
            <b style={{ textAlign: "left" }}>
              {number(item.quantity)} قطعة
              <br />
              <small>{money(item.totalAmount)}</small>
            </b>
          </div>
        ))}
        {!filteredSales.length && (
          <div className="local-empty">لا توجد إدخالات مطابقة.</div>
        )}
      </div>
    </section>
  );
}

// =========================================================================
// WAREHOUSE SECTION (Optimistic & Responsive)
// =========================================================================

function WarehouseSection({
  reference,
  records,
  setWarehouse,
  showToast,
  reload,
}: {
  reference: Reference;
  records: WarehouseSale[];
  setWarehouse: React.Dispatch<React.SetStateAction<WarehouseSale[]>>;
  showToast: (text: string, type?: "success" | "error" | "info") => void;
  reload: (silent?: boolean) => void;
}) {
  const [form, setForm] = useState({
    governorateId: reference.governorates[0]?.id || "",
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    quantity: "",
    amount: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(form.quantity);
    const amt = form.amount ? Number(form.amount) : null;
    const gov = reference.governorates.find((g) => g.id === form.governorateId);

    const optimisticRecord: WarehouseSale = {
      id: `opt-wh-${Date.now()}`,
      governorateId: form.governorateId,
      governorate: gov?.name || "",
      year: Number(form.year),
      month: Number(form.month),
      quantity: qty,
      amount: amt,
      createdByName: reference.user.displayName,
    };

    setWarehouse((prev) => {
      const filtered = prev.filter(
        (r) =>
          !(
            r.governorateId === form.governorateId &&
            r.year === Number(form.year) &&
            r.month === Number(form.month)
          )
      );
      return [optimisticRecord, ...filtered];
    });

    showToast(`✓ تم حفظ مبيعات مذخر محافظة ${gov?.name || ""}`);

    try {
      await api("/warehouse-sales", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          month: Number(form.month),
          quantity: qty,
          amount: form.amount,
        }),
      });
      reload(true);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "تعذر الحفظ", "error");
    }
  };

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">المبيعات الخارجة من المحافظة</span>
          <h2>مبيعات المذخر الشهرية</h2>
          <p>عدد القطع إجباري، والمبلغ اختياري مع تحديث فوري.</p>
        </div>
        <Store />
      </div>

      <form className="local-form-card" onSubmit={submit}>
        <div className="local-form-grid">
          <Field label="المحافظة">
            <select
              value={form.governorateId}
              onChange={(e) =>
                setForm({ ...form, governorateId: e.target.value })
              }
            >
              {reference.governorates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="السنة">
            <input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </Field>
          <Field label="الشهر">
            <input
              type="number"
              min="1"
              max="12"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
            />
          </Field>
          <Field label="إجمالي القطع">
            <input
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: e.target.value })
              }
              required
            />
          </Field>
          <Field label="المبلغ (اختياري)">
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
        </div>

        <button className="local-primary" style={{ marginTop: 14 }} disabled={busy}>
          <Check /> حفظ مبيعات المذخر
        </button>
      </form>

      <div className="local-list" style={{ marginTop: 16 }}>
        {records.map((item) => (
          <div className="local-list-row" key={item.id}>
            <div>
              <strong>{item.governorate}</strong>
              <span>
                {item.month}/{item.year} · أدخلها {item.createdByName}
              </span>
            </div>
            <b>
              {number(item.quantity)} قطعة
              <br />
              <small>
                {item.amount == null
                  ? "المبلغ غير مسجل"
                  : money(item.amount)}
              </small>
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}

// =========================================================================
// TARGETS SECTION (Optimistic & Responsive)
// =========================================================================

function TargetsSection({
  reference,
  records,
  setTargets,
  showToast,
  reload,
}: {
  reference: Reference;
  records: TargetRecord[];
  setTargets: React.Dispatch<React.SetStateAction<TargetRecord[]>>;
  showToast: (text: string, type?: "success" | "error" | "info") => void;
  reload: (silent?: boolean) => void;
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [values, setValues] = useState<
    Record<string, { quantity: string; amount: string }>
  >({});
  const [savingGov, setSavingGov] = useState<string | null>(null);

  const save = async (governorateId: string) => {
    setSavingGov(governorateId);
    const value = values[governorateId] || { quantity: "", amount: "" };
    const govObj = reference.governorates.find((g) => g.id === governorateId);
    const qty = Number(value.quantity || 0);
    const amt = value.amount ? Number(value.amount) : null;

    // Optimistic Update
    setTargets((prev) => {
      const filtered = prev.filter(
        (t) =>
          !(
            t.governorateId === governorateId &&
            t.year === Number(year) &&
            t.month === Number(month)
          )
      );
      return [
        {
          id: `opt-target-${governorateId}`,
          governorateId,
          governorate: govObj?.name || "",
          year: Number(year),
          month: Number(month),
          targetQuantity: qty,
          targetAmount: amt,
        },
        ...filtered,
      ];
    });

    showToast(`✓ تم حفظ هدف ${govObj?.name || ""} بنجاح`);

    try {
      await api("/targets", {
        method: "PUT",
        body: JSON.stringify({
          governorateId,
          year: Number(year),
          month: Number(month),
          targetQuantity: qty,
          targetAmount: value.amount,
        }),
      });
      reload(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذر حفظ الهدف", "error");
    } finally {
      setSavingGov(null);
    }
  };

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">خطة الشهر</span>
          <h2>أهداف المحافظات (التارغت)</h2>
          <p>تعديل وتحديد خطط كل المحافظات باستجابة فورية.</p>
        </div>
        <Target />
      </div>

      <div className="local-period">
        <Field label="السنة">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </Field>
        <Field label="الشهر">
          <input
            type="number"
            min="1"
            max="12"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
      </div>

      <div className="local-target-grid">
        {reference.governorates.map((gov) => {
          const existing = records.find(
            (item) => item.governorateId === gov.id
          );
          const value = values[gov.id] || {
            quantity: existing ? String(existing.targetQuantity) : "",
            amount:
              existing?.targetAmount == null
                ? ""
                : String(existing.targetAmount),
          };
          const isSaving = savingGov === gov.id;
          return (
            <div className="local-target-card" key={gov.id}>
              <div>
                <strong>{gov.name}</strong>
                <span>
                  {existing
                    ? `محفوظ · ${number(existing.targetQuantity)} قطعة`
                    : "لم يحدد بعد"}
                </span>
              </div>
              <input
                type="number"
                min="0"
                placeholder="عدد القطع المستهدف"
                value={value.quantity}
                onChange={(e) =>
                  setValues({
                    ...values,
                    [gov.id]: { ...value, quantity: e.target.value },
                  })
                }
              />
              <input
                type="number"
                min="0"
                placeholder="مبلغ مالي (اختياري)"
                value={value.amount}
                onChange={(e) =>
                  setValues({
                    ...values,
                    [gov.id]: { ...value, amount: e.target.value },
                  })
                }
              />
              <button
                className="local-secondary"
                disabled={isSaving}
                onClick={() => void save(gov.id)}
              >
                {isSaving ? "جارٍ الحفظ..." : "حفظ الهدف"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// =========================================================================
// PEOPLE SECTION (Search, Filter Tabs, Optimistic Add & Delete)
// =========================================================================

function PeopleSection({
  reference,
  setReference,
  showToast,
  reload,
}: {
  reference: Reference;
  setReference: React.Dispatch<React.SetStateAction<Reference | null>>;
  showToast: (text: string, type?: "success" | "error" | "info") => void;
  reload: (silent?: boolean) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    governorateId: reference.governorates[0]?.id || "",
  });
  const [supervisor, setSupervisor] = useState({
    displayName: "",
    username: "",
    password: "",
    governorateId: reference.governorates[0]?.id || "",
    companyIds: reference.companies.map((item) => item.id),
  });

  const [filterGovId, setFilterGovId] = useState<string>("all");
  const [repSearch, setRepSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Optimistic Add Representative
  const addRep = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const newName = form.name.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticRep: Representative = {
      id: tempId,
      name: newName,
      governorateId: form.governorateId,
    };

    setReference((prev) =>
      prev
        ? {
            ...prev,
            representatives: [...prev.representatives, optimisticRep],
          }
        : null
    );

    showToast(`✓ تمت إضافة "${newName}" بنجاح`);
    setForm({ ...form, name: "" });

    try {
      await api("/representatives", {
        method: "POST",
        body: JSON.stringify({ name: newName, governorateId: form.governorateId }),
      });
      reload(true);
    } catch (err) {
      setReference((prev) =>
        prev
          ? {
              ...prev,
              representatives: prev.representatives.filter((r) => r.id !== tempId),
            }
          : null
      );
      showToast(err instanceof Error ? err.message : "تعذر إضافة المندوب", "error");
    }
  };

  // Optimistic Delete Representative
  const deleteRep = async (repId: string, repName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المندوب "${repName}"؟`)) {
      return;
    }
    setDeletingId(repId);

    const deletedRep = reference.representatives.find((r) => r.id === repId);

    // Optimistically remove from list immediately (0ms)
    setReference((prev) =>
      prev
        ? {
            ...prev,
            representatives: prev.representatives.filter((r) => r.id !== repId),
          }
        : null
    );

    showToast(`✓ تم حذف "${repName}"`);

    try {
      await api(`/representatives/${repId}`, {
        method: "DELETE",
      });
      reload(true);
    } catch (err) {
      // Revert if failed
      if (deletedRep) {
        setReference((prev) =>
          prev
            ? {
                ...prev,
                representatives: [...prev.representatives, deletedRep],
              }
            : null
        );
      }
      showToast(err instanceof Error ? err.message : "تعذر حذف المندوب", "error");
    } finally {
      setDeletingId(null);
    }
  };

  // Add Supervisor
  const addSupervisor = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({ ...supervisor, role: "supervisor" }),
      });
      showToast(`✓ تم إنشاء حساب المشرف "${supervisor.displayName}" بنجاح`);
      setSupervisor({
        ...supervisor,
        displayName: "",
        username: "",
        password: "",
      });
      reload(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذر إنشاء المشرف", "error");
    }
  };

  // Live filter representatives
  const displayedReps = useMemo(() => {
    return reference.representatives.filter((item) => {
      const matchGov = filterGovId === "all" || item.governorateId === filterGovId;
      const matchSearch =
        !repSearch.trim() ||
        item.name.toLowerCase().includes(repSearch.toLowerCase().trim());
      return matchGov && matchSearch;
    });
  }, [reference.representatives, filterGovId, repSearch]);

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">إدارة الكادر والمندوبين</span>
          <h2>المشرفون والمندوبون</h2>
          <p>إضافة وحذف لحظي، تصفية المحافظات، وتحكم كامل بالصلاحيات.</p>
        </div>
        <Users />
      </div>

      <div className="local-dual">
        {/* نموذج إضافة مشرف */}
        <form className="local-form-card" onSubmit={addSupervisor}>
          <h3>
            <UserPlus /> إنشاء حساب مشرف (Supervisor)
          </h3>
          <Field label="اسم المشرف">
            <input
              value={supervisor.displayName}
              onChange={(e) =>
                setSupervisor({ ...supervisor, displayName: e.target.value })
              }
              placeholder="مثال: علي كريم"
              required
            />
          </Field>
          <Field label="اسم المستخدم (Username)">
            <input
              value={supervisor.username}
              onChange={(e) =>
                setSupervisor({ ...supervisor, username: e.target.value })
              }
              placeholder="مثال: ali_basra"
              required
            />
          </Field>
          <Field label="كلمة المرور">
            <input
              type="password"
              minLength={6}
              value={supervisor.password}
              onChange={(e) =>
                setSupervisor({ ...supervisor, password: e.target.value })
              }
              placeholder="6 أحرف أو أرقام على الأقل"
              required
            />
          </Field>
          <Field label="المحافظة التابع لها">
            <select
              value={supervisor.governorateId}
              onChange={(e) =>
                setSupervisor({
                  ...supervisor,
                  governorateId: e.target.value,
                })
              }
            >
              {reference.governorates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="local-company-checks">
            <span className="local-field-label">الشركات المسموحة:</span>
            {reference.companies.map((company) => (
              <label key={company.id}>
                <input
                  type="checkbox"
                  checked={supervisor.companyIds.includes(company.id)}
                  onChange={(e) =>
                    setSupervisor({
                      ...supervisor,
                      companyIds: e.target.checked
                        ? [...supervisor.companyIds, company.id]
                        : supervisor.companyIds.filter(
                            (id) => id !== company.id
                          ),
                    })
                  }
                />{" "}
                {company.name}
              </label>
            ))}
          </div>

          <button className="local-primary" style={{ marginTop: 14 }}>
            <Plus /> إنشاء حساب المشرف
          </button>
        </form>

        {/* نموذج إضافة مندوب */}
        <form className="local-form-card" onSubmit={addRep}>
          <h3>
            <Users /> إضافة مندوب جديد
          </h3>
          <Field label="اسم المندوب">
            <input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              placeholder="مثال: مندوب البصرة 1"
              required
            />
          </Field>
          <Field label="المحافظة">
            <select
              value={form.governorateId}
              onChange={(e) =>
                setForm({ ...form, governorateId: e.target.value })
              }
            >
              {reference.governorates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <button className="local-primary" style={{ marginTop: 14 }}>
            <Plus /> إضافة المندوب فوراً
          </button>
        </form>
      </div>

      {/* قائمة المندوبين مع الفلترة السريعة */}
      <div className="local-section-head compact">
        <div>
          <h2>قائمة المندوبين ({displayedReps.length})</h2>
          <p>فلترة فورية وتعديل مباشر.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", width: 180 }}>
            <input
              type="text"
              placeholder="بحث بالاسم..."
              value={repSearch}
              onChange={(e) => setRepSearch(e.target.value)}
              style={{
                width: "100%",
                height: 36,
                padding: "0 28px 0 8px",
                borderRadius: 10,
                border: "1px solid #dfe8e5",
                background: "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            />
            <Search
              size={13}
              style={{
                position: "absolute",
                right: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
          </div>

          <select
            value={filterGovId}
            onChange={(e) => setFilterGovId(e.target.value)}
            style={{
              height: 36,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid #dfe8e5",
              background: "#fff",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <option value="all">جميع المحافظات ({reference.representatives.length})</option>
            {reference.governorates.map((gov) => {
              const count = reference.representatives.filter(
                (r) => r.governorateId === gov.id
              ).length;
              return (
                <option key={gov.id} value={gov.id}>
                  {gov.name} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="local-list">
        {displayedReps.map((item) => {
          const gov = reference.governorates.find(
            (g) => g.id === item.governorateId
          );
          const isDeleting = deletingId === item.id;
          return (
            <div className="local-list-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{gov?.name || "محافظة غير محددة"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void deleteRep(item.id, item.name)}
                  disabled={isDeleting}
                  title={`حذف ${item.name}`}
                  style={{
                    background: "#fee2e2",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 0.15s ease",
                  }}
                >
                  <Trash2 size={13} />
                  <span>{isDeleting ? "جارٍ الحذف..." : "حذف"}</span>
                </button>
              </div>
            </div>
          );
        })}
        {!displayedReps.length && (
          <div className="local-empty">لا يوجد مندوبون مطابقون لهذا التحديد.</div>
        )}
      </div>
    </section>
  );
}
