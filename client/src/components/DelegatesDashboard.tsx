import { BarChart3, MapPin, Package, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
type Ref = {
  governorates: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  materials: {
    id: string;
    name: string;
    companyId: string;
    unitPrice: number;
  }[];
  representatives: { id: string; name: string; governorateId: string }[];
};
type Sale = {
  saleDate: string;
  quantity: number;
  totalAmount: number;
  governorateId: string;
  governorate: string;
  companyId: string;
  company: string;
  materialId: string;
  material: string;
  representative: string;
};
type Legacy = {
  saleDate: string;
  quantity: number;
  amount: number | null;
  governorateId: string;
};
type TargetRecord = {
  governorateId: string;
  governorate: string;
  year: number;
  month: number;
  targetQuantity: number;
};
type Batch = {
  governorateId: string;
  saleDate: string;
  totalQuantity: number;
  totalAmount: number;
  items: {
    materialId: string;
    material: string;
    company: string;
    quantity: number;
    totalAmount: number;
  }[];
};
const number = (value: number) => value.toLocaleString("en-US");
const money = (value: number) => `${number(value)} د.ع`;
async function api<T>(path: string): Promise<T> {
  const response = await fetch(`/api/local${path}`, { credentials: "include" });
  if (!response.ok) throw new Error();
  return response.json();
}
const datePrefix = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
export function DelegatesDashboard({
  reference,
  sales,
  warehouse,
  targets,
}: {
  reference: Ref;
  sales: Sale[];
  warehouse: Legacy[];
  targets: TargetRecord[];
}) {
  const now = new Date();
  const current = datePrefix(now);
  const previous = datePrefix(
    new Date(now.getFullYear(), now.getMonth() - 1, 1)
  );
  const [period, setPeriod] = useState<
    "current" | "previous" | "all" | "custom"
  >("current");
  const [month, setMonth] = useState(current);
  const [filters, setFilters] = useState({
    governorateId: "",
    companyId: "",
    representativeId: "",
    materialId: "",
  });
  const [batches, setBatches] = useState<Batch[]>([]);
  const [monthlyTargets, setMonthlyTargets] = useState<TargetRecord[]>(targets);
  useEffect(() => {
    void api<{ batches: Batch[] }>("/warehouse-batches")
      .then(data => setBatches(data.batches))
      .catch(() => setBatches([]));
  }, []);
  const prefix =
    period === "current" ? current : period === "previous" ? previous : month;
  useEffect(() => {
    if (period === "all") return;
    const [year, selectedMonth] = prefix.split("-");
    void api<{ targets: TargetRecord[] }>(
      `/targets?year=${year}&month=${Number(selectedMonth)}`
    )
      .then(data => setMonthlyTargets(data.targets))
      .catch(() => setMonthlyTargets([]));
  }, [prefix, period]);
  const label =
    period === "current"
      ? "هذا الشهر"
      : period === "previous"
        ? "الشهر السابق"
        : period === "all"
          ? "كل الفترات"
          : month;
  const materialById = useMemo(
    () => new Map(reference.materials.map(item => [item.id, item])),
    [reference.materials]
  );
  const scopedSales = useMemo(
    () =>
      sales.filter(
        sale =>
          (period === "all" || sale.saleDate.startsWith(prefix)) &&
          (!filters.governorateId ||
            sale.governorateId === filters.governorateId) &&
          (!filters.companyId || sale.companyId === filters.companyId) &&
          (!filters.representativeId ||
            sale.representative === filters.representativeId) &&
          (!filters.materialId || sale.materialId === filters.materialId)
      ),
    [sales, period, prefix, filters]
  );
  const scopedBatches = useMemo(
    () =>
      batches
        .filter(
          batch =>
            (period === "all" || batch.saleDate.startsWith(prefix)) &&
            (!filters.governorateId ||
              batch.governorateId === filters.governorateId)
        )
        .map(batch => ({
          ...batch,
          items: batch.items.filter(item => {
            const material = materialById.get(item.materialId);
            return (
              (!filters.materialId || item.materialId === filters.materialId) &&
              (!filters.companyId || material?.companyId === filters.companyId)
            );
          }),
        }))
        .filter(batch => batch.items.length),
    [batches, period, prefix, filters, materialById]
  );
  const legacyUnits = useMemo(
    () =>
      warehouse
        .filter(
          item =>
            (period === "all" || item.saleDate.startsWith(prefix)) &&
            (!filters.governorateId ||
              item.governorateId === filters.governorateId) &&
            !filters.companyId &&
            !filters.materialId
        )
        .reduce((sum, item) => sum + item.quantity, 0),
    [warehouse, period, prefix, filters]
  );
  const repUnits = scopedSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const repAmount = scopedSales.reduce(
    (sum, sale) => sum + sale.totalAmount,
    0
  );
  const warehouseUnits =
    scopedBatches.reduce(
      (sum, batch) =>
        sum + batch.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    ) + legacyUnits;
  const warehouseAmount =
    scopedBatches.reduce(
      (sum, batch) =>
        sum +
        batch.items.reduce((itemSum, item) => itemSum + item.totalAmount, 0),
      0
    ) +
    warehouse
      .filter(
        item =>
          (period === "all" || item.saleDate.startsWith(prefix)) &&
          (!filters.governorateId ||
            item.governorateId === filters.governorateId) &&
          !filters.companyId &&
          !filters.materialId
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const directUnits = warehouseUnits - repUnits;
  const rank = (rows: { name: string; quantity: number; amount?: number }[]) =>
    rows
      .filter(row => row.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  const rankAll = (
    rows: { name: string; quantity: number; amount?: number }[]
  ) =>
    rows
      .filter(row => row.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);
  const repRanking = rank(
    Object.values(
      scopedSales.reduce<
        Record<string, { name: string; quantity: number; amount: number }>
      >((out, sale) => {
        const key = sale.representative;
        out[key] ||= { name: sale.representative, quantity: 0, amount: 0 };
        out[key].quantity += sale.quantity;
        out[key].amount += sale.totalAmount;
        return out;
      }, {})
    )
  );
  const materialMovement = new Map<
    string,
    { name: string; quantity: number; amount: number }
  >();
  for (const sale of scopedSales) {
    const current = materialMovement.get(sale.materialId) || {
      name: sale.material,
      quantity: 0,
      amount: 0,
    };
    current.quantity += sale.quantity;
    current.amount += sale.totalAmount;
    materialMovement.set(sale.materialId, current);
  }
  for (const batch of scopedBatches)
    for (const item of batch.items) {
      const current = materialMovement.get(item.materialId) || {
        name: item.material,
        quantity: 0,
        amount: 0,
      };
      current.quantity += item.quantity;
      current.amount += item.totalAmount;
      materialMovement.set(item.materialId, current);
    }
  const materialRanking = rankAll(Array.from(materialMovement.values()));
  const govRanking = rank(
    reference.governorates.map(gov => ({
      name: gov.name,
      quantity:
        filters.governorateId && filters.governorateId !== gov.id
          ? 0
          : scopedBatches
              .filter(batch => batch.governorateId === gov.id)
              .reduce(
                (sum, batch) =>
                  sum +
                  batch.items.reduce(
                    (itemSum, item) => itemSum + item.quantity,
                    0
                  ),
                0
              ) +
            (filters.companyId || filters.materialId
              ? 0
              : warehouse
                  .filter(
                    item =>
                      (period === "all" || item.saleDate.startsWith(prefix)) &&
                      item.governorateId === gov.id
                  )
                  .reduce((sum, item) => sum + item.quantity, 0)),
    }))
  );
  const targetRows =
    period === "all"
      ? []
      : monthlyTargets.map(target => {
          const sold =
            scopedBatches
              .filter(batch => batch.governorateId === target.governorateId)
              .reduce(
                (sum, batch) =>
                  sum +
                  batch.items.reduce(
                    (itemSum, item) => itemSum + item.quantity,
                    0
                  ),
                0
              ) +
            (filters.companyId || filters.materialId
              ? 0
              : warehouse
                  .filter(
                    item =>
                      item.governorateId === target.governorateId &&
                      item.saleDate.startsWith(prefix)
                  )
                  .reduce((sum, item) => sum + item.quantity, 0));
          return {
            ...target,
            sold,
            percent: target.targetQuantity
              ? Math.round((sold / target.targetQuantity) * 100)
              : 0,
          };
        });
  return (
    <section className="local-content local-dashboard">
      {" "}
      <div className="local-dashboard-heading">
        {" "}
        <div>
          {" "}
          <span className="local-kicker">لوحة الإحصائيات</span>{" "}
          <h2>صورة المبيعات الكاملة</h2>{" "}
          <p>
            {" "}
            الفترة المختارة: <strong>{label}</strong> — تتحدث البطاقات والترتيب
            مع كل فلتر.{" "}
          </p>{" "}
        </div>{" "}
        <BarChart3 />{" "}
      </div>{" "}
      <div className="local-period-bar dashboard-period">
        {" "}
        <div className="local-period-actions">
          {" "}
          <button
            className={period === "current" ? "active" : ""}
            onClick={() => setPeriod("current")}
          >
            {" "}
            هذا الشهر{" "}
          </button>{" "}
          <button
            className={period === "previous" ? "active" : ""}
            onClick={() => setPeriod("previous")}
          >
            {" "}
            الشهر السابق{" "}
          </button>{" "}
          <button
            className={period === "all" ? "active" : ""}
            onClick={() => setPeriod("all")}
          >
            {" "}
            كل الفترات{" "}
          </button>{" "}
          <label className={period === "custom" ? "active custom" : "custom"}>
            {" "}
            شهر محدد{" "}
            <input
              type="month"
              value={month}
              onChange={event => {
                setMonth(event.target.value);
                setPeriod("custom");
              }}
            />{" "}
          </label>{" "}
        </div>{" "}
      </div>{" "}
      <div className="local-dashboard-filters">
        {" "}
        <select
          value={filters.governorateId}
          onChange={event =>
            setFilters({
              ...filters,
              governorateId: event.target.value,
              representativeId: "",
            })
          }
        >
          {" "}
          <option value="">كل المحافظات</option>{" "}
          {reference.governorates.map(item => (
            <option key={item.id} value={item.id}>
              {" "}
              {item.name}{" "}
            </option>
          ))}{" "}
        </select>{" "}
        <select
          value={filters.companyId}
          onChange={event =>
            setFilters({
              ...filters,
              companyId: event.target.value,
              materialId: "",
            })
          }
        >
          {" "}
          <option value="">كل الشركات</option>{" "}
          {reference.companies.map(item => (
            <option key={item.id} value={item.id}>
              {" "}
              {item.name}{" "}
            </option>
          ))}{" "}
        </select>{" "}
        <select
          value={filters.representativeId}
          onChange={event =>
            setFilters({ ...filters, representativeId: event.target.value })
          }
        >
          {" "}
          <option value="">كل المندوبين</option>{" "}
          {reference.representatives
            .filter(
              item =>
                !filters.governorateId ||
                item.governorateId === filters.governorateId
            )
            .map(item => (
              <option key={item.id} value={item.name}>
                {" "}
                {item.name}{" "}
              </option>
            ))}{" "}
        </select>{" "}
        <select
          value={filters.materialId}
          onChange={event =>
            setFilters({ ...filters, materialId: event.target.value })
          }
        >
          {" "}
          <option value="">كل المواد</option>{" "}
          {reference.materials
            .filter(
              item => !filters.companyId || item.companyId === filters.companyId
            )
            .map(item => (
              <option key={item.id} value={item.id}>
                {" "}
                {item.name}{" "}
              </option>
            ))}{" "}
        </select>{" "}
        <button
          className="local-secondary"
          onClick={() =>
            setFilters({
              governorateId: "",
              companyId: "",
              representativeId: "",
              materialId: "",
            })
          }
        >
          {" "}
          مسح الفلاتر{" "}
        </button>{" "}
      </div>{" "}
      <div className="local-dashboard-cards">
        {" "}
        <Metric
          icon={<Package />}
          label="إجمالي المذخر"
          value={`${number(warehouseUnits)} قطعة`}
          note={money(warehouseAmount)}
        />{" "}
        <Metric
          icon={<Users />}
          label="مبيعات المندوبين"
          value={`${number(repUnits)} قطعة`}
          note={money(repAmount)}
        />{" "}
        <Metric
          icon={<MapPin />}
          label="المباشر من المذخر"
          value={`${number(directUnits)} قطعة`}
          note="إجمالي المذخر − مبيعات المندوبين"
        />{" "}
        <Metric
          icon={<Target />}
          label="عدد عمليات المندوبين"
          value={number(scopedSales.length)}
          note="إدخال مسجل"
        />{" "}
      </div>{" "}
      <div className="local-dashboard-grid">
        {" "}
        <Ranking title="أفضل المندوبين" rows={repRanking} />{" "}
        <Ranking title="المواد الأكثر حركة" rows={materialRanking} />{" "}
        <Ranking title="المحافظات الأعلى" rows={govRanking} />{" "}
      </div>{" "}
      {period !== "all" && (
        <section className="local-target-board">
          {" "}
          <div className="local-section-head compact">
            {" "}
            <div>
              {" "}
              <h2>تحقيق أهداف المحافظات</h2>{" "}
              <p>يُحسب من إجمالي خروج المذخر في {label}.</p>{" "}
            </div>{" "}
          </div>{" "}
          <div className="local-target-grid">
            {" "}
            {targetRows.map(row => (
              <article key={row.governorateId} className="local-target-stat">
                {" "}
                <strong>{row.governorate}</strong> <b>{row.percent}%</b>{" "}
                <span>
                  {" "}
                  {number(row.sold)} من {number(row.targetQuantity)} قطعة{" "}
                </span>{" "}
                <i>
                  {" "}
                  <em
                    style={{ width: `${Math.min(row.percent, 100)}%` }}
                  />{" "}
                </i>{" "}
              </article>
            ))}{" "}
            {!targetRows.length && (
              <div className="local-empty">
                {" "}
                لا توجد أهداف محفوظة لهذه الفترة.{" "}
              </div>
            )}{" "}
          </div>{" "}
        </section>
      )}{" "}
    </section>
  );
}
function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="local-dashboard-card">
      {" "}
      <span>{icon}</span> <small>{label}</small> <strong>{value}</strong>{" "}
      <p>{note}</p>{" "}
    </article>
  );
}
function Ranking({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; quantity: number; amount?: number }[];
}) {
  const top = rows[0]?.quantity || 1;
  return (
    <section className="local-ranking">
      {" "}
      <h3>{title}</h3>{" "}
      {rows.map((row, index) => (
        <div key={row.name}>
          {" "}
          <b>{index + 1}</b>{" "}
          <span>
            {" "}
            {row.name}{" "}
            <i>
              {" "}
              <em
                style={{ width: `${Math.max(8, (row.quantity / top) * 100)}%` }}
              />{" "}
            </i>{" "}
          </span>{" "}
          <strong>
            {" "}
            {number(row.quantity)} <small>قطعة</small>{" "}
          </strong>{" "}
        </div>
      ))}{" "}
      {!rows.length && <p>لا توجد بيانات لهذه الفلاتر.</p>}{" "}
    </section>
  );
}
