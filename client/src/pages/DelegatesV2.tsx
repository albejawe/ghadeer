import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, CalendarRange, LayoutDashboard, LogOut, Menu, Package, RefreshCw, ShieldCheck, ShoppingCart, Target, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, currentPeriod, DashboardData, ReferenceData, Sale, TargetRecord, User, WarehouseRecord } from "@/features/delegates-v2/api";
import { Overview } from "@/features/delegates-v2/Overview";
import { SalesWorkspace } from "@/features/delegates-v2/SalesWorkspace";
import { TargetsWorkspace, WarehouseWorkspace } from "@/features/delegates-v2/PeriodOperations";
import { CatalogWorkspace, TeamWorkspace } from "@/features/delegates-v2/AdminWorkspaces";
import "./delegates-v2.css";

type View = "overview" | "sales" | "warehouse" | "targets" | "team" | "catalog";

const adminNav = [
  ["overview", "الرئيسية", LayoutDashboard], ["sales", "المبيعات", ShoppingCart], ["warehouse", "المذاخر", Building2],
  ["targets", "الأهداف", Target], ["team", "الفريق", UsersRound], ["catalog", "المواد", Package],
] as const;
const supervisorNav = [["overview", "الرئيسية", LayoutDashboard], ["sales", "المبيعات", ShoppingCart], ["warehouse", "المذخر", Building2]] as const;
const monthNames = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];

function Login({ initialized, onDone }: { initialized: boolean; onDone: () => Promise<void> }) {
  const [username, setUsername] = useState("ghadeer");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }); await onDone(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تسجيل الدخول."); }
    finally { setBusy(false); }
  };
  return <main className="gh-auth"><section className="gh-auth-brand"><div className="gh-brand-mark"><BarChart3 /></div><div><span>نبع الغدير العلمي</span><h1>نظام المبيعات الميدانية</h1><p>تسجيل واضح. أرقام دقيقة. قرار أسرع.</p></div><aside><i /><i /><i /></aside></section><section className="gh-login-card">{initialized ? <><header><ShieldCheck /><div><span>دخول آمن</span><h2>أهلاً بعودتك</h2><p>استخدم اسم المستخدم وكلمة المرور.</p></div></header><form onSubmit={submit}><label><span>اسم المستخدم</span><Input className="gh-auth-input" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label><span>كلمة المرور</span><Input className="gh-auth-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <div className="gh-message bad">{error}</div>}<Button className="gh-login-button" size="lg" disabled={busy}>{busy ? "جارٍ التحقق..." : "دخول إلى النظام"}</Button></form><footer>لا يمكن إنشاء حساب من هذه الصفحة. الحسابات ينشئها الأدمن فقط.</footer></> : <div className="gh-locked"><ShieldCheck /><h2>النظام غير مهيأ</h2><p>تهيئة حساب الأدمن مقفلة من الخادم ولا يمكن لأي زائر إنشاء حساب.</p></div>}</section></main>;
}

function PeriodControl({ period, onChange }: { period: { year: number; month: number }; onChange: (next: { year: number; month: number }) => void }) {
  const value = `${period.year}-${String(period.month).padStart(2, "0")}`;
  return <label className="gh-period"><CalendarRange /><span><small>الفترة الحالية</small><b>{monthNames[period.month - 1]} {period.year}</b></span><Input type="month" value={value} onChange={(event) => { const [year, month] = event.target.value.split("-").map(Number); if (year && month) onChange({ year, month }); }} /></label>;
}

export default function DelegatesV2() {
  const [initialized, setInitialized] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [warehouse, setWarehouse] = useState<WarehouseRecord[]>([]);
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [period, setPeriod] = useState(currentPeriod);
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const loadReference = async () => {
    const data = await api<ReferenceData>("/reference");
    setReference(data); setUser(data.user);
  };
  const loadPeriodData = async (showLoader = false) => {
    if (showLoader) setRefreshing(true);
    const query = `year=${period.year}&month=${period.month}`;
    try {
      const [dashboardData, salesData, warehouseData, targetData] = await Promise.all([
        api<DashboardData>(`/dashboard?${query}`), api<{ sales: Sale[] }>(`/sales?${query}`),
        api<{ records: WarehouseRecord[] }>(`/warehouse?${query}`), api<{ targets: TargetRecord[] }>(`/targets?${query}`),
      ]);
      setDashboard(dashboardData); setSales(salesData.sales); setWarehouse(warehouseData.records); setTargets(targetData.targets); setError("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { setUser(null); setReference(null); }
      setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات الفترة.");
    } finally { setRefreshing(false); }
  };
  const boot = async () => {
    setLoading(true); setError("");
    try {
      const status = await api<{ initialized: boolean }>("/auth/status");
      setInitialized(status.initialized);
      if (!status.initialized) { setUser(null); return; }
      const me = await api<{ user: User | null }>("/auth/me");
      if (!me.user) { setUser(null); return; }
      setUser(me.user);
      await loadReference();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الاتصال بالنظام."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void boot(); }, []);
  useEffect(() => { if (user && reference) void loadPeriodData(); }, [period.year, period.month, Boolean(user && reference)]);

  const nav = useMemo(() => user?.role === "admin" ? adminNav : supervisorNav.filter(([key]) => key !== "warehouse" || user?.canEnterWarehouse), [user]);
  const selectView = (next: View) => { setView(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const logout = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); setReference(null); setDashboard(null); setView("overview"); };

  if (loading) return <main className="gh-loading"><div className="gh-brand-mark"><BarChart3 /></div><strong>جارٍ تجهيز نظام المبيعات...</strong></main>;
  if (!user || !reference) return <Login initialized={initialized} onDone={boot} />;

  const content = () => {
    if (view === "overview") return dashboard ? <Overview data={dashboard} /> : <div className="gh-empty-page"><RefreshCw /><h2>لا توجد بيانات لعرضها</h2><p>ابدأ بإدخال أهداف الشهر ومبيعات المذخر.</p></div>;
    if (view === "sales") return <SalesWorkspace user={user} reference={reference} sales={sales} onChanged={() => loadPeriodData(true)} />;
    if (view === "warehouse") return <WarehouseWorkspace user={user} governorates={reference.governorates} period={period} records={warehouse} onChanged={() => loadPeriodData(true)} />;
    if (view === "targets" && user.role === "admin") return <TargetsWorkspace governorates={reference.governorates} period={period} records={targets} onChanged={() => loadPeriodData(true)} />;
    if (view === "team" && user.role === "admin") return <TeamWorkspace reference={reference} reloadReference={loadReference} />;
    if (view === "catalog" && user.role === "admin") return <CatalogWorkspace reloadReference={loadReference} />;
    return null;
  };

  return <main className="gh-app" dir="rtl"><aside className={`gh-sidebar ${mobileMenu ? "is-open" : ""}`}><header><div className="gh-brand-mark"><BarChart3 /></div><div><strong>نبع الغدير</strong><span>إدارة المبيعات</span></div><button className="gh-mobile-close" onClick={() => setMobileMenu(false)}><X /></button></header><nav>{nav.map(([key, label, Icon]) => <button key={key} className={view === key ? "active" : ""} onClick={() => selectView(key)}><Icon /><span>{label}</span></button>)}</nav><footer><div><i>{user.displayName.slice(0, 1)}</i><span><strong>{user.displayName}</strong><small>{user.role === "admin" ? "الأدمن الرئيسي" : "Supervisor"}</small></span></div><Button size="icon-sm" variant="ghost" onClick={() => void logout()} aria-label="تسجيل الخروج"><LogOut /></Button></footer></aside>{mobileMenu && <button className="gh-menu-overlay" onClick={() => setMobileMenu(false)} aria-label="إغلاق القائمة" />}<section className="gh-main"><header className="gh-topbar"><button className="gh-menu-button" onClick={() => setMobileMenu(true)}><Menu /></button><div className="gh-page-heading"><span>{user.role === "admin" ? "لوحة الإدارة" : reference.governorates[0]?.name}</span><h1>{nav.find(([key]) => key === view)?.[1] || "الرئيسية"}</h1></div><div className="gh-top-actions"><PeriodControl period={period} onChange={setPeriod} /><Button variant="outline" size="icon" onClick={() => void loadPeriodData(true)} className={refreshing ? "is-spinning" : ""} aria-label="تحديث"><RefreshCw /></Button></div></header>{error && <div className="gh-global-error">{error}<Button variant="ghost" size="sm" onClick={() => void loadPeriodData(true)}>إعادة المحاولة</Button></div>}<section className="gh-content">{content()}</section></section><nav className="gh-mobile-nav">{nav.slice(0, 5).map(([key, label, Icon]) => <button key={key} className={view === key ? "active" : ""} onClick={() => selectView(key)}><Icon /><span>{label}</span></button>)}</nav></main>;
}

