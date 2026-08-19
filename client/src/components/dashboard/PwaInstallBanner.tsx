import { useState, useEffect } from "react";
import { Download, Smartphone, Share, PlusSquare, CheckCircle2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed & running standalone
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleDevice);

    // Listen for install prompt on Android / Chromium
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Check localStorage dismissal
    const isDismissed = localStorage.getItem("hisabati_pwa_dismissed") === "true";
    setDismissed(isDismissed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  if (isStandalone || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("تم تثبيت التطبيق بنجاح على جهازك!");
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("hisabati_pwa_dismissed", "true");
  };

  return (
    <>
      {/* Floating Install Prompt Strip */}
      <div className="pwa-install-strip p-3 px-4 rounded-2xl border bg-card/95 backdrop-blur-md shadow-lg flex items-center justify-between gap-3 text-right" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white grid place-items-center shrink-0 shadow-md">
            <Smartphone size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <strong className="text-xs font-black text-foreground">تثبيت تطبيق حساباتي على هاتفك</strong>
              <span className="text-[10px] bg-teal-500/15 text-teal-600 dark:text-teal-400 font-bold px-1.5 py-0.5 rounded-full">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              يعمل كتطبيق سريع وخفيف بدون استهلاك مساحة، ويدعم الإشعارات اللحظية ومتابعة الديون
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="h-8 px-3.5 text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white shadow-sm gap-1.5"
          >
            <Download size={13} />
            <span>تثبيت التطبيق</span>
          </Button>

          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors"
            aria-label="إغلاق التنبيه"
            title="إغلاق التنبيه"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* iOS Installation Instructions Modal */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Smartphone size={18} className="text-teal-600" />
              <span>تثبيت تطبيق حساباتي على الآيفون / الهاتف</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-muted-foreground">
              لتثبيت التطبيق واستقبال إشعارات الديون المستحقة بشكل كامل على أجهزة Apple iOS:
            </p>

            <div className="space-y-2.5 bg-muted/40 p-3.5 rounded-xl border">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[11px] grid place-items-center shrink-0">
                  1
                </span>
                <div>
                  <strong className="block text-foreground font-bold">افتح متصفح Safari</strong>
                  <span className="text-muted-foreground text-[11px]">تأكد من فتح الرابط داخل متصفح سفاري على الآيفون.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[11px] grid place-items-center shrink-0">
                  2
                </span>
                <div>
                  <strong className="block text-foreground font-bold flex items-center gap-1">
                    <span>اضغط على زر المشاركة</span>
                    <Share size={13} className="text-teal-600" />
                  </strong>
                  <span className="text-muted-foreground text-[11px]">في أسفل شاشة المتصفح.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[11px] grid place-items-center shrink-0">
                  3
                </span>
                <div>
                  <strong className="block text-foreground font-bold flex items-center gap-1">
                    <span>اختر "إضافة إلى الصفحة الرئيسية"</span>
                    <PlusSquare size={13} className="text-teal-600" />
                  </strong>
                  <span className="text-muted-foreground text-[11px]">
                    (Add to Home Screen) وسيظهر التطبيق على شاشة هاتفك فوراً.
                  </span>
                </div>
              </div>
            </div>

            <Button
              className="w-full font-bold text-xs mt-2"
              onClick={() => setShowIosGuide(false)}
            >
              فهمت ذلك، تم
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PwaInstallHeaderButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  if (isStandalone) {
    return null;
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("تم تثبيت التطبيق بنجاح!");
        setDeferredPrompt(null);
      }
    } else {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleInstall}
        className="text-xs font-bold gap-1.5 text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20"
        title="تثبيت التطبيق على جهازك (PWA)"
      >
        <Download size={13} />
        <span className="hidden sm:inline">تثبيت التطبيق</span>
      </Button>

      {/* iOS Modal */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Smartphone size={18} className="text-teal-600" />
              <span>تثبيت تطبيق حساباتي على الآيفون / الهاتف</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-muted-foreground">
              لتثبيت التطبيق واستقبال إشعارات الديون المستحقة على أجهزة الآيفون والهواتف:
            </p>

            <div className="space-y-2.5 bg-muted/40 p-3.5 rounded-xl border">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[11px] grid place-items-center shrink-0">1</span>
                <div>
                  <strong className="block text-foreground font-bold">افتح متصفح Safari</strong>
                  <span className="text-muted-foreground text-[11px]">على هاتفك الذكي.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[11px] grid place-items-center shrink-0">2</span>
                <div>
                  <strong className="block text-foreground font-bold flex items-center gap-1">
                    <span>اضغط على زر المشاركة</span>
                    <Share size={13} className="text-teal-600" />
                  </strong>
                  <span className="text-muted-foreground text-[11px]">في أسفل شاشة المتصفح.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[11px] grid place-items-center shrink-0">3</span>
                <div>
                  <strong className="block text-foreground font-bold flex items-center gap-1">
                    <span>اختر "إضافة إلى الصفحة الرئيسية"</span>
                    <PlusSquare size={13} className="text-teal-600" />
                  </strong>
                  <span className="text-muted-foreground text-[11px]">(Add to Home Screen).</span>
                </div>
              </div>
            </div>

            <Button className="w-full font-bold text-xs mt-2" onClick={() => setShowIosGuide(false)}>
              حسناً
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
