import { Check, Eye, PackageOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Reference = {
  governorates: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  materials: {
    id: string;
    name: string;
    companyId: string;
    unitPrice: number;
  }[];
};
type BatchItem = {
  materialId: string;
  material: string;
  company: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};
type Batch = {
  id: string;
  governorateId: string;
  governorate: string;
  saleDate: string;
  totalQuantity: number;
  totalAmount: number;
  note: string;
  createdByName?: string;
  items: BatchItem[];
};
const number = (value: number) => value.toLocaleString("en-US");
const money = (value: number) => `${number(value)} د.ع`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/local${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ العملية");
  return payload;
}

export function WarehouseBatches({
  reference,
  showToast,
  reload,
  period,
  periodPrefix,
}: {
  reference: Reference;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  reload: (silent?: boolean) => void;
  period: "current" | "previous" | "all" | "custom";
  periodPrefix: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [governorateId, setGovernorateId] = useState(
    reference.governorates[0]?.id || ""
  );
  const [saleDate, setSaleDate] = useState(today);
  const [note, setNote] = useState("");
  const [items, setItems] = useState([
    { key: crypto.randomUUID(), materialId: "", quantity: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailBatch, setDetailBatch] = useState<Batch | null>(null);

  const load = async () => {
    try {
      setBatches(
        (await api<{ batches: Batch[] }>("/warehouse-batches")).batches
      );
    } catch {
      showToast("تعذر تحميل وجبات المذخر", "error");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!detailBatch) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailBatch(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [detailBatch]);
  const shownBatches = useMemo(
    () =>
      period === "all"
        ? batches
        : batches.filter(batch => batch.saleDate.startsWith(periodPrefix)),
    [batches, period, periodPrefix]
  );
  const selected = useMemo(
    () =>
      items
        .map(item => ({
          ...item,
          material: reference.materials.find(
            material => material.id === item.materialId
          ),
        }))
        .filter(item => item.material),
    [items, reference.materials]
  );
  const totalQuantity = selected.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
  const totalAmount = selected.reduce(
    (sum, item) =>
      sum +
      (Number(item.quantity) || 0) * Number(item.material?.unitPrice || 0),
    0
  );
  const addItem = () =>
    setItems(value => [
      ...value,
      { key: crypto.randomUUID(), materialId: "", quantity: "" },
    ]);
  const reset = () => {
    setEditingId(null);
    setSaleDate(today);
    setNote("");
    setItems([{ key: crypto.randomUUID(), materialId: "", quantity: "" }]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = items
      .filter(item => item.materialId && Number(item.quantity) > 0)
      .map(item => ({
        materialId: item.materialId,
        quantity: Number(item.quantity),
      }));
    if (!governorateId || !saleDate || !clean.length)
      return showToast(
        "اختر المحافظة والتاريخ وأضف مادة واحدة على الأقل",
        "error"
      );
    setBusy(true);
    try {
      await api(
        editingId ? `/warehouse-batches/${editingId}` : "/warehouse-batches",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({ governorateId, saleDate, note, items: clean }),
        }
      );
      showToast(editingId ? "تم تعديل وجبة المذخر" : "تم حفظ وجبة المذخر");
      reset();
      await load();
      reload(true);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "تعذر حفظ الوجبة",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };
  const edit = (batch: Batch) => {
    setEditingId(batch.id);
    setGovernorateId(batch.governorateId);
    setSaleDate(batch.saleDate);
    setNote(batch.note || "");
    setItems(
      batch.items.map(item => ({
        key: crypto.randomUUID(),
        materialId: item.materialId,
        quantity: String(item.quantity),
      }))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (batch: Batch) => {
    if (
      !window.confirm(`حذف وجبة ${batch.governorate} بتاريخ ${batch.saleDate}؟`)
    )
      return;
    try {
      await api(`/warehouse-batches/${batch.id}`, { method: "DELETE" });
      setBatches(value => value.filter(item => item.id !== batch.id));
      showToast("تم حذف وجبة المذخر");
      reload(true);
    } catch {
      showToast("تعذر حذف الوجبة", "error");
    }
  };

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">وجبة مذخر</span>
          <h2>خروج مواد من المذخر</h2>
          <p>أضف المواد والكميات في وجبة واحدة؛ يُحسب الإجمالي تلقائياً.</p>
        </div>
      </div>
      <form className="local-form-card" onSubmit={submit}>
        <div className="local-form-grid">
          <label className="local-field">
            <span>المحافظة</span>
            <select
              value={governorateId}
              onChange={event => setGovernorateId(event.target.value)}
              required
            >
              {reference.governorates.map(gov => (
                <option key={gov.id} value={gov.id}>
                  {gov.name}
                </option>
              ))}
            </select>
          </label>
          <label className="local-field">
            <span>تاريخ الوجبة</span>
            <input
              type="date"
              value={saleDate}
              onChange={event => setSaleDate(event.target.value)}
              required
            />
          </label>
          <label className="local-field local-field-wide">
            <span>ملاحظة (اختيارية)</span>
            <input
              value={note}
              maxLength={500}
              onChange={event => setNote(event.target.value)}
              placeholder="مثال: وجبة بداية الشهر"
            />
          </label>
        </div>
        <div className="local-batch-items">
          <div className="local-section-head compact">
            <div>
              <h3>مواد الوجبة</h3>
              <p>يمكن إضافة أكثر من مادة.</p>
            </div>
            <button type="button" className="local-secondary" onClick={addItem}>
              <Plus size={15} /> إضافة مادة
            </button>
          </div>
          {items.map((item, index) => (
            <div className="local-batch-item" key={item.key}>
              <strong>{index + 1}</strong>
              <select
                value={item.materialId}
                onChange={event =>
                  setItems(value =>
                    value.map(current =>
                      current.key === item.key
                        ? { ...current, materialId: event.target.value }
                        : current
                    )
                  )
                }
              >
                <option value="">اختر المادة</option>
                {reference.materials.map(material => (
                  <option key={material.id} value={material.id}>
                    {material.name} ·{" "}
                    {
                      reference.companies.find(
                        company => company.id === material.companyId
                      )?.name
                    }
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={event =>
                  setItems(value =>
                    value.map(current =>
                      current.key === item.key
                        ? { ...current, quantity: event.target.value }
                        : current
                    )
                  )
                }
                placeholder="العدد"
              />
              <b>
                {reference.materials.find(
                  material => material.id === item.materialId
                ) && Number(item.quantity) > 0
                  ? money(
                      Number(item.quantity) *
                        (reference.materials.find(
                          material => material.id === item.materialId
                        )?.unitPrice || 0)
                    )
                  : "—"}
              </b>
              <button
                className="local-danger-button"
                type="button"
                disabled={items.length === 1}
                onClick={() =>
                  setItems(value =>
                    value.filter(current => current.key !== item.key)
                  )
                }
                aria-label="حذف المادة"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="local-batch-total">
          <span>إجمالي الوجبة</span>
          <strong>{number(totalQuantity)} قطعة</strong>
          <b>{money(totalAmount)}</b>
        </div>
        <div className="local-form-actions">
          <button className="local-primary" disabled={busy}>
            <Check />{" "}
            {busy
              ? "جارٍ الحفظ..."
              : editingId
                ? "حفظ التعديل"
                : "حفظ وجبة المذخر"}
          </button>
          {editingId && (
            <button type="button" className="local-secondary" onClick={reset}>
              إلغاء التعديل
            </button>
          )}
        </div>
      </form>
      <div className="local-section-head compact">
        <div>
          <h2>الوجبات المسجلة</h2>
          <p>{shownBatches.length} وجبة في الفترة المحددة · يمكن تعديلها أو حذفها.</p>
        </div>
      </div>
      <div className="local-list">
        {shownBatches.map(batch => (
          <article key={batch.id} className="local-list-row local-batch-record">
            <div
              className="local-batch-record-main"
              role="button"
              tabIndex={0}
              onClick={() => setDetailBatch(batch)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setDetailBatch(batch);
                }
              }}
            >
              <strong>
                {batch.governorate} · {batch.saleDate}
              </strong>
              <span>
                {number(batch.items.length)} {batch.items.length === 1 ? "مادة" : "مواد"}
                {batch.note ? ` · ${batch.note}` : ""}
                {batch.createdByName ? ` · سجلها: ${batch.createdByName}` : ""}
              </span>
            </div>
            <div className="local-history-row-actions">
              <b>
                {number(batch.totalQuantity)} قطعة
                <br />
                <small>{money(batch.totalAmount)}</small>
              </b>
              <button
                type="button"
                className="local-detail-button"
                onClick={() => setDetailBatch(batch)}
              >
                <Eye size={16} /> عرض التفاصيل
              </button>
              <button
                type="button"
                className="local-plain-button"
                onClick={() => edit(batch)}
                title="تعديل"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="local-danger-button"
                onClick={() => void remove(batch)}
                title="حذف"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
        {!shownBatches.length && (
          <div className="local-empty">لا توجد وجبات في الفترة المحددة.</div>
        )}
      </div>

      {detailBatch && (
        <div
          className="local-batch-detail-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setDetailBatch(null);
          }}
        >
          <section
            className="local-batch-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="warehouse-batch-detail-title"
          >
            <header className="local-batch-detail-head">
              <div>
                <span className="local-kicker">تفاصيل وجبة المذخر</span>
                <h2 id="warehouse-batch-detail-title">{detailBatch.governorate}</h2>
                <p>{detailBatch.saleDate}{detailBatch.createdByName ? ` · سجلها ${detailBatch.createdByName}` : ""}</p>
              </div>
              <button type="button" onClick={() => setDetailBatch(null)} aria-label="إغلاق التفاصيل">
                <X size={20} />
              </button>
            </header>

            <div className="local-batch-detail-summary">
              <div><span>عدد المواد</span><strong>{number(detailBatch.items.length)}</strong></div>
              <div><span>إجمالي القطع</span><strong>{number(detailBatch.totalQuantity)}</strong></div>
              <div><span>إجمالي المبلغ</span><strong>{money(detailBatch.totalAmount)}</strong></div>
            </div>

            <div className="local-batch-detail-items">
              {detailBatch.items.map((item, index) => (
                <article key={`${detailBatch.id}-${item.materialId}-${index}`}>
                  <span className="local-batch-detail-index">{number(index + 1)}</span>
                  <div className="local-batch-detail-identity">
                    <strong>{item.material}</strong>
                    <small>{item.company}</small>
                  </div>
                  <dl>
                    <div><dt>العدد</dt><dd>{number(item.quantity)} قطعة</dd></div>
                    <div><dt>سعر القطعة</dt><dd>{money(item.unitPrice)}</dd></div>
                    <div><dt>الإجمالي</dt><dd>{money(item.totalAmount)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>

            {detailBatch.note && (
              <div className="local-batch-detail-note">
                <PackageOpen size={17} />
                <div><span>الملاحظة</span><strong>{detailBatch.note}</strong></div>
              </div>
            )}

            <footer className="local-batch-detail-actions">
              <button type="button" className="local-primary" onClick={() => setDetailBatch(null)}>إغلاق</button>
              <button
                type="button"
                className="local-secondary"
                onClick={() => {
                  const batch = detailBatch;
                  setDetailBatch(null);
                  edit(batch);
                }}
              >
                <Pencil size={15} /> تعديل الوجبة
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
