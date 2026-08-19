import { useState, useEffect } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  RefreshCw,
  Building2,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currency, type Invoice } from "./types";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  playFinancialAlertSound,
  getDueInvoices,
  type DueDebtItem,
} from "@/lib/notifications";
import { toast } from "sonner";

type NotificationCenterProps = {
  invoices: Invoice[];
  onSelectInvoice?: (invoice: Invoice) => void;
  onFilterDueOnly?: () => void;
};

export function NotificationCenter({
  invoices,
  onSelectInvoice,
  onFilterDueOnly,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, [open]);

  const dueItems: DueDebtItem[] = getDueInvoices(invoices);
  const totalDueRemaining = dueItems.reduce((sum, item) => sum + item.invoice.remaining, 0);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    if (granted) {
      toast.success("تم تفعيل إشعارات الديون بنجاح!");
      await sendTestNotification();
    } else {
      toast.error("تم رفض الإذن أو المتصفح لا يدعم الإشعارات في هذه البيئة.");
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      playFinancialAlertSound();
      const sent = await sendTestNotification();
      if (sent) {
        toast.success("تم إرسال إشعار تجريبي بنجاح!");
      } else {
        toast.info("تم تشغيل نغمة التنبيه الصوتية. فعّل إذن الإشعارات لاستقبال تنبيهات النظام.");
      }
    } catch {
      toast.error("حدث خطأ أثناء إرسال الإشعار التجريبي.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      {/* Topbar Bell Trigger Button */}
      <button
        className={`notification-bell-btn relative ${dueItems.length > 0 ? "has-due-debts" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="مركز التنبيهات وإشعارات الديون"
        title="مركز إشعارات الديون والمستحقات"
      >
        {dueItems.length > 0 ? (
          <BellRing size={18} className="text-amber-500 animate-wiggle" aria-hidden />
        ) : (
          <Bell size={18} className="text-slate-600 dark:text-slate-300" aria-hidden />
        )}

        {dueItems.length > 0 && (
          <span className="notification-counter-badge tabular">
            {dueItems.length > 99 ? "+99" : dueItems.length}
          </span>
        )}
      </button>

      {/* Notification Center Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="notification-center-dialog max-w-lg" dir="rtl">
          <DialogHeader className="border-b pb-3.5 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 grid place-items-center">
                  <BellRing size={19} />
                </div>
                <div>
                  <DialogTitle className="text-base font-extrabold flex items-center gap-2">
                    <span>تنبيهات استحقاق الديون</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold tabular">
                      {dueItems.length} مستحق
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    متابعة الفواتير والمذاخر التي بلغت أو تجاوزت تاريخ السداد (+60 يوماً)
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="notification-center-body space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
            {/* Permission / Status Strip */}
            <div className="notification-permission-card p-3 rounded-xl border bg-muted/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    permission === "granted" ? "bg-emerald-500 shadow-sm" : "bg-amber-500"
                  }`}
                />
                <div className="text-xs">
                  <strong className="block text-foreground font-bold">
                    {permission === "granted"
                      ? "إشعارات الهاتف مفعّلة بنجاح"
                      : "إشعارات الهاتف غير مفعلة"}
                  </strong>
                  <span className="text-muted-foreground text-[11px]">
                    {permission === "granted"
                      ? "يصلك تنبيه فوري ونغمة عند بلوغ أي فاتورة موعد سدادها"
                      : "فعّل الإذن لتصلك التنبيهات حتى والتطبيق في الخلفية"}
                  </span>
                </div>
              </div>

              {permission !== "granted" ? (
                <Button size="sm" onClick={handleEnableNotifications} className="h-8 text-xs font-bold shrink-0">
                  تفعيل الآن
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  disabled={testing}
                  className="h-8 text-xs font-bold shrink-0 gap-1.5"
                >
                  <Volume2 size={13} />
                  <span>تجربة الإشعار</span>
                </Button>
              )}
            </div>

            {/* Total Due Summary Box */}
            {dueItems.length > 0 && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent border border-red-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block font-bold">
                    إجمالي الديون المتأخرة والمستحقة:
                  </span>
                  <strong className="text-lg font-black text-red-600 dark:text-red-400 tabular">
                    {currency(totalDueRemaining)}
                  </strong>
                </div>
                {onFilterDueOnly && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs font-bold"
                    onClick={() => {
                      setOpen(false);
                      onFilterDueOnly();
                    }}
                  >
                    فلترة المستحق بالجدول
                  </Button>
                )}
              </div>
            )}

            {/* List of Due Invoices */}
            {dueItems.length === 0 ? (
              <div className="text-center py-10 px-4 bg-muted/20 rounded-2xl border border-dashed">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 grid place-items-center mx-auto mb-2.5">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="font-extrabold text-sm mb-1">لا توجد ديون متأخرة حالياً!</h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  جميع الفواتير والمذاخر ضمن المهلة المحددة للسداد، وسيتم تنبيهك تلقائياً فور استحقاق أي فاتورة.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  className="mt-3.5 text-xs"
                >
                  <Volume2 size={13} className="ml-1" />
                  اختبار صوت وتنبيه النظام
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-muted-foreground flex justify-between items-center px-1">
                  <span>قائمة المذاخر والفواتير المستحقة ({dueItems.length})</span>
                  <span className="text-[11px]">مرتبة حسب أعلى مبلغ متبقي</span>
                </div>

                {dueItems.map(({ invoice, daysOverdue }) => (
                  <div
                    key={invoice.id}
                    className="p-3 rounded-xl border bg-card hover:border-amber-400 dark:hover:border-amber-600 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-extrabold text-foreground truncate">
                          {invoice.warehouse || "مذخر غير محدد"}
                        </strong>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-bold">
                          {invoice.company}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold tabular bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                          {daysOverdue === 0 ? "مستحقة اليوم" : `متأخرة ${daysOverdue} يوم`}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground tabular">
                        <span>رقم الفاتورة: #{invoice.number || invoice.id}</span>
                        <span>تاريخ الاستحقاق: {invoice.dueAt}</span>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-sm font-black text-red-600 dark:text-red-400 tabular">
                        {currency(invoice.remaining)}
                      </div>
                      {onSelectInvoice && (
                        <button
                          onClick={() => {
                            setOpen(false);
                            onSelectInvoice(invoice as Invoice);
                          }}
                          className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <span>عرض وتعديل</span>
                          <ChevronLeft size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
