import { ChevronDown, LayoutDashboard, Link2, MoreHorizontal, Settings2, ShieldCheck, WalletCards, X } from "lucide-react";
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

export function Sidebar({ view, open, onClose, onNavigate, onSettings, onSecurity, badges }: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="القائمة الجانبية">
      <div className="brand">
        <div className="brand-mark">
          <WalletCards size={22} strokeWidth={2} aria-hidden />
        </div>
        <div>
          <div className="brand-name">حساباتي</div>
          <div className="brand-caption">إدارة الفواتير والديون</div>
        </div>
        <button className="sidebar-close" onClick={onClose} aria-label={sidebarAriaLabel(open)}>
          <X size={18} />
        </button>
      </div>

      <div className="workspace-chip">
        <span className="status-dot" aria-hidden />
        مساحة العمل الرئيسية
        <ChevronDown size={15} aria-hidden />
      </div>

      <nav className="sidebar-nav">
        <p className="nav-overline">القائمة الرئيسية</p>
        <button
          className={`nav-item ${view === "dashboard" ? "active" : ""}`}
          aria-current={view === "dashboard" ? "page" : undefined}
          onClick={() => onNavigate("dashboard")}
        >
          <LayoutDashboard size={18} aria-hidden />
          الحسابات
          <span className="nav-badge" aria-label={`${badges?.invoices ?? 0} فاتورة`}>
            {badges?.invoices ?? 0}
          </span>
        </button>
        <button
          className={`nav-item ${view === "links" ? "active" : ""}`}
          aria-current={view === "links" ? "page" : undefined}
          onClick={() => onNavigate("links")}
        >
          <Link2 size={18} aria-hidden />
          الروابط المشتركة
          <span className="nav-badge" aria-label={`${badges?.links ?? 0} رابط`}>
            {badges?.links ?? 0}
          </span>
        </button>

        <p className="nav-overline">الإعدادات</p>
        <button className="nav-item" onClick={onSettings}>
          <Settings2 size={18} aria-hidden />
          إعدادات المزامنة
        </button>
        <button className="nav-item" onClick={onSecurity}>
          <ShieldCheck size={18} aria-hidden />
          تغيير كلمة السر
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-avatar">غ</div>
        <div className="min-w-0">
          <div className="user-name">غدير عبد علي</div>
          <div className="user-role">مدير الحسابات</div>
        </div>
        <MoreHorizontal size={18} className="mr-auto text-slate-400" aria-hidden />
      </div>
    </aside>
  );
}