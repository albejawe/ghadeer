import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { Invoice } from "./types";
import { currency, statusChipClass } from "./types";

export type InvoiceForm = {
  company: string;
  governorate: string;
  warehouse: string;
  number: string;
  createdAt: string;
  amount: string;
  paid: string;
  note: string;
};

type InvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Invoice | null;
  form: InvoiceForm;
  onFormChange: (form: InvoiceForm) => void;
  options: (key: keyof Invoice) => string[];
  onSave: () => void;
  saving?: boolean;
};

const IRAQ_GOVERNORATES = [
  "بغداد",
  "البصرة",
  "نينوى",
  "أربيل",
  "النجف",
  "كربلاء",
  "ميسان",
  "ذي قار",
  "بابل",
  "الأنبار",
  "واسط",
  "القادسية",
  "كركوك",
  "صلاح الدين",
  "ديالى",
  "دهوك",
  "السليمانية",
  "المثنى",
];

export function InvoiceDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  options,
  onSave,
  saving = false,
}: InvoiceDialogProps) {
  const expectedDueAt = form.createdAt
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
        new Date(new Date(form.createdAt).getTime() + 60 * 86400000)
      )
    : "—";
  const amount = Number(form.amount || 0);
  const paid = Number(form.paid || 0);
  const expectedRemaining = Math.max(0, amount - paid);
  const expectedStatus =
    paid >= amount && amount > 0 ? "مسدد" : paid > 0 ? "جزئي" : "غير مسدد";

  // Combine known governorates with existing ones
  const governorateOptions = Array.from(
    new Set([...IRAQ_GOVERNORATES, ...options("governorate")])
  ).filter(Boolean);

  const companyOptions = options("company");
  const warehouseOptions = options("warehouse");

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent dir="rtl" className="invoice-dialog sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {editing ? "تعديل الفاتورة" : "إضافة فاتورة جديدة"}
          </DialogTitle>
        </DialogHeader>

        <div className="dialog-intro text-xs text-muted-foreground">
          {editing
            ? "حدّث بيانات الفاتورة. سيتم تحديث الحسابات والمزامنة تلقائياً."
            : "أدخل بيانات الفاتورة، وسيتم حساب تاريخ الاستحقاق والمتبقي تلقائياً."}
        </div>

        {/* Datalists for autocompletion with full free typing support */}
        <datalist id="company-options">
          {companyOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <datalist id="governorate-options">
          {governorateOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <datalist id="warehouse-options">
          {warehouseOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving) onSave();
          }}
          className="space-y-4"
        >
          <div className="form-grid">
            <label>
              <span>الشركة <strong className="text-red-500">*</strong></span>
              <Input
                list="company-options"
                value={form.company}
                onChange={(e) => onFormChange({ ...form, company: e.target.value })}
                placeholder="اختر أو اكتب اسم الشركة"
                required
                disabled={saving}
              />
            </label>

            <label>
              <span>المحافظة</span>
              <Input
                list="governorate-options"
                value={form.governorate}
                onChange={(e) => onFormChange({ ...form, governorate: e.target.value })}
                placeholder="اختر أو اكتب المحافظة"
                disabled={saving}
              />
            </label>

            <label>
              <span>المذخر</span>
              <Input
                list="warehouse-options"
                value={form.warehouse}
                onChange={(e) => onFormChange({ ...form, warehouse: e.target.value })}
                placeholder="اختر أو اكتب اسم المذخر"
                disabled={saving}
              />
            </label>

            <label>
              <span>رقم الفاتورة <strong className="text-red-500">*</strong></span>
              <Input
                type="text"
                value={form.number}
                onChange={(e) => onFormChange({ ...form, number: e.target.value })}
                placeholder="مثال: 105"
                required
                disabled={saving}
              />
            </label>

            <label>
              <span>تاريخ إنشاء الفاتورة</span>
              <Input
                type="date"
                value={form.createdAt}
                onChange={(e) => onFormChange({ ...form, createdAt: e.target.value })}
                disabled={saving}
              />
            </label>

            <label>
              <span>مبلغ الفاتورة (د.ع) <strong className="text-red-500">*</strong></span>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.amount}
                onChange={(e) => onFormChange({ ...form, amount: e.target.value })}
                placeholder="المبلغ الإجمالي"
                required
                disabled={saving}
              />
            </label>

            <label>
              <span>المدفوع (د.ع)</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.paid}
                onChange={(e) => onFormChange({ ...form, paid: e.target.value })}
                placeholder="المبلغ المدفوع (اختياري)"
                disabled={saving}
              />
            </label>

            <label>
              <span>ملاحظة</span>
              <Input
                type="text"
                value={form.note}
                onChange={(e) => onFormChange({ ...form, note: e.target.value })}
                placeholder="أي ملاحظات إضافية"
                disabled={saving}
              />
            </label>
          </div>

          <div className="computed-preview" aria-label="حقول محسوبة تلقائياً">
            <div>
              <span>تاريخ الاستحقاق (+60 يوم)</span>
              <strong>{expectedDueAt}</strong>
            </div>
            <div>
              <span>المتبقي المتوقع</span>
              <strong>{currency(expectedRemaining)}</strong>
            </div>
            <div>
              <span>الحالة المتوقعة</span>
              <span className={`status-chip ${statusChipClass[expectedStatus as Invoice["status"]] ?? ""}`}>
                {expectedStatus}
              </span>
            </div>
          </div>

          <div className="dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin size-4 ml-1.5" />
                  {editing ? "جاري الحفظ..." : "جاري الإضافة..."}
                </>
              ) : editing ? (
                "حفظ التعديلات"
              ) : (
                "إضافة الفاتورة"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}