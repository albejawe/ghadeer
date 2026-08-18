import { Card } from "@/components/ui/card";
import { WalletCards } from "lucide-react";
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
};

export function StatCard({ title, value, hint, icon: Icon, tone, loading, progress, variant = "bar" }: StatCardProps) {
  const rate = typeof progress === "number" ? Math.round(Math.min(100, Math.max(0, progress))) : null;
  const ringLength = 2 * Math.PI * 26;
  return (
    <Card className={`stat-card group tone-${tone}`} aria-label={title}>
      <div className={`stat-icon ${tone}`}>
        <Icon size={20} strokeWidth={1.9} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="stat-label">{title}</p>
        <p className="stat-value tabular truncate grad">{loading ? "—" : currency(value ?? 0)}</p>
        {rate !== null && variant === "bar" && (
          <div
            className="stat-progress"
            role="progressbar"
            aria-valuenow={rate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`نسبة ${title}`}
          >
            <span style={{ width: `${rate}%` }} />
          </div>
        )}
        <p className="stat-hint">{hint}</p>
      </div>
      {rate !== null && variant === "ring" && (
        <div className="stat-ring" role="img" aria-label={`نسبة ${title}: ${rate}%`}>
          <svg viewBox="0 0 64 64" width="62" height="62" aria-hidden="true">
            <circle className="ring-track" cx="32" cy="32" r="26" fill="none" strokeWidth="7" />
            <circle
              className="ring-fill"
              cx="32"
              cy="32"
              r="26"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={ringLength}
              strokeDashoffset={ringLength * (1 - rate / 100)}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <strong className="tabular">{rate}%</strong>
        </div>
      )}
    </Card>
  );
}