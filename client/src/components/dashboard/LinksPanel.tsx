import { ArrowLeft, Copy, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
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

export function LinksPanel({ links, onCreate, onOpen, onCopy, onToggle, onRemove, onBack }: LinksPanelProps) {
  return (
    <section className="page-container" aria-label="الروابط المشتركة">
      <div className="page-heading">
        <div>
          <p className="eyebrow">المشاركة</p>
          <h1>الروابط المشتركة</h1>
          <p>عرض وإدارة روابط التقارير للقراءة فقط.</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          العودة إلى الحسابات
        </Button>
      </div>

      <Card className="links-card">
        <div className="links-toolbar">
          <div>
            <h3>الروابط المحفوظة</h3>
            <p>{links.length} رابط</p>
          </div>
          <Button onClick={onCreate}>
            <Plus size={16} aria-hidden />
            إنشاء من الفلاتر الحالية
          </Button>
        </div>

        {links.length === 0 ? (
          <div className="links-empty">
            <Link2 size={28} aria-hidden />
            <h3>لا توجد روابط محفوظة</h3>
            <p>طبّق الفلاتر من صفحة الحسابات ثم أنشئ رابطاً للعرض فقط.</p>
          </div>
        ) : (
          <div className="shared-link-list">
            {links.map((link) => (
              <div className="shared-link-row" key={link.id}>
                <div>
                  <strong>{link.name}</strong>
                  <span className={`link-state ${link.active ? "on" : "off"}`}>
                    {link.active ? "نشط" : "متوقف"}
                  </span>
                </div>
                <div className="row-actions">
                  <button onClick={() => onOpen(link)} aria-label="فتح الرابط في نافذة جديدة" title="فتح">
                    <ExternalLink size={15} aria-hidden />
                  </button>
                  <button onClick={() => onCopy(link)} aria-label="نسخ الرابط" title="نسخ">
                    <Copy size={15} aria-hidden />
                  </button>
                  <span className="link-switch" title={link.active ? "إيقاف الرابط" : "تفعيل الرابط"}>
                    <span className="sr-only">{link.active ? "إيقاف الرابط" : "تفعيل الرابط"}</span>
                    <Switch
                      checked={link.active}
                      onCheckedChange={() => onToggle(link)}
                      aria-label={link.active ? "إيقاف الرابط" : "تفعيل الرابط"}
                    />
                  </span>
                  <button className="danger" onClick={() => onRemove(link)} aria-label="حذف الرابط" title="حذف">
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}