import { Building2, Check, Pencil, Pill, Plus, Power, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Company = { id: string; name: string; active: boolean };
type Material = {
  id: string;
  name: string;
  companyId: string;
  company: string;
  unitPrice: number;
  active: boolean;
};
type Reference = {
  companies: { id: string; name: string }[];
  materials: {
    id: string;
    name: string;
    companyId: string;
    company: string;
    unitPrice: number;
  }[];
};
const number = (value: number) => value.toLocaleString("en-US");

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/local${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(String((payload as { error?: string }).error || "تعذر تنفيذ العملية"));
  return payload as T;
}

export function CatalogSection({
  reference,
  showToast,
  reload,
}: {
  reference: Reference;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  reload: (silent?: boolean) => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [companyForm, setCompanyForm] = useState({ id: "", name: "" });
  const [materialForm, setMaterialForm] = useState({
    id: "",
    name: "",
    companyId: reference.companies[0]?.id || "",
    unitPrice: "",
  });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    const result = await api<{ companies: Company[]; materials: Material[] }>(
      "/v2/admin/catalog"
    );
    setCompanies(result.companies);
    setMaterials(result.materials);
    setMaterialForm(current => ({
      ...current,
      companyId:
        current.companyId ||
        result.companies.find(company => company.active)?.id ||
        "",
    }));
  };

  useEffect(() => {
    void load().catch(() => showToast("تعذر تحميل الشركات والمواد", "error"));
  }, []);

  const activeCompanies = companies.filter(company => company.active);
  const shownMaterials = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return materials.filter(
      material =>
        !needle ||
        `${material.name} ${material.company}`.toLowerCase().includes(needle)
    );
  }, [materials, query]);

  const saveCompany = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyForm.name.trim()) return;
    setBusy("company");
    try {
      await api(
        companyForm.id
          ? `/v2/admin/companies/${companyForm.id}`
          : "/v2/admin/companies",
        {
          method: companyForm.id ? "PATCH" : "POST",
          body: JSON.stringify({ name: companyForm.name, active: true }),
        }
      );
      showToast(companyForm.id ? "تم تعديل الشركة" : "تمت إضافة الشركة");
      setCompanyForm({ id: "", name: "" });
      await load();
      reload(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذر حفظ الشركة", "error");
    } finally {
      setBusy("");
    }
  };

  const saveMaterial = async (event: FormEvent) => {
    event.preventDefault();
    const unitPrice = Number(materialForm.unitPrice);
    if (
      !materialForm.name.trim() ||
      !materialForm.companyId ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    )
      return showToast("أدخل اسم المادة وشركتها وسعرها", "error");
    setBusy("material");
    try {
      await api(
        materialForm.id
          ? `/v2/admin/materials/${materialForm.id}`
          : "/v2/admin/materials",
        {
          method: materialForm.id ? "PATCH" : "POST",
          body: JSON.stringify({
            name: materialForm.name,
            companyId: materialForm.companyId,
            unitPrice,
            active: true,
          }),
        }
      );
      showToast(materialForm.id ? "تم تعديل المادة" : "تمت إضافة المادة");
      setMaterialForm({
        id: "",
        name: "",
        companyId: activeCompanies[0]?.id || "",
        unitPrice: "",
      });
      await load();
      reload(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذر حفظ المادة", "error");
    } finally {
      setBusy("");
    }
  };

  const toggleCompany = async (company: Company) => {
    if (
      company.active &&
      !window.confirm(`تعطيل شركة ${company.name} وإخفاؤها من الإدخال؟`)
    )
      return;
    try {
      await api(`/v2/admin/companies/${company.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: company.name, active: !company.active }),
      });
      await load();
      reload(true);
      showToast(company.active ? "تم تعطيل الشركة" : "تم تفعيل الشركة");
    } catch {
      showToast("تعذر تحديث الشركة", "error");
    }
  };

  const toggleMaterial = async (material: Material) => {
    try {
      await api(`/v2/admin/materials/${material.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: material.name,
          companyId: material.companyId,
          unitPrice: material.unitPrice,
          active: !material.active,
        }),
      });
      await load();
      reload(true);
      showToast(material.active ? "تم تعطيل المادة" : "تم تفعيل المادة");
    } catch {
      showToast("تعذر تحديث المادة", "error");
    }
  };

  return (
    <section className="local-content">
      <div className="local-section-head">
        <div>
          <span className="local-kicker">دليل البيع</span>
          <h2>الشركات والمواد</h2>
          <p>أضف الشركة أولاً، ثم اربط كل مادة بشركتها وسعر القطعة.</p>
        </div>
        <Building2 />
      </div>

      <div className="local-dual">
        <form className="local-form-card" onSubmit={saveCompany}>
          <h3><Building2 /> {companyForm.id ? "تعديل الشركة" : "إضافة شركة"}</h3>
          <label className="local-field">
            <span>اسم الشركة</span>
            <input
              value={companyForm.name}
              onChange={event =>
                setCompanyForm({ ...companyForm, name: event.target.value })
              }
              placeholder="اسم الشركة"
              required
            />
          </label>
          <div className="local-form-actions">
            <button className="local-primary" disabled={busy === "company"}>
              <Check /> {companyForm.id ? "حفظ التعديل" : "إضافة الشركة"}
            </button>
            {companyForm.id && (
              <button
                type="button"
                className="local-secondary"
                onClick={() => setCompanyForm({ id: "", name: "" })}
              >
                <X size={15} /> إلغاء
              </button>
            )}
          </div>
        </form>

        <form className="local-form-card" onSubmit={saveMaterial}>
          <h3><Pill /> {materialForm.id ? "تعديل المادة" : "إضافة مادة"}</h3>
          <label className="local-field">
            <span>اسم المادة</span>
            <input
              value={materialForm.name}
              onChange={event =>
                setMaterialForm({ ...materialForm, name: event.target.value })
              }
              placeholder="اسم المادة"
              required
            />
          </label>
          <label className="local-field">
            <span>الشركة التابعة لها</span>
            <select
              value={materialForm.companyId}
              onChange={event =>
                setMaterialForm({
                  ...materialForm,
                  companyId: event.target.value,
                })
              }
              required
            >
              <option value="">اختر الشركة</option>
              {activeCompanies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="local-field">
            <span>سعر القطعة</span>
            <input
              type="number"
              min="0"
              step="1"
              value={materialForm.unitPrice}
              onChange={event =>
                setMaterialForm({
                  ...materialForm,
                  unitPrice: event.target.value,
                })
              }
              placeholder="0"
              required
            />
          </label>
          <div className="local-form-actions">
            <button className="local-primary" disabled={busy === "material"}>
              <Plus /> {materialForm.id ? "حفظ التعديل" : "إضافة المادة"}
            </button>
            {materialForm.id && (
              <button
                type="button"
                className="local-secondary"
                onClick={() =>
                  setMaterialForm({
                    id: "",
                    name: "",
                    companyId: activeCompanies[0]?.id || "",
                    unitPrice: "",
                  })
                }
              >
                <X size={15} /> إلغاء
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="local-section-head compact">
        <div>
          <h2>الشركات ({number(companies.length)})</h2>
          <p>يمكن تعديل الشركة أو تعطيلها دون حذف بياناتها السابقة.</p>
        </div>
      </div>
      <div className="local-list">
        {companies.map(company => (
          <article className="local-list-row" key={company.id}>
            <div>
              <strong>{company.name}</strong>
              <span>{company.active ? "فعّالة" : "معطلة"}</span>
            </div>
            <div className="local-history-row-actions">
              <button
                type="button"
                className="local-plain-button"
                onClick={() =>
                  setCompanyForm({ id: company.id, name: company.name })
                }
              >
                <Pencil size={15} /> تعديل
              </button>
              <button
                type="button"
                className={company.active ? "local-danger-button" : "local-secondary"}
                onClick={() => void toggleCompany(company)}
              >
                <Power size={15} /> {company.active ? "تعطيل" : "تفعيل"}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="local-section-head compact">
        <div>
          <h2>المواد ({number(shownMaterials.length)})</h2>
          <p>كل مادة مرتبطة بشركة واحدة وسعر قطعة واضح.</p>
        </div>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="بحث باسم المادة أو الشركة"
        />
      </div>
      <div className="local-list">
        {shownMaterials.map(material => (
          <article className="local-list-row" key={material.id}>
            <div>
              <strong>{material.name}</strong>
              <span>
                {material.company} · {number(material.unitPrice)} د.ع ·{" "}
                {material.active ? "فعّالة" : "معطلة"}
              </span>
            </div>
            <div className="local-history-row-actions">
              <button
                type="button"
                className="local-plain-button"
                onClick={() =>
                  setMaterialForm({
                    id: material.id,
                    name: material.name,
                    companyId: material.companyId,
                    unitPrice: String(material.unitPrice),
                  })
                }
              >
                <Pencil size={15} /> تعديل
              </button>
              <button
                type="button"
                className={material.active ? "local-danger-button" : "local-secondary"}
                onClick={() => void toggleMaterial(material)}
              >
                <Power size={15} /> {material.active ? "تعطيل" : "تفعيل"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}