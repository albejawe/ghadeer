import { ArrowLeft, Users, Warehouse } from "lucide-react";
import { Link } from "wouter";

export function Launcher() {  return (
    <main className="launcher">
      <div className="launcher-inner">
        <div className="launcher-brand">
          <span className="launcher-mark">
            <Warehouse size={22} aria-hidden />
          </span>
          <h1>نظام غدير المحاسبي</h1>
          <p>اختر القسم الذي تريد العمل فيه</p>
        </div>

        <div className="launcher-cards">
          <Link href="/dashboard" className="launcher-card">
            <span className="launcher-card-ico">
              <Warehouse size={30} aria-hidden />
            </span>
            <div className="launcher-card-body">
              <h2>المذاخر</h2>
              <p>إدارة الفواتير والمستودعات والتقارير والروابط المشتركة</p>
            </div>
            <span className="launcher-chip chip-live">متاح الآن</span>
            <ArrowLeft className="launcher-arrow" size={20} aria-hidden />
          </Link>

          <Link href="/delegates" className="launcher-card">
            <span className="launcher-card-ico">
              <Users size={30} aria-hidden />
            </span>
            <div className="launcher-card-body">
              <h2>المندوبين</h2>
              <p>إدارة المندوبين والمتابعة الميدانية</p>
            </div>
            <span className="launcher-chip chip-soon">قيد التطوير</span>
            <ArrowLeft className="launcher-arrow" size={20} aria-hidden />
          </Link>
        </div>
      </div>
    </main>
  );
}
export default Launcher;
