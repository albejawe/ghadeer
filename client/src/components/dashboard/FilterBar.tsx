import { useState } from "react";
import {
  BadgeCheck,
  Building2,
  Calendar,
  ChevronDown,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { normalizeSelectOptions } from "@shared/invoiceLogic";
import type { Invoice } from "./types";

const QUICK_OPTIONS: { label: string; tone?: string }[] = [
  { label: "الكل" },
  { label: "المستحق الآن", tone: "tone-urgent" },
  { label: "غير مسدد", tone: "tone-due" },
  { label: "جزئي", tone: "tone-partial" },
  { label: "مسدد", tone: "tone-paid" },
];

type FilterField = "company" | "governorate" | "warehouse" | "status";

type FilterBarProps = {
  invoices: Invoice[];
  resultCount: number;
  search: string;
  company: string;
  governorate: string;
  warehouse: string;
  status: string;
  quick: string;
  dueFrom: string;
  dueTo: string;
  amountMin: string;
  amountMax: string;
  onSearch: (value: string) => void;
  onCompany: (value: string) => void;
  onGovernorate: (value: string) => void;
  onWarehouse: (value: string) => void;
  onStatus: (value: string) => void;
  onQuick: (value: string) => void;
  onDueFrom: (value: string) => void;
  onDueTo: (value: string) => void;
  onAmountMin: (value: string) => void;
  onAmountMax: (value: string) => void;
  onReset: () => void;
};

export function FilterBar({
  invoices,
  resultCount,
  search,
  company,
  governorate,
  warehouse,
  status,
  quick,
  dueFrom,
  dueTo,
  amountMin,
  amountMax,
  onSearch,
  onCompany,
  onGovernorate,
  onWarehouse,
  onStatus,
  onQuick,
  onDueFrom,
  onDueTo,
  onAmountMin,
  onAmountMax,
  onReset,
}: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(Boolean(dueFrom || dueTo || amountMin || amountMax));

  const optionsFor = (key: FilterField) =>
    normalizeSelectOptions(invoices.map((item) => item[key]));

  const fields: {
    label: string;
    value: string;
    setter: (v: string) => void;
    key: FilterField;
    icon: typeof Building2;
  }[] = [
    { label: "الشركة", value: company, setter: onCompany, key: "company", icon: Building2 },
    { label: "المحافظة", value: governorate, setter: onGovernorate, key: "governorate", icon: MapPin },
    { label: "المذخر", value: warehouse, setter: onWarehouse, key: "warehouse", icon: Warehouse },
    { label: "الحالة", value: status, setter: onStatus, key: "status", icon: BadgeCheck },
  ];

  const activeCount = [
    company !== "الكل",
    governorate !== "الكل",
    warehouse !== "الكل",
    status !== "الكل",
    quick !== "الكل",
    Boolean(search),
    Boolean(dueFrom),
    Boolean(dueTo),
    Boolean(amountMin),
    Boolean(amountMax),
  ].filter(Boolean).length;

  return (
    <div className="filter-card" dir="rtl">
      {/* Top Header: Quick Segments + Results Counter & Controls */}
      <div className="filter-top-row">
        {/* Quick status tabs */}
        <div className="quick-segments" role="group" aria-label="فلاتر سريعة">
          {QUICK_OPTIONS.map(({ label, tone }) => {
            const isSelected = quick === label;
            return (
              <button
                key={label}
                type="button"
                className={`quick-pill ${isSelected ? "is-selected" : ""} ${tone || ""}`}
                aria-pressed={isSelected}
                onClick={() => onQuick(label)}
              >
                {tone && <span className="pill-dot" aria-hidden />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Results Badge + Advanced Toggle */}
        <div className="filter-meta-actions">
          <div className="results-badge">
            <strong className="results-num">{resultCount}</strong>
            <span className="results-text">فاتورة مطابقة</span>
          </div>

          <Button
            type="button"
            variant={showAdvanced ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`advanced-toggle-btn h-9 text-xs font-bold gap-1.5 ${showAdvanced ? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400" : ""}`}
          >
            <SlidersHorizontal size={14} aria-hidden />
            <span>نطاقات متقدمة</span>
            {(dueFrom || dueTo || amountMin || amountMax) && (
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-0.5" aria-hidden />
            )}
          </Button>

          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 text-xs font-bold text-destructive hover:bg-destructive/10 gap-1"
              title="إعادة ضبط جميع الفلاتر"
            >
              <RefreshCw size={12} aria-hidden />
              <span>مسح الفلاتر ({activeCount})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Filter Row: Search Input + 4 Filter Dropdowns */}
      <div className="filter-main-grid">
        {/* Quick Search */}
        <div className="search-box">
          <Search size={15} className="search-icon text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="بحث سريع برقم الفاتورة..."
            aria-label="البحث برقم الفاتورة"
            className="search-input text-xs font-semibold h-10"
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearch("")}
              aria-label="مسح البحث"
              title="مسح البحث"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>

        {/* 4 Dropdowns */}
        <div className="dropdown-filters-row">
          {fields.map((field) => {
            const isActive = field.value && field.value !== "الكل";
            return (
              <div key={field.key} className={`filter-select-wrapper ${isActive ? "is-active" : ""}`}>
                <Select value={field.value} onValueChange={field.setter}>
                  <SelectTrigger className="filter-select-trigger h-10" aria-label={`فلترة حسب ${field.label}`}>
                    <field.icon size={13} className="trigger-icon text-muted-foreground shrink-0" aria-hidden />
                    <div className="trigger-text">
                      <span className="trigger-label">{field.label}:</span>
                      <span className="trigger-val">{isActive ? field.value : "الكل"}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="filter-select-content" align="end">
                    <SelectItem value="الكل">الكل ({field.label})</SelectItem>
                    {optionsFor(field.key).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible Advanced Filter Ranges Drawer */}
      {showAdvanced && (
        <div className="advanced-ranges-panel">
          <div className="range-item">
            <span className="range-title">
              <Calendar size={14} className="text-teal-500" aria-hidden />
              <span>تاريخ الاستحقاق:</span>
            </span>
            <div className="range-inputs">
              <Input
                type="date"
                value={dueFrom}
                onChange={(e) => onDueFrom(e.target.value)}
                placeholder="من تاريخ"
                className="range-input"
              />
              <span className="range-arrow">←</span>
              <Input
                type="date"
                value={dueTo}
                onChange={(e) => onDueTo(e.target.value)}
                placeholder="إلى تاريخ"
                className="range-input"
              />
            </div>
          </div>

          <div className="range-item">
            <span className="range-title">
              <Wallet size={14} className="text-amber-500" aria-hidden />
              <span>مبلغ الفاتورة (د.ع):</span>
            </span>
            <div className="range-inputs">
              <Input
                type="number"
                min={0}
                value={amountMin}
                onChange={(e) => onAmountMin(e.target.value)}
                placeholder="الحد الأدنى"
                className="range-input"
              />
              <span className="range-arrow">←</span>
              <Input
                type="number"
                min={0}
                value={amountMax}
                onChange={(e) => onAmountMax(e.target.value)}
                placeholder="الحد الأقصى"
                className="range-input"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}