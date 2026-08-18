import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
};

const FORM_FIELDS: { label: string; key: "number" | "createdAt" | "amount" | "paid" | "note" }[] = [
  { label: "رقم الفاتورة", key: "number" },
  { label: "تاريخ إنشاء الفاتورة", key: "createdAt" },
  { label: "مبلغ الفاتورة", key: "amount" },
  { label: "المدفوع", key: "paid" },
  { label: "ملاحظة", key: "note" },
];

export function InvoiceDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  options,
  onSave,
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

  const selectField = (label: string, value: string, onChange: (v: string) => void, key: keyof Invoice, placeholder: string) => (
    <label>
      {label}
      <Select value={value || "__empty"} onValueChange={(next) => onChange(next === "__empty" ? "" : next)}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty">{placeholder}</SelectItem>
          {options(key).map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="invoice-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل الفاتورة" : "إضافة فاتورة جديدة"}</DialogTitle>
        </DialogHeader>
        <div className="dialog-intro">
          {editing
            ? "حدّث بيانات الفاتورة. تاريخ الاستحقاق والمتبقي والحالة تُحسب تلقائياً في Google Sheets."
            : "أدخل البيانات الأساسية، وسيتم حساب الحقول المشتقة تلقائياً."}
        </div>

        <div className="form-grid">
          {selectField("الشركة", form.company, (v) => onFormChange({ ...form, company: v }), "company", "اختر الشركة")}
          {selectField("المحافظة", form.governorate, (v) => onFormChange({ ...form, governorate: v }), "governorate", "اختر المحافظة")}
          {selectField("المذخر", form.warehouse, (v) => onFormChange({ ...form, warehouse: v }), "warehouse", "اختر المذخر")}
          {FORM_FIELDS.map(({ label, key }) => (
            <label key={key}>
              {label}
              <Input
                type={key === "createdAt" ? "date" : key === "amount" || key === "paid" ? "number" : "text"}
                min={key === "amount" || key === "paid" ? 0 : undefined}
                value={form[key]}
                onChange={(e) => onFormChange({ ...form, [key]: e.target.value })}
                placeholder={label}
              />
            </label>
          ))}
        </div>

        <div className="computed-preview" aria-label="حقول محسوبة تلقائياً">
          <div>
            <span>تاريخ الاستحقاق المتوقع</span>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={onSave}>{editing ? "حفظ التعديلات" : "إضافة الفاتورة"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}