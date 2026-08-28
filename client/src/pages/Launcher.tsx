import { ArrowLeft, MoonStar, Sparkles, Sun, Users, Warehouse } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

export function Launcher() {
  const { theme, toggleTheme, switchable } = useTheme();

  return (
    <main className="launcher-simplified" dir="rtl">
      {/* Top Header */}
      <header className="launcher-nav">
        <div className="system-pill">
          <span className="live-pulse-dot" aria-hidden />
          <span>نظام غدير متصل</span>
        </div>

        {switchable && toggleTheme && (
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
            title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
          >
            {theme === "dark" ? <Sun size={17} className="text-amber-400" aria-hidden /> : <MoonStar size={17} className="text-slate-600" aria-hidden />}
          </button>
        )}
      </header>

      {/* Main Container */}
      <div className="launcher-content">
        <div className="launcher-title-block">
          <div className="launcher-badge-icon">
            <Warehouse size={32} />
          </div>
          <h1>نظام غدير المحاسبي</h1>
        </div>

        {/* 2 Simple Executive Portals */}
        <div className="launcher-portal-grid">
          {/* 1. قسم المذاخر والحسابات */}
          <Link href="/dashboard" className="portal-card is-accounts">
            <div className="portal-card-head">
              <div className="portal-icon-box accounts-icon">
                <Warehouse size={28} />
              </div>
              <span className="portal-tag">القسم الرئيسي</span>
            </div>

            <div className="portal-card-info">
              <h2>قسم المذاخر والحسابات</h2>
              <p>إدارة فواتير المذاخر، متابعة الديون، ونسب التحصيل</p>
            </div>

            <div className="portal-card-action">
              <span>دخول الحسابات</span>
              <div className="portal-arrow">
                <ArrowLeft size={16} />
              </div>
            </div>
          </Link>

          {/* 2. المندوبين */}
          <Link href="/delegates" className="portal-card is-delegates">
            <div className="portal-card-head">
              <div className="portal-icon-box delegates-icon">
                <Users size={28} />
              </div>
              <span className="portal-tag">الميدان</span>
            </div>

            <div className="portal-card-info">
              <h2>المندوبين</h2>
              <p>إدارة المندوبين، خطوط السير، ومتابعة التحصيل الميداني</p>
            </div>

            <div className="portal-card-action">
              <span>دخول المندوبين</span>
              <div className="portal-arrow">
                <ArrowLeft size={16} />
              </div>
            </div>
          </Link>

          {/* 3. لوحة المراقبة الذكية /test */}
          <Link href="/test" className="portal-card col-span-1 md:col-span-2 border-teal-500/30 hover:border-teal-500 transition-all">
            <div className="portal-card-head">
              <div className="portal-icon-box" style={{ background: "rgba(15, 118, 110, 0.15)", color: "#0F766E" }}>
                <Sparkles size={28} />
              </div>
              <span className="portal-tag" style={{ background: "rgba(15, 118, 110, 0.15)", color: "#0F766E" }}>
                لوحة تحكم ذكية
              </span>
            </div>

            <div className="portal-card-info">
              <h2>لوحة المراقبة والتحليل الميداني (/test)</h2>
              <p>مراقبة أداء المبيعات والمحافظات، تحقيق التارغت، ترتيب المندوبين، وجودة البيانات عبر Google Sheets</p>
            </div>

            <div className="portal-card-action">
              <span>دخول لوحة المراقبة (/test)</span>
              <div className="portal-arrow">
                <ArrowLeft size={16} />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}

export default Launcher;
