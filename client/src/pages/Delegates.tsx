import { ArrowRight, Users } from "lucide-react";
import { Link } from "wouter";

export function Delegates() {
  return (
    <main className="launcher">
      <div className="launcher-inner">
        <div className="launcher-brand">
          <span className="launcher-mark">
            <Users size={22} aria-hidden />
          </span>
          <h1>المندوبين</h1>
          <p>هذا القسم قيد التطوير وسيُطلق قريباً</p>
        </div>

        <div className="launcher-cards">
          <div className="launcher-card is-soon">
            <span className="launcher-card-ico">
              <Users size={30} aria-hidden />
            </span>
            <div className="launcher-card-body">
              <h2>قسم المندوبين</h2>
              <p>إدارة المندوبين والمتابعة الميدانية والعمولات</p>
            </div>
            <span className="launcher-chip chip-soon">قيد التطوير</span>
          </div>
        </div>

        <Link href="/" className="launcher-back">
          <ArrowRight size={16} aria-hidden />
          العودة إلى الرئيسية
        </Link>
      </div>
    </main>
  );
}
export default Delegates;
