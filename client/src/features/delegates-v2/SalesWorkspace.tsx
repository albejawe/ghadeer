import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Edit3, PackagePlus, ReceiptText, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, formatMoney, formatNumber, isoToday, ReferenceData, Sale, User } from "./api";

type FormState = { governorateId: string; representativeId: string; companyId: string; materialId: string; quantity: string; saleDate: string; note: string };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="gh-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function SalesWorkspace({ user, reference, sales, onChanged }: { user: User; reference: ReferenceData; sales: Sale[]; onChanged: () => Promise<void> | void }) {
  const initialGovernorate = user.governorateId || reference.governorates[0]?.id || "";
  const [form, setForm] = useState<FormState>({ governorateId: initialGovernorate, representativeId: "", companyId: "", materialId: "", quantity: "", saleDate: isoToday(), note: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [search, setSearch] = useState("");

  const representatives = useMemo(() => reference.representatives.filter((rep) => rep.governorateId === form.governorateId), [reference.representatives, form.governorateId]);
  const selectedRep = representatives.find((rep) => rep.id === form.representativeId);
  const companies = useMemo(() => reference.companies.filter((company) => !selectedRep || selectedRep.companyIds.includes(company.id)), [reference.companies, selectedRep]);
  const materials = useMemo(() => reference.materials.filter((material) => material.companyId === form.companyId), [reference.materials, form.companyId]);
  const selectedMaterial = materials.find((material) => material.id === form.materialId);
  const total = Number(form.quantity || 0) * Number(selectedMaterial?.unitPrice || 0);
  const filteredSales = sales.filter((sale) => `${sale.material} ${sale.representative} ${sale.company} ${sale.governorate}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!representatives.some((rep) => rep.id === form.representativeId)) setForm((current) => ({ ...current, representativeId: representatives.length === 1 ? representatives[0].id : "", companyId: "", materialId: "" }));
  }, [form.governorateId]);

  const reset = () => {
    setEditingId(null);
    setForm({ governorateId: initialGovernorate, representativeId: "", companyId: "", materialId: "", quantity: "", saleDate: isoToday(), note: "" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      await api(editingId ? `/sales/${editingId}` : "/sales", { method: editingId ? "PATCH" : "POST", body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) });
      setMessage({ tone: "good", text: editingId ? "تم تحديث عملية البيع." : "تم حفظ البيع بنجاح." });
      reset();
      await onChanged();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "تعذر الحفظ." });
    } finally { setBusy(false); }
  };

  const edit = (sale: Sale) => {
    setEditingId(sale.id);
    setForm({ governorateId: sale.governorateId, representativeId: sale.representativeId, companyId: sale.companyId, materialId: sale.materialId, quantity: String(sale.quantity), saleDate: sale.saleDate, note: sale.note || "" });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (sale: Sale) => {
    if (!window.confirm(`حذف بيع ${sale.material} للمندوب ${sale.representative}؟`)) return;
    try { await api(`/sales/${sale.id}`, { method: "DELETE" }); await onChanged(); }
    catch (error) { setMessage({ tone: "bad", text: error instanceof Error ? error.message : "تعذر الحذف." }); }
  };

  return <div className="gh-page-stack">
    <section className="gh-entry-layout">
      <form className="gh-entry-card" onSubmit={submit}>
        <header><div><span>{editingId ? "تصحيح إدخال" : "إدخال سريع"}</span><h2>{editingId ? "تعديل عملية البيع" : "تسجيل بيع جديد"}</h2><p>السعر والإجمالي يُحسبان تلقائياً من المادة.</p></div><i><PackagePlus /></i></header>
        <div className="gh-form-grid">
          <Field label="المحافظة"><select value={form.governorateId} disabled={user.role !== "admin"} onChange={(event) => setForm({ ...form, governorateId: event.target.value, representativeId: "", companyId: "", materialId: "" })}>{reference.governorates.map((gov) => <option key={gov.id} value={gov.id}>{gov.name}</option>)}</select></Field>
          <Field label="المندوب"><select value={form.representativeId} onChange={(event) => setForm({ ...form, representativeId: event.target.value, companyId: "", materialId: "" })} required><option value="">اختر المندوب</option>{representatives.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}</select></Field>
          <Field label="الشركة"><select value={form.companyId} onChange={(event) => setForm({ ...form, companyId: event.target.value, materialId: "" })} required disabled={!form.representativeId}><option value="">اختر الشركة</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
          <Field label="المادة"><select value={form.materialId} onChange={(event) => setForm({ ...form, materialId: event.target.value })} required disabled={!form.companyId}><option value="">اختر المادة</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></Field>
          <Field label="عدد القطع"><Input className="gh-input" inputMode="numeric" type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="0" required /></Field>
          <Field label="تاريخ البيع"><Input className="gh-input" type="date" value={form.saleDate} onChange={(event) => setForm({ ...form, saleDate: event.target.value })} required /></Field>
        </div>
        <Field label="ملاحظة اختيارية"><Input className="gh-input" value={form.note} maxLength={300} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="مثلاً: فاتورة رقم 24" /></Field>
        <div className="gh-live-total"><div><span>سعر القطعة</span><b>{selectedMaterial ? formatMoney(selectedMaterial.unitPrice) : "—"}</b></div><div><span>الإجمالي</span><strong>{formatMoney(total)}</strong></div></div>
        {message && <div className={`gh-message ${message.tone}`}>{message.text}</div>}
        <div className="gh-form-actions"><Button className="gh-primary" size="lg" disabled={busy}>{busy ? "جارٍ الحفظ..." : <><Check /> {editingId ? "حفظ التعديل" : "حفظ البيع"}</>}</Button>{editingId && <Button type="button" variant="outline" size="lg" onClick={reset}><RotateCcw /> إلغاء التعديل</Button>}</div>
      </form>
      <aside className="gh-entry-guide"><ReceiptText /><h3>قبل الحفظ</h3><ol><li>اختر المندوب أولاً.</li><li>ستظهر شركاته المسموحة فقط.</li><li>اختر المادة واكتب عدد القطع.</li><li>راجع المبلغ واضغط حفظ.</li></ol><div><span>عمليات هذا الشهر</span><strong>{formatNumber(sales.length)}</strong></div></aside>
    </section>

    <section className="gh-panel gh-sales-list"><header><div><span>سجل الشهر</span><h3>عمليات المندوبين</h3></div><label className="gh-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم المندوب أو المادة" /></label></header><div className="gh-table-head"><span>المادة والمندوب</span><span>المحافظة والشركة</span><span>التاريخ</span><span>القطع</span><span>المبلغ</span><span /></div><div className="gh-sales-rows">{filteredSales.map((sale) => <article key={sale.id}><div><strong>{sale.material}</strong><small>{sale.representative} · أدخلها {sale.supervisor}</small></div><div><strong>{sale.governorate}</strong><small>{sale.company}</small></div><time>{sale.saleDate}</time><b>{formatNumber(sale.quantity)}</b><strong>{formatMoney(sale.totalAmount)}</strong><aside><Button size="icon-sm" variant="ghost" onClick={() => edit(sale)} aria-label="تعديل"><Edit3 /></Button><Button size="icon-sm" variant="ghost" className="gh-danger" onClick={() => void remove(sale)} aria-label="حذف"><Trash2 /></Button></aside></article>)}{!filteredSales.length && <div className="gh-empty-small">لا توجد عمليات مطابقة في هذا الشهر.</div>}</div></section>
  </div>;
}

