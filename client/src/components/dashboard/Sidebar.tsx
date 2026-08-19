import {
  ChevronLeft,
  ChevronDown,
  LayoutDashboard,
  Link2,
  LogOut,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  Users,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { sidebarAriaLabel } from "@/lib/sidebarState";

type SidebarProps = {
  view: "dashboard" | "links";
  open: boolean;
  onClose: () => void;
  onNavigate: (view: "dashboard" | "links") => void;
  onSettings: () => void;
  onSecurity: () => void;
  badges?: { invoices?: number; links?: number };
};

export function Sidebar({
  view,
  open,
  onClose,
  onNavigate,
  onSettings,
  onSecurity,
  badges,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="القائمة الجانبية" dir="rtl">
      {/* Brand area */}
      <div className="brand">
        <Link href="/" className="brand-link" title="العودة لبوابة التطبيقات">
          <div className="brand-mark">
            <Warehouse size={22} strokeWidth={2.2} aria-hidden />
          </div>
          <div className="brand-info">
            <div className="brand-name">نظام غدير</div>
            <div className="brand-caption">إدارة الفواتير والديون</div>
          </div>
        </Link>
        <button
          className="sidebar-close"
          onClick={onClose}
          aria-label={sidebarAriaLabel(open)}
        >
          <X size={18} />
        </button>
      </div>

      {/* Workspace Indicator */}
      <div className="workspace-card">
        <div className="workspace-dot" aria-hidden />
        <div className="workspace-text">
          <span className="workspace-label">مساحة العمل</span>
          <span className="workspace-title">مستودع المذاخر العام</span>
        </div>
        <span className="workspace-tag">نشط</span>
      </div>

      {/* Navigation list */}
      <nav className="sidebar-nav">
        <p className="nav-group-title">الأقسام والخدمات</p>

        <button
          className={`nav-item ${view === "dashboard" ? "active" : ""}`}
          aria-current={view === "dashboard" ? "page" : undefined}
          onClick={() => onNavigate("dashboard")}
        >
          <div className="nav-icon-wrap">
            <LayoutDashboard size={18} aria-hidden />
          </div>
          <span className="nav-label">الحسابات والمذاخر</span>
          <span className="nav-badge" aria-label={`${badges?.invoices ?? 0} فاتورة`}>
            {badges?.invoices ?? 0}
          </span>
        </button>

        <button
          className={`nav-item ${view === "links" ? "active" : ""}`}
          aria-current={view === "links" ? "page" : undefined}
          onClick={() => onNavigate("links")}
        >
          <div className="nav-icon-wrap">
            <Link2 size={18} aria-hidden />
          </div>
          <span className="nav-label">الروابط المشتركة</span>
          <span className="nav-badge" aria-label={`${badges?.links ?? 0} رابط`}>
            {badges?.links ?? 0}
          </span>
        </button>

        <Link href="/delegates" className="nav-item">
          <div className="nav-icon-wrap">
            <Users size={18} aria-hidden />
          </div>
          <span className="nav-label">المندوبين والميدان</span>
          <span className="nav-chip-soon">جديد</span>
        </Link>

        <p className="nav-group-title">أدوات النظام</p>

        <button className="nav-item" onClick={onSettings}>
          <div className="nav-icon-wrap">
            <Settings2 size={18} aria-hidden />
          </div>
          <span className="nav-label">إعدادات المزامنة</span>
        </button>

        <button className="nav-item" onClick={onSecurity}>
          <div className="nav-icon-wrap">
            <ShieldCheck size={18} aria-hidden />
          </div>
          <span className="nav-label">حماية الحساب</span>
        </button>
      </nav>

      {/* User Profile Footer */}
      <div className="sidebar-footer">
        <div className="user-avatar-badge">
          <span>غ</span>
          <span className="user-status-dot" aria-hidden />
        </div>
        <div className="user-meta">
          <div className="user-name">غدير عبد علي</div>
          <div className="user-role">المدير المالي المعتمد</div>
        </div>
        <Link href="/" className="sidebar-exit-btn" title="الخروج إلى البوابة">
          <LogOut size={16} aria-hidden />
        </Link>
      </div>
    </aside>
  );
}