import { Menu, MoonStar, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { sidebarAriaLabel, toggleSidebar } from "@/lib/sidebarState";
import { NotificationCenter } from "./NotificationCenter";
import { PwaInstallHeaderButton } from "./PwaInstallBanner";
import type { Invoice } from "./types";

type TopbarProps = {
  view: "dashboard" | "links";
  syncing: boolean;
  lastSync: string | null;
  mobileOpen: boolean;
  onToggleMobile: (next: boolean) => void;
  onSync: () => void;
  ready: boolean;
  invoices?: Invoice[];
  onSelectInvoice?: (invoice: Invoice) => void;
  onFilterDueOnly?: () => void;
};

export function Topbar({
  syncing,
  lastSync,
  mobileOpen,
  onToggleMobile,
  onSync,
  ready,
  invoices = [],
  onSelectInvoice,
  onFilterDueOnly,
}: TopbarProps) {
  const { theme, toggleTheme, switchable } = useTheme();

  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button
          className="mobile-menu"
          onClick={() => onToggleMobile(toggleSidebar(mobileOpen))}
          aria-label={sidebarAriaLabel(mobileOpen)}
          aria-expanded={mobileOpen}
        >
          <Menu size={20} aria-hidden />
        </button>
      </div>

      <div className="topbar-actions">
        {/* PWA Install Button (Desktop Only) */}
        <div className="hidden md:block">
          <PwaInstallHeaderButton />
        </div>

        {/* Live sync pill */}
        <div
          className={`sync-pill ${syncing ? "is-syncing" : ready ? "is-ready" : "is-connecting"}`}
          title={lastSync ? `آخر تحديث: ${lastSync}` : "حالة الاتصال"}
        >
          <span className="pulse-indicator" aria-hidden />
          <span className="sync-text hidden sm:inline">
            {syncing ? "مزامنة..." : !ready ? "اتصال..." : "متصل"}
          </span>
        </div>

        {/* Notification Bell Center */}
        <NotificationCenter
          invoices={invoices}
          onSelectInvoice={onSelectInvoice}
          onFilterDueOnly={onFilterDueOnly}
        />

        {/* Theme Toggle */}
        {switchable && toggleTheme && (
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
            title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
          >
            {theme === "dark" ? (
              <Sun size={16} className="text-amber-400" aria-hidden />
            ) : (
              <MoonStar size={16} className="text-slate-600" aria-hidden />
            )}
          </button>
        )}

        {/* Sync Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          className="sync-action-btn h-8 px-2.5 sm:px-3 text-xs"
          title="تحديث البيانات من السيرفر"
        >
          <RefreshCw size={13} className={syncing ? "animate-spin text-teal-500" : ""} aria-hidden />
          <span className="hidden sm:inline">{syncing ? "تحديث..." : "تحديث"}</span>
        </Button>
      </div>
    </header>
  );
}