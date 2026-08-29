import { Activity, Boxes, Building2, PackageCheck, Target, TrendingUp, UsersRound, WalletCards } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DashboardData, formatMoney, formatNumber } from "./api";

function Metric({ icon: Icon, label, value, note, tone = "plain" }: { icon: typeof Activity; label: string; value: string; note: string; tone?: "plain" | "dark" | "green" | "amber" }) {
  return <article className={`gh-metric gh-metric-${tone}`}><div className="gh-metric-head"><span>{label}</span><i><Icon /></i></div><strong>{value}</strong><small>{note}</small></article>;
}

function Ranking({ title, eyebrow, rows, empty }: { title: string; eyebrow: string; rows: Array<{ id: string; name: string; meta: string; quantity: number; amount: number }>; empty: string }) {
  const max = Math.max(...rows.map((row) => Number(row.quantity)), 1);
  return <section className="gh-panel gh-ranking"><header><div><span>{eyebrow}</span><h3>{title}</h3></div><TrendingUp /></header><div className="gh-ranking-list">{rows.map((row, index) => <article key={row.id}><b>{index + 1}</b><div><strong>{row.name}</strong><small>{row.meta}</small><i style={{ width: `${Math.max(8, (Number(row.quantity) / max) * 100)}%` }} /></div><aside><strong>{formatNumber(row.quantity)}</strong><small>{formatMoney(row.amount)}</small></aside></article>)}{!rows.length && <div className="gh-empty-small">{empty}</div>}</div></section>;
}

export function Overview({ data }: { data: DashboardData }) {
  const summary = data.summary;
  const maxTrend = Math.max(...data.trend.map((item) => Number(item.quantity)), 1);
  return <div className="gh-page-stack">
    <section className="gh-metrics-grid">
      <Metric icon={Building2} label="إجمالي مبيعات المذاخر" value={`${formatNumber(summary.warehouseQuantity)} قطعة`} note="كل المبيعات الخارجة من المحافظات" tone="dark" />
      <Metric icon={UsersRound} label="عن طريق المندوبين" value={`${formatNumber(summary.representativeQuantity)} قطعة`} note={`${formatNumber(summary.operations)} عملية مسجلة`} tone="green" />
      <Metric icon={PackageCheck} label="بيع المذخر المباشر" value={`${formatNumber(summary.directQuantity)} قطعة`} note="بعد طرح مبيعات المندوبين" />
      <Metric icon={Target} label="تحقيق الهدف" value={`${formatNumber(summary.achievement)}%`} note={`الهدف ${formatNumber(summary.targetQuantity)} قطعة`} tone={summary.achievement >= 100 ? "green" : "amber"} />
      <Metric icon={WalletCards} label="قيمة مبيعات المندوبين" value={formatMoney(summary.representativeAmount)} note="محسوبة من سعر المادة وقت البيع" />
    </section>

    <section className="gh-governorates-section">
      <header className="gh-section-title"><div><span>مقارنة المحافظات</span><h2>أين وصلنا هذا الشهر؟</h2></div><Boxes /></header>
      <div className="gh-governorate-grid">{data.governorates.map((gov) => <article className="gh-gov-card" key={gov.id}>
        <header><div><strong>{gov.name}</strong><small>{gov.operations} عملية مندوب</small></div><b className={gov.achievement >= 100 ? "is-good" : gov.achievement >= 70 ? "is-near" : "is-low"}>{formatNumber(gov.achievement)}%</b></header>
        <div className="gh-gov-main"><strong>{formatNumber(gov.warehouseQuantity)}</strong><span>قطعة إجمالي</span></div>
        <Progress value={Math.min(gov.achievement, 100)} className="gh-progress" />
        <div className="gh-gov-split"><span><small>المندوبون</small><b>{formatNumber(gov.representativeQuantity)}</b></span><span><small>المباشر</small><b>{formatNumber(gov.directQuantity)}</b></span><span><small>الهدف</small><b>{formatNumber(gov.targetQuantity)}</b></span></div>
        <footer>حصة المندوبين <b>{formatNumber(gov.representativeShare)}%</b></footer>
      </article>)}</div>
    </section>

    <section className="gh-analytics-grid">
      <Ranking eyebrow="حسب عدد القطع" title="المواد الأكثر مبيعاً" rows={data.topMaterials.map((row) => ({ ...row, meta: row.company }))} empty="لا توجد مبيعات مواد لهذه الفترة." />
      <Ranking eyebrow="أداء الفريق" title="ترتيب المندوبين" rows={data.topRepresentatives.map((row) => ({ ...row, meta: row.governorate }))} empty="لا توجد مبيعات مندوبين لهذه الفترة." />
      <section className="gh-panel gh-company-panel"><header><div><span>الحصة من القطع</span><h3>أداء الشركات</h3></div><Building2 /></header><div className="gh-company-list">{data.companies.map((row) => { const total = Math.max(summary.representativeQuantity, 1); const share = (Number(row.quantity) / total) * 100; return <article key={row.id}><div><strong>{row.name}</strong><b>{formatNumber(row.quantity)} قطعة</b></div><i><span style={{ width: `${share}%` }} /></i><small>{formatNumber(share.toFixed(1))}% · {formatMoney(row.amount)}</small></article>; })}{!data.companies.length && <div className="gh-empty-small">لا توجد مبيعات شركات لهذه الفترة.</div>}</div></section>
    </section>

    <section className="gh-bottom-grid">
      <section className="gh-panel gh-trend"><header><div><span>التوزيع اليومي</span><h3>حركة المبيعات خلال الشهر</h3></div><Activity /></header><div className="gh-trend-bars">{data.trend.map((item) => <div key={item.date} title={`${item.date}: ${item.quantity}`}><i style={{ height: `${Math.max(7, (Number(item.quantity) / maxTrend) * 100)}%` }} /><span>{item.date.slice(-2)}</span></div>)}{!data.trend.length && <div className="gh-empty-small">سيظهر الرسم بعد أول عملية بيع.</div>}</div></section>
      <section className="gh-panel gh-recent"><header><div><span>آخر النشاطات</span><h3>آخر الإدخالات</h3></div><Activity /></header><div>{data.recent.map((row) => <article key={row.id}><i>{row.quantity}</i><div><strong>{row.material}</strong><small>{row.representative} · {row.governorate}</small></div><aside><b>{row.saleDate}</b><small>{row.supervisor}</small></aside></article>)}{!data.recent.length && <div className="gh-empty-small">لا توجد إدخالات لهذه الفترة.</div>}</div></section>
    </section>
  </div>;
}

