import { Card } from "@/components/ui/card";
import { ArrowUpRight, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { currency } from "./types";

type StatCardProps = {
  title: string;
  value: number | null;
  hint: string;
  icon: typeof WalletCards;
  tone: "blue" | "green" | "amber" | "red";
  loading: boolean;
  progress?: number;
  variant?: "bar" | "ring";
  trend?: string;
};

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
  progress,
  variant = "bar",
  trend,
}: StatCardProps) {
  const rate = typeof progress === "number" ? Math.round(Math.min(100, Math.max(0, progress))) : null;
  const radius = 24;
  const ringLength = 2 * Math.PI * radius;

  return (
    <Card className={`stat-card group tone-${tone}`} aria-label={title}>
      {/* Background tone glow */}
      <div className="stat-glow-bg" aria-hidden />

      <div className="stat-header">
        <div className={`stat-icon-badge ${tone}`}>
          <Icon size={20} strokeWidth={2.2} aria-hidden />
        </div>
        {rate !== null && variant === "ring" ? (
          <div className="stat-ring-wrapper" role="img" aria-label={`نسبة ${title}: ${rate}%`}>
            <svg viewBox="0 0 60 60" width="52" height="52" aria-hidden="true">
              <circle className="ring-track" cx="30" cy="30" r={radius} fill="none" strokeWidth="6" />
              <circle
                className="ring-fill"
                cx="30"
                cy="30"
                r={radius}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={ringLength}
                strokeDashoffset={ringLength * (1 - rate / 100)}
                transform="rotate(-90 30 30)"
              />
            </svg>
            <strong className="ring-number tabular">{rate}%</strong>
          </div>
        ) : trend ? (
          <span className="stat-trend-pill">
            <ArrowUpRight size={13} aria-hidden />
            {trend}
          </span>
        ) : null}
      </div>

      <div className="stat-body">
        <p className="stat-label">{title}</p>
        <h3 className="stat-value tabular truncate">
          {loading ? "—" : currency(value ?? 0)}
        </h3>

        {rate !== null && variant === "bar" && (
          <div
            className="stat-progress-bar"
            role="progressbar"
            aria-valuenow={rate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`نسبة ${title}`}
          >
            <div className="progress-fill" style={{ width: `${rate}%` }} />
          </div>
        )}

        <div className="stat-footer-hint">
          <span className="hint-text">{hint}</span>
          {rate !== null && variant === "bar" && (
            <span className="hint-percent tabular font-bold">{rate}%</span>
          )}
        </div>
      </div>
    </Card>
  );
}