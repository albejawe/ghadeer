import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  Globe2,
  Link2,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { SharedLink } from "./types";

type LinksPanelProps = {
  links: SharedLink[];
  onCreate: () => void;
  onOpen: (link: SharedLink) => void;
  onCopy: (link: SharedLink) => void;
  onToggle: (link: SharedLink) => void;
  onRemove: (link: SharedLink) => void;
  onBack: () => void;
};

export function LinksPanel({
  links,
  onCreate,
  onOpen,
  onCopy,
  onToggle,
  onRemove,
  onBack,
}: LinksPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (link: SharedLink) => {
    onCopy(link);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <section className="page-container" aria-label="الروابط المشتركة" dir="rtl">
      {/* Page Header */}
      <div className="page-heading">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="section-pill">
              <Globe2 size={13} className="text-teal-600 dark:text-teal-400" />
              مشاركة التقارير
            </span>
          </div>
          <h1 className="text-2xl font-black">الروابط العامة المشتركة</h1>
          <p className="text-sm text-muted-foreground">
            توليد وإدارة روابط تقارير سحابية مباشرة للقراءة والطباعة للمذاخر والعملاء بدون الحاجة لتسجيل دخول.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowRight size={16} className="ml-1.5" aria-hidden />
            العودة إلى الحسابات
          </Button>
          <Button onClick={onCreate} className="btn-primary">
            <Plus size={16} className="ml-1.5" aria-hidden />
            إنشاء رابط بالفلاتر الحالية
          </Button>
        </div>
      </div>

      {/* Main Links Grid Card */}
      <Card className="links-card">
        <div className="links-toolbar">
          <div>
            <h3 className="text-lg font-bold">الروابط المشتركة النشطة</h3>
            <p className="text-xs text-muted-foreground">
              يتم تحديث بيانات هذه الروابط تلقائياً عند مزامنة الحسابات
            </p>
          </div>
          <span className="links-count-badge">
            {links.length} {links.length === 1 ? "رابط" : "روابط"}
          </span>
        </div>

        {links.length === 0 ? (
          <div className="links-empty-state">
            <div className="links-empty-icon">
              <Link2 size={36} aria-hidden />
            </div>
            <h3 className="text-lg font-bold">لا توجد روابط مشاركة بعد</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              اختر الفلاتر المطلوبة من صفحة الحسابات (مثل شركة معينة أو حالة معينة)، ثم انقر على "إنشاء رابط" لمشاركة التقرير مع المذخر أو المحاسب.
            </p>
            <Button onClick={onCreate} className="mt-3">
              <Plus size={16} className="ml-1.5" />
              إنشاء أول رابط مشاركة
            </Button>
          </div>
        ) : (
          <div className="shared-links-grid">
            {links.map((link) => {
              const isCopied = copiedId === link.id;
              const hasFilters = Boolean(
                link.filters?.company ||
                  link.filters?.warehouse ||
                  link.filters?.governorate ||
                  link.filters?.status
              );

              return (
                <div key={link.id} className={`link-item-card ${link.active ? "is-active" : "is-inactive"}`}>
                  <div className="link-item-top">
                    <div className="flex items-center gap-2">
                      <div className={`link-icon-circle ${link.active ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400" : "bg-muted text-muted-foreground"}`}>
                        <Link2 size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-base">{link.name}</h4>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock size={11} />
                          معرّف الرابط: {link.id.slice(0, 10)}...
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`link-status-badge ${link.active ? "status-on" : "status-off"}`}>
                        <span className="status-dot" />
                        {link.active ? "نشط" : "معطل"}
                      </span>
                      <Switch
                        checked={link.active}
                        onCheckedChange={() => onToggle(link)}
                        aria-label={link.active ? "إيقاف الرابط" : "تفعيل الرابط"}
                        title={link.active ? "إيقاف الرابط" : "تفعيل الرابط"}
                      />
                    </div>
                  </div>

                  {/* Filter tags attached to link */}
                  {hasFilters && (
                    <div className="link-filters-row">
                      <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                        <Filter size={10} /> الفلاتر المطبقة:
                      </span>
                      {link.filters?.company && link.filters.company !== "الكل" && (
                        <span className="filter-tag">شركة: {link.filters.company}</span>
                      )}
                      {link.filters?.warehouse && link.filters.warehouse !== "الكل" && (
                        <span className="filter-tag">مذخر: {link.filters.warehouse}</span>
                      )}
                      {link.filters?.governorate && link.filters.governorate !== "الكل" && (
                        <span className="filter-tag">محافظة: {link.filters.governorate}</span>
                      )}
                      {link.filters?.status && link.filters.status !== "الكل" && (
                        <span className="filter-tag">حالة: {link.filters.status}</span>
                      )}
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="link-actions-footer">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCopy(link)}
                        className="copy-link-btn"
                        title="نسخ الرابط للحافظة"
                      >
                        {isCopied ? (
                          <>
                            <Check size={14} className="text-emerald-500 ml-1" />
                            <span className="text-emerald-600 font-bold">تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} className="ml-1" />
                            <span>نسخ الرابط</span>
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpen(link)}
                        title="فتح ومعاينة صفحة التقرير"
                      >
                        <ExternalLink size={14} className="ml-1" />
                        <span>معاينة</span>
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(link)}
                      className="text-destructive hover:bg-destructive/10"
                      title="حذف هذا الرابط"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}