import { useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  WalletCards,
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

const QUICK_OPTIONS = ["الكل", "المستحق الآن", "غير مسدد", "جزئي", "مسدد"] as const;

type FilterField = "company" | "governorate" | "warehouse" | "status";

const STATUS_DOTS: Record<string, string> = {
  "مسدد": "opt-dot tone-paid",
  "غير مسدد": "opt-dot tone-due",
  "جزئي": "opt-dot tone-partial",
  "المستحق الآن": "opt-dot tone-urgent",
};

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
  const [openField, setOpenField] = useState<FilterField | null>(null);

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
    { label: "حالة التسديد", value: status, setter: onStatus, key: "status", icon: BadgeCheck },
  ];

  return (
    <div className="filter-card">
      <div className="filter-header">
        <div className="section-title">
          <Filter aria-hidden />
          <div>
            <h3>الفلاتر</h3>
          </div>
          <span className="result-chip">النتائج: {resultCount}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RefreshCw size={15} aria-hidden />
          إعادة ضبط
        </Button>
      </div>

      <div className="filter-grid">
        <div className="search-field">
          <span className="search-ico">
            <Search size={16} aria-hidden />
          </span>
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="البحث برقم الفاتورة"
            aria-label="البحث برقم الفاتورة"
          />
          {search ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => onSearch("")}
              aria-label="مسح البحث"
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>

        {fields.map((field) => {
          const active = field.value && field.value !== "الكل";
          return (
            <div
              key={field.key}
              className={`field${active ? " is-active" : ""}${
                openField === field.key ? " is-open" : ""
              }`}
            >
              <Select
                value={field.value}
                onValueChange={field.setter}
                onOpenChange={(open) => setOpenField(open ? field.key : null)}
              >
                <SelectTrigger className="field-trigger" aria-label={`فلترة حسب ${field.label}`}>
                  <span className="field-ico">
                    <field.icon size={15} aria-hidden />
                  </span>
                  <span className="field-text">
                    <span className="field-label">{field.label}</span>
                    <span className="field-value">{active ? field.value : "عرض الكل"}</span>
                  </span>
                </SelectTrigger>
                <SelectContent className="menu" align="end">
                  <p className="menu-head">
                    <span className="menu-head-ico">
                      <field.icon size={14} aria-hidden />
                    </span>
                    اختيار {field.label}
                  </p>
                  <SelectItem value="الكل">عرض الكل</SelectItem>
                  {optionsFor(field.key).map((option) => (
<SelectItem key={option} value={option}>
                  {field.key === "status" && (
                    <span className={STATUS_DOTS[option] ?? "opt-dot"} aria-hidden />
                  )}
                  {option}
                </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="filter-ranges">
        <div className="range-group">
          <span className="range-label">
            <CalendarDays size={13} aria-hidden />
            تاريخ الاستحقاق (من – إلى)
          </span>
          <div className="range-fields">
            <Input
              type="date"
              value={dueFrom}
              onChange={(e) => onDueFrom(e.target.value)}
              aria-label="تاريخ الاستحقاق من"
            />
            <span className="range-sep" aria-hidden>
              ←
            </span>
            <Input
              type="date"
              value={dueTo}
              onChange={(e) => onDueTo(e.target.value)}
              aria-label="تاريخ الاستحقاق إلى"
            />
          </div>
        </div>
        <div className="range-group">
          <span className="range-label">
            <WalletCards size={13} aria-hidden />
            مبلغ الفاتورة (من – إلى)
          </span>
          <div className="range-fields">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={amountMin}
              onChange={(e) => onAmountMin(e.target.value)}
              placeholder="الحد الأدنى"
              aria-label="المبلغ من"
            />
            <span className="range-sep" aria-hidden>
              ←
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={amountMax}
              onChange={(e) => onAmountMax(e.target.value)}
              placeholder="الحد الأقصى"
              aria-label="المبلغ إلى"
            />
          </div>
        </div>
      </div>

      <div className="quick-segment" role="group" aria-label="فلاتر سريعة">
        {QUICK_OPTIONS.map((item) => (
          <button
            key={item}
            className={quick === item ? "selected" : ""}
            aria-pressed={quick === item}
            onClick={() => onQuick(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}