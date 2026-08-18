import { Menu, MoonStar, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { sidebarAriaLabel, toggleSidebar } from "@/lib/sidebarState";

type TopbarProps = {
  view: "dashboard" | "links";
  syncing: boolean;
  lastSync: string | null;
  mobileOpen: boolean;
  onToggleMobile: (next: boolean) => void;
  onSync: () => void;
  ready: boolean;
};

export function Topbar({ view, syncing, lastSync, mobileOpen, onToggleMobile, onSync, ready }: TopbarProps) {
  const { theme, toggleTheme, switchable } = useTheme();
  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="mobile-menu"
          onClick={() => onToggleMobile(toggleSidebar(mobileOpen))}
          aria-label={sidebarAriaLabel(mobileOpen)}
          aria-expanded={mobileOpen}
        >
          <Menu size={22} aria-hidden />
        </button>
        <div className="breadcrumbs">
          <span>الرئيسية</span>
          <span aria-hidden>/</span>
          <strong>{view === "dashboard" ? "الحسابات" : "الروابط المشتركة"}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="sync-state">
          <span className="status-dot" aria-hidden />
          {syncing ? "جارٍ المزامنة" : !ready ? "جارٍ الاتصال" : "متصل"}
          <span className="sync-divider" aria-hidden />
          آخر مزامنة: {lastSync || "—"}
        </div>
        {switchable && toggleTheme && (
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
          >
            {theme === "dark" ? <Sun size={18} aria-hidden /> : <MoonStar size={18} aria-hidden />}
          </button>
        )}
        <Button variant="outline" onClick={onSync} disabled={syncing}>
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} aria-hidden />
          {syncing ? "جارٍ المزامنة" : "مزامنة"}
        </Button>
      </div>
    </header>
  );
}