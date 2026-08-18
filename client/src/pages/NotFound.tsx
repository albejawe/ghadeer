import { Home as HomeIcon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <div className="not-found-icon">
          <ShieldAlert size={34} aria-hidden />
        </div>
        <h1>404</h1>
        <h2>الصفحة غير موجودة</h2>
        <p>
          عذراً، الصفحة التي تبحث عنها غير متوفرة. قد تكون انتقلت أو حُذفت.
          يمكنك العودة إلى لوحة الحسابات للمتابعة.
        </p>
        <Button size="lg" onClick={() => setLocation("/")}>
          <HomeIcon size={17} aria-hidden />
          العودة إلى حساباتي
        </Button>
      </div>
    </div>
  );
}