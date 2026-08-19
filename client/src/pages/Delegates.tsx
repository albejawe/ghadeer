import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { currency } from "@/components/dashboard/types";

type DelegateRecord = {
  id: string;
  name: string;
  phone: string;
  governorates: string[];
  warehousesCount: number;
  monthlyTarget: number;
  collectedAmount: number;
  status: "نشط" | "في جولة" | "إجازة";
};

const SAMPLE_DELEGATES: DelegateRecord[] = [
  {
    id: "del-1",
    name: "علي حسين العبيدي",
    phone: "07701234567",
    governorates: ["بغداد", "ديالى"],
    warehousesCount: 14,
    monthlyTarget: 35000000,
    collectedAmount: 28400000,
    status: "نشط",
  },
  {
    id: "del-2",
    name: "حيدر كاظم الشمري",
    phone: "07809876543",
    governorates: ["البصرة", "ميسان", "ذي قار"],
    warehousesCount: 22,
    monthlyTarget: 50000000,
    collectedAmount: 46200000,
    status: "في جولة",
  },
  {
    id: "del-3",
    name: "عمر فاروق الحديثي",
    phone: "07715554433",
    governorates: ["الأنبار", "صلاح الدين"],
    warehousesCount: 11,
    monthlyTarget: 25000000,
    collectedAmount: 14800000,
    status: "نشط",
  },
  {
    id: "del-4",
    name: "مصطفى جبار الربيعي",
    phone: "07503332211",
    governorates: ["أربيل", "السليمانية", "دهوك"],
    warehousesCount: 18,
    monthlyTarget: 40000000,
    collectedAmount: 31500000,
    status: "نشط",
  },
];

export function Delegates() {
  const [search, setSearch] = useState("");
  const [delegates] = useState<DelegateRecord[]>(SAMPLE_DELEGATES);

  const filtered = delegates.filter(
    (d) =>
      d.name.includes(search) ||
      d.phone.includes(search) ||
      d.governorates.some((g) => g.includes(search))
  );

  const totalTarget = delegates.reduce((sum, d) => sum + d.monthlyTarget, 0);
  const totalCollected = delegates.reduce((sum, d) => sum + d.collectedAmount, 0);
  const collectionRate = Math.round((totalCollected / totalTarget) * 100);

  return (
    <main className="delegates-page" dir="rtl">
      {/* Top Header */}
      <div className="delegates-head">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="section-pill">
              <Users size={13} className="text-teal-600 dark:text-teal-400" />
              المتابعة الميدانية
            </span>
            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Sparkles size={11} /> تجريبي نشط
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black">إدارة المندوبين والمتابعة الميدانية</h1>
          <p className="text-sm text-muted-foreground mt-1">
            متابعة مسارات التوزيع والتحصيل الميداني، حساب العمولات، وتتبع الأهداف الشهرية لكل مندوب.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="btn-outline-link">
            <ArrowRight size={16} className="ml-1.5" />
            الحسابات والمذاخر
          </Link>
          <Button className="btn-primary">
            <Plus size={16} className="ml-1.5" />
            إضافة مندوب جديد
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="delegates-kpi-grid">
        <Card className="delegates-kpi-card">
          <div className="kpi-icon-wrap bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
            <Users size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">إجمالي المندوبين</span>
            <h3 className="kpi-value tabular">{delegates.length} مندوب</h3>
            <span className="kpi-hint">3 في الميدان حالياً</span>
          </div>
        </Card>

        <Card className="delegates-kpi-card">
          <div className="kpi-icon-wrap bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            <Target size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">هدف التحصيل الشهري</span>
            <h3 className="kpi-value tabular">{currency(totalTarget)}</h3>
            <span className="kpi-hint text-emerald-600 dark:text-emerald-400">
              نسبة الإنجاز {collectionRate}%
            </span>
          </div>
        </Card>

        <Card className="delegates-kpi-card">
          <div className="kpi-icon-wrap bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">المحصل الفعلي</span>
            <h3 className="kpi-value tabular text-teal-600 dark:text-teal-400">
              {currency(totalCollected)}
            </h3>
            <span className="kpi-hint">المتبقي: {currency(totalTarget - totalCollected)}</span>
          </div>
        </Card>
      </div>

      {/* Delegates Directory */}
      <Card className="delegates-directory-card">
        <div className="directory-toolbar">
          <div>
            <h3 className="text-lg font-bold">دليل المندوبين والمناطق</h3>
            <p className="text-xs text-muted-foreground">
              سجل خطوط التوزيع والمحافظات الموكلة لكل مندوب
            </p>
          </div>

          <div className="search-box max-w-xs">
            <Search size={15} className="search-icon" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو المحافظة أو الهاتف..."
              className="search-input text-xs"
            />
          </div>
        </div>

        <div className="delegates-grid">
          {filtered.map((delegate) => {
            const pct = Math.round((delegate.collectedAmount / delegate.monthlyTarget) * 100);
            return (
              <div key={delegate.id} className="delegate-card">
                <div className="delegate-card-head">
                  <div className="flex items-center gap-2.5">
                    <div className="delegate-avatar">
                      {delegate.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-base">{delegate.name}</h4>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone size={11} /> {delegate.phone}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`status-chip ${
                      delegate.status === "نشط"
                        ? "tone-paid"
                        : delegate.status === "في جولة"
                        ? "tone-partial"
                        : "tone-due"
                    }`}
                  >
                    <span className="chip-dot" />
                    {delegate.status}
                  </span>
                </div>

                {/* Governorates badges */}
                <div className="delegate-gov-list">
                  {delegate.governorates.map((gov) => (
                    <span key={gov} className="gov-tag">
                      <MapPin size={11} />
                      {gov}
                    </span>
                  ))}
                  <span className="gov-tag is-muted">
                    <Building2 size={11} /> {delegate.warehousesCount} مذخر
                  </span>
                </div>

                {/* Collection Target Progress */}
                <div className="delegate-progress-block">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">نسبة تحصيل الهدف:</span>
                    <strong className="tabular font-bold">{pct}%</strong>
                  </div>
                  <div className="progress-bar-wrap">
                    <div
                      className={`progress-fill ${pct >= 80 ? "bg-emerald-500" : "bg-teal-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1 tabular">
                    <span>المحصل: {currency(delegate.collectedAmount)}</span>
                    <span>الهدف: {currency(delegate.monthlyTarget)}</span>
                  </div>
                </div>

                <div className="delegate-card-actions">
                  <Button variant="outline" size="sm" className="w-full">
                    <Phone size={13} className="ml-1" />
                    اتصال بالمندوب
                  </Button>
                  <Button variant="secondary" size="sm" className="w-full">
                    كشف الحسابات
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
export default Delegates;
