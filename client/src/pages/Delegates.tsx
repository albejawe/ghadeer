import { FormEvent, useEffect, useState } from "react";
import {
  BarChart3,
  Check,
  ClipboardList,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  Target,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import "./delegates.css";

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
        <div className="local-loading">جارٍ تجهيز لوحة العمل...</div>
      </main>
    );
  }

  return (
    <AppShell
      user={user}
      reference={reference}
      sales={sales}
      warehouse={warehouse}
      targets={targets}
      section={section}
      setSection={setSection}
      error={error}
      refreshing={refreshing}
      reload={(silent = true) => void load(user, silent)}
      onLogout={async () => {
        await api("/auth/logout", { method: "POST" });
        setUser(null);
      }}
    />
  );
}

function AppShell({
  user,
  reference,
  sales,
  warehouse,
  targets,
  section,
  setSection,
  error,
  refreshing,
  reload,
  onLogout,
}: {
  user: User;
  reference: Reference;
  sales: Sale[];
  warehouse: WarehouseSale[];
  targets: TargetRecord[];
  section: "sales" | "warehouse" | "targets" | "people";
  setSection: (value: "sales" | "warehouse" | "targets" | "people") => void;
  error: string;
  refreshing: boolean;
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
          <h1>{user.role === "admin" ? "لوحة الإدارة" : "إدخال المبيعات"}</h1>
          <p>
            {user.role === "admin"
              ? "التحكم بالمواد والمحافظات والمشرفين والأهداف."
              : `${user.displayName}${govName ? ` · ${govName}` : ""}`}
          </p>
        </div>
        <div className="local-header-actions">
          <button
            className="local-icon"
            onClick={() => reload(false)}
            aria-label="تحديث"
            title="تحديث البيانات"
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
              ["sales", "المبيعات", ClipboardList],
              ["warehouse", "مبيعات المذاخر", Store],
              ["targets", "الأهداف", Target],
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
          reload={reload}
        />
      )}
      {section === "warehouse" && user.role === "admin" && (
        <WarehouseSection
          reference={reference}
          records={warehouse}
          reload={reload}
        />
      )}
      {section === "targets" && user.role === "admin" && (
        <TargetsSection
          reference={reference}
          records={targets}
          reload={reload}
        />
      )}
      {section === "people" && user.role === "admin" && (
        <PeopleSection reference={reference} reload={reload} />
      )}
    </main>
  );
}

function SalesSection({
  user,
  reference,
  sales,
  reload,
}: {
  user: User;
  reference: Reference;
  sales: Sale[];
  reload: (silent?: boolean) => void;
}) {
  const [form, setForm] = useState({
    governorateId: user.governorateId || reference.governorates[0]?.id || "",
    representativeId: "",
    companyId: "",
    materialId: "",
    quantity: "",
    saleDate: today,
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reps = reference.representatives.filter(
    (item) => item.governorateId === form.governorateId
  );
  const materials = reference.materials.filter(
    (item) => !form.companyId || item.companyId === form.companyId
  );
  const chosen = reference.materials.find((item) => item.id === form.materialId);
  const total =
    Number(form.quantity || 0) * Number(chosen?.unitPrice || 0);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      representativeId: reps.length === 1 ? reps[0].id : "",
      materialId: materials.length === 1 ? materials[0].id : "",
    }));
  }, [form.governorateId, form.companyId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/sales", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          unitPrice: chosen?.unitPrice || 0,
          totalAmount: total,
        }),
      });
      setMessage("تم حفظ البيع بنجاح");
      setForm((current) => ({
        ...current,
        representativeId: reps.length === 1 ? reps[0].id : "",
        materialId: "",
        quantity: "",
        note: "",
      }));
      reload(true);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "تعذر حفظ البيع"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">تسجيل سريع</span>
          <h2>إضافة مبيعات مندوب</h2>
          <p>اختر البيانات الأساسية، والمبلغ يُحسب تلقائيًا.</p>
        </div>
        <BarChart3 />
      </div>

      <form className="local-form-card" onSubmit={submit}>
        <div className="local-form-grid">
          <Field label="المحافظة">
            <select
              value={form.governorateId}
              disabled={user.role !== "admin"}
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
          <Field label="المندوب">
            <select
              value={form.representativeId}
              onChange={(e) =>
                setForm({ ...form, representativeId: e.target.value })
              }
              required
            >
              <option value="">اختر المندوب</option>
              {reps.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الشركة">
            <select
              value={form.companyId}
              onChange={(e) =>
                setForm({ ...form, companyId: e.target.value, materialId: "" })
              }
              required
            >
              <option value="">اختر الشركة</option>
              {reference.companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المادة">
            <select
              value={form.materialId}
              onChange={(e) =>
                setForm({ ...form, materialId: e.target.value })
              }
              required
            >
              <option value="">اختر المادة</option>
              {materials.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="عدد القطع">
            <input
              inputMode="numeric"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: e.target.value })
              }
              required
            />
          </Field>
          <Field label="تاريخ البيع">
            <input
              type="date"
              value={form.saleDate}
              onChange={(e) =>
                setForm({ ...form, saleDate: e.target.value })
              }
              required
            />
          </Field>
        </div>

        <div className="local-total">
          <span>
            سعر القطعة {chosen ? money(chosen.unitPrice) : "—"}
          </span>
          <strong>{money(total)}</strong>
        </div>

        {message && <div className="local-notice">{message}</div>}

        <button className="local-primary" disabled={busy}>
          {busy ? "جارٍ الحفظ..." : <><Check /> حفظ البيع</>}
        </button>
      </form>

      <div className="local-section-head compact">
        <div>
          <h2>آخر الإدخالات</h2>
          <p>{sales.length} عملية في الفترة الحالية.</p>
        </div>
        <ClipboardList />
      </div>

      <div className="local-list">
        {sales.slice(0, 10).map((item) => (
          <div className="local-list-row" key={item.id}>
            <div>
              <strong>{item.material}</strong>
              <span>
                {item.representative} · {item.governorate} · {item.saleDate}
              </span>
            </div>
            <b>
              {number(item.quantity)} قطعة
              <br />
              <small>{money(item.totalAmount)}</small>
            </b>
          </div>
        ))}
        {!sales.length && (
          <div className="local-empty">لا توجد إدخالات بعد.</div>
        )}
      </div>
    </section>
  );
}

function WarehouseSection({
  reference,
  records,
  reload,
}: {
  reference: Reference;
  records: WarehouseSale[];
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
  const [message, setMessage] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/warehouse-sales", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          month: Number(form.month),
          quantity: Number(form.quantity),
          amount: form.amount,
        }),
      });
      setMessage("تم حفظ مبيعات المذخر بنجاح");
      reload(true);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "تعذر الحفظ"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">المبيعات الخارجة من المحافظة</span>
          <h2>مبيعات المذخر الشهرية</h2>
          <p>عدد القطع إجباري، والمبلغ اختياري.</p>
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

        {message && <div className="local-notice">{message}</div>}

        <button className="local-primary" disabled={busy}>
          {busy ? "جارٍ الحفظ..." : <><Check /> حفظ مبيعات المذخر</>}
        </button>
      </form>

      <div className="local-list">
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

function TargetsSection({
  reference,
  records,
  reload,
}: {
  reference: Reference;
  records: TargetRecord[];
  reload: (silent?: boolean) => void;
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [values, setValues] = useState<
    Record<string, { quantity: string; amount: string }>
  >({});
  const [savingGov, setSavingGov] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");

  const save = async (governorateId: string) => {
    setSavingGov(governorateId);
    setNotice("");
    const value = values[governorateId] || { quantity: "", amount: "" };
    try {
      await api("/targets", {
        method: "PUT",
        body: JSON.stringify({
          governorateId,
          year: Number(year),
          month: Number(month),
          targetQuantity: Number(value.quantity || 0),
          targetAmount: value.amount,
        }),
      });
      const govObj = reference.governorates.find((g) => g.id === governorateId);
      setNotice(`تم حفظ هدف محافظة ${govObj?.name || ""} بنجاح`);
      reload(true);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "تعذر حفظ الهدف"
      );
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
          <p>عدّل أهداف كل المحافظات من شاشة واحدة.</p>
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

      {notice && <div className="local-notice" style={{ marginBottom: 12 }}>{notice}</div>}

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

function PeopleSection({
  reference,
  reload,
}: {
  reference: Reference;
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
  const [repBusy, setRepBusy] = useState(false);
  const [repMessage, setRepMessage] = useState("");
  const [supBusy, setSupBusy] = useState(false);
  const [supMessage, setSupMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const addRep = async (e: FormEvent) => {
    e.preventDefault();
    setRepBusy(true);
    setRepMessage("");
    try {
      await api("/representatives", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setRepMessage(`تمت إضافة المندوب "${form.name}" بنجاح`);
      setForm({ ...form, name: "" });
      reload(true);
    } catch (err) {
      setRepMessage(
        err instanceof Error ? err.message : "تعذر إضافة المندوب"
      );
    } finally {
      setRepBusy(false);
    }
  };

  const deleteRep = async (repId: string, repName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المندوب "${repName}"؟`)) {
      return;
    }
    setDeletingId(repId);
    setRepMessage("");
    try {
      await api(`/representatives/${repId}`, {
        method: "DELETE",
      });
      setRepMessage(`تم حذف المندوب "${repName}" بنجاح`);
      reload(true);
    } catch (err) {
      setRepMessage(
        err instanceof Error ? err.message : "تعذر حذف المندوب"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const addSupervisor = async (e: FormEvent) => {
    e.preventDefault();
    setSupBusy(true);
    setSupMessage("");
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({ ...supervisor, role: "supervisor" }),
      });
      setSupMessage(`تم إنشاء حساب المشرف "${supervisor.displayName}" بنجاح`);
      setSupervisor({
        ...supervisor,
        displayName: "",
        username: "",
        password: "",
      });
      reload(true);
    } catch (err) {
      setSupMessage(
        err instanceof Error ? err.message : "تعذر إنشاء المشرف"
      );
    } finally {
      setSupBusy(false);
    }
  };

  const displayedReps =
    filterGovId === "all"
      ? reference.representatives
      : reference.representatives.filter(
          (item) => item.governorateId === filterGovId
        );

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">إعداد الفريق</span>
          <h2>المشرفون والمندوبون</h2>
          <p>المشرف يدخل المبيعات بالنيابة عن المندوبين، ويمكنك حذف أو إضافة أي مندوب بسهولة.</p>
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

          {supMessage && <div className="local-notice">{supMessage}</div>}

          <button className="local-primary" disabled={supBusy}>
            {supBusy ? "جارٍ الإنشاء..." : <><Plus /> إنشاء الحساب</>}
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

          {repMessage && <div className="local-notice">{repMessage}</div>}

          <button className="local-primary" disabled={repBusy}>
            {repBusy ? "جارٍ الإضافة..." : <><Plus /> إضافة المندوب</>}
          </button>
        </form>
      </div>

      <div className="local-section-head compact">
        <div>
          <h2>قائمة المندوبين المسجلين ({displayedReps.length})</h2>
          <p>موزعون على كافة المحافظات، يمكنك حذف أي مندوب مباشرة.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          <div className="local-empty">لا يوجد مندوبون في هذا القسم بعد.</div>
        )}
      </div>
    </section>
  );
}
