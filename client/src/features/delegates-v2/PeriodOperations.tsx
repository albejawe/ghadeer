import { FormEvent, useEffect, useState } from "react";
import { Building2, Check, Save, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, formatMoney, formatNumber, Governorate, TargetRecord, User, WarehouseRecord } from "./api";

type Period = { year: number; month: number };
type Values = Record<string, { quantity: string; amount: string }>;

function buildValues(governorates: Governorate[], records: Array<WarehouseRecord | TargetRecord>, target = false): Values {
  return Object.fromEntries(governorates.map((gov) => {
    const record = records.find((item) => item.governorateId === gov.id);
    const quantity = target ? (record as TargetRecord | undefined)?.targetQuantity : (record as WarehouseRecord | undefined)?.quantity;
    const amount = target ? (record as TargetRecord | undefined)?.targetAmount : (record as WarehouseRecord | undefined)?.amount;
    return [gov.id, { quantity: quantity == null ? "" : String(quantity), amount: amount == null ? "" : String(amount) }];
  }));
}

export function WarehouseWorkspace({ user, governorates, period, records, onChanged }: { user: User; governorates: Governorate[]; period: Period; records: WarehouseRecord[]; onChanged: () => Promise<void> | void }) {
  const visible = user.role === "admin" ? governorates : governorates.filter((gov) => gov.id === user.governorateId);
  const [values, setValues] = useState<Values>(() => buildValues(visible, records));
  const [message, setMessage] = useState<{ good: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(buildValues(visible, records)), [records, period.year, period.month]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      for (const gov of visible) {
        const value = values[gov.id];
        if (!value?.quantity) continue;
        await api("/warehouse", { method: "PUT", body: JSON.stringify({ governorateId: gov.id, year: period.year, month: period.month, quantity: Number(value.quantity), amount: value.amount }) });
      }
      setMessage({ good: true, text: "تم حفظ مبيعات المذاخر للشهر المحدد." });
      await onChanged();
    } catch (error) { setMessage({ good: false, text: error instanceof Error ? error.message : "تعذر الحفظ." }); }
    finally { setBusy(false); }
  };
  if (user.role !== "admin" && !user.canEnterWarehouse) return <div className="gh-empty-page"><Building2 /><h2>صلاحية مبيعات المذخر غير مفعّلة</h2><p>يستطيع الأدمن تفعيلها من صفحة المشرفين.</p></div>;
  return <form className="gh-page-stack" onSubmit={save}><section className="gh-operation-hero"><div><span>الإجمالي الشهري للمحافظة</span><h2>مبيعات المذاخر</h2><p>اكتب إجمالي القطع الخارجة من كل محافظة. المبلغ اختياري.</p></div><Building2 /></section><div className="gh-bulk-grid">{visible.map((gov) => { const value = values[gov.id] || { quantity: "", amount: "" }; const existing = records.find((item) => item.governorateId === gov.id); return <article className="gh-bulk-card" key={gov.id}><header><div><strong>{gov.name}</strong><small>{existing ? `آخر حفظ: ${new Date(existing.updatedAt).toLocaleDateString("ar-IQ")}` : "لم تُسجل بعد"}</small></div>{existing && <Check />}</header><label><span>إجمالي عدد القطع</span><Input className="gh-input" type="number" min="0" inputMode="numeric" placeholder="0" value={value.quantity} onChange={(event) => setValues({ ...values, [gov.id]: { ...value, quantity: event.target.value } })} /></label><label><span>المبلغ الكلي (اختياري)</span><Input className="gh-input" type="number" min="0" inputMode="numeric" placeholder="د.ع" value={value.amount} onChange={(event) => setValues({ ...values, [gov.id]: { ...value, amount: event.target.value } })} /></label>{existing && <footer><span>المسجل حالياً</span><b>{formatNumber(existing.quantity)} قطعة · {existing.amount == null ? "بلا مبلغ" : formatMoney(existing.amount)}</b></footer>}</article>; })}</div>{message && <div className={`gh-message ${message.good ? "good" : "bad"}`}>{message.text}</div>}<div className="gh-sticky-save"><Button className="gh-primary" size="lg" disabled={busy}><Save /> {busy ? "جارٍ الحفظ..." : "حفظ مبيعات الشهر"}</Button></div></form>;
}

export function TargetsWorkspace({ governorates, period, records, onChanged }: { governorates: Governorate[]; period: Period; records: TargetRecord[]; onChanged: () => Promise<void> | void }) {
  const [values, setValues] = useState<Values>(() => buildValues(governorates, records, true));
  const [message, setMessage] = useState<{ good: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(buildValues(governorates, records, true)), [records, period.year, period.month]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      await api("/targets", { method: "PUT", body: JSON.stringify({ year: period.year, month: period.month, targets: governorates.map((gov) => ({ governorateId: gov.id, targetQuantity: Number(values[gov.id]?.quantity || 0), targetAmount: values[gov.id]?.amount || "" })) }) });
      setMessage({ good: true, text: `تم حفظ أهداف ${governorates.length} محافظات.` });
      await onChanged();
    } catch (error) { setMessage({ good: false, text: error instanceof Error ? error.message : "تعذر حفظ الأهداف." }); }
    finally { setBusy(false); }
  };
  return <form className="gh-page-stack" onSubmit={save}><section className="gh-operation-hero target"><div><span>الخطة الشهرية</span><h2>أهداف المحافظات</h2><p>عدد القطع هو الأساس، ويمكن إضافة هدف مبلغ اختياري.</p></div><Target /></section><div className="gh-bulk-grid">{governorates.map((gov) => { const value = values[gov.id] || { quantity: "", amount: "" }; const existing = records.find((item) => item.governorateId === gov.id); return <article className="gh-bulk-card" key={gov.id}><header><div><strong>{gov.name}</strong><small>{existing ? "الهدف محفوظ لهذا الشهر" : "لم يحدد هدف بعد"}</small></div>{existing && <Check />}</header><label><span>هدف عدد القطع</span><Input className="gh-input" type="number" min="0" inputMode="numeric" placeholder="مثلاً 20000" value={value.quantity} onChange={(event) => setValues({ ...values, [gov.id]: { ...value, quantity: event.target.value } })} /></label><label><span>هدف المبلغ (اختياري)</span><Input className="gh-input" type="number" min="0" inputMode="numeric" placeholder="د.ع" value={value.amount} onChange={(event) => setValues({ ...values, [gov.id]: { ...value, amount: event.target.value } })} /></label>{existing && <footer><span>الهدف الحالي</span><b>{formatNumber(existing.targetQuantity)} قطعة{existing.targetAmount == null ? "" : ` · ${formatMoney(existing.targetAmount)}`}</b></footer>}</article>; })}</div>{message && <div className={`gh-message ${message.good ? "good" : "bad"}`}>{message.text}</div>}<div className="gh-sticky-save"><Button className="gh-primary" size="lg" disabled={busy}><Save /> {busy ? "جارٍ الحفظ..." : "حفظ كل الأهداف"}</Button></div></form>;
}

