import type { InvoiceRecord } from "@shared/invoiceLogic";

const NOTIFIED_STORAGE_KEY = "hisabati_notified_due_invoices_v1";
const NOTIFICATION_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours cooldown per invoice

// =============================================================================
// Web Audio API Synth: Generates a clear, elegant financial alert chime
// =============================================================================
export function playFinancialAlertSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.22, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone (A5 - 880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0.28, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.debug("[AudioAlert] AudioContext could not play automatically:", err);
  }
}

// =============================================================================
// Device Vibration Helper
// =============================================================================
export function triggerDeviceVibration(pattern: number[] = [200, 100, 200, 100, 250]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration error on unsupported platforms
    }
  }
}

// =============================================================================
// Notification Permission Helpers
// =============================================================================
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      playFinancialAlertSound();
      triggerDeviceVibration([100, 50, 100]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[Notifications] Request permission failed:", err);
    return false;
  }
}

// =============================================================================
// Notification Dispatcher (Service Worker / Native API)
// =============================================================================
export async function sendSystemNotification({
  title,
  body,
  tag,
  url = "/dashboard?filter=due",
  warehouse,
  remaining,
}: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  warehouse?: string;
  remaining?: number;
}): Promise<boolean> {
  // Always trigger acoustic chime and mobile vibration
  playFinancialAlertSound();
  triggerDeviceVibration();

  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  // 1. Try sending via Service Worker Registration (Best for Android / PWA)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: tag || `due-${Date.now()}`,
          renotify: true,
          vibrate: [200, 100, 200, 100, 200],
          data: { url, warehouse, remaining },
        } as any);
        return true;
      }
    } catch (swErr) {
      console.warn("[Notifications] SW showNotification failed, fallback to native:", swErr);
    }
  }

  // 2. Fallback to standard Window Notification
  try {
    const notification = new Notification(title, {
      body,
      icon: "/icon.svg",
      tag: tag || `due-${Date.now()}`,
      data: { url },
    });

    notification.onclick = () => {
      window.focus();
      if (window.location.pathname !== "/dashboard") {
        window.location.href = url;
      }
      notification.close();
    };
    return true;
  } catch (nativeErr) {
    console.warn("[Notifications] Native Notification constructor failed:", nativeErr);
    return false;
  }
}

// =============================================================================
// Local Storage History Helper (Prevent notification flooding)
// =============================================================================
type NotifiedLog = Record<string, number>; // invoiceId -> timestamp

function getNotifiedHistory(): NotifiedLog {
  try {
    const raw = localStorage.getItem(NOTIFIED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordNotifiedInvoice(id: string) {
  try {
    const history = getNotifiedHistory();
    history[id] = Date.now();
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage issues
  }
}

// =============================================================================
// Core Business Logic: Check Due Debts & Fire Smart Notifications
// =============================================================================
export type DueDebtItem = {
  invoice: InvoiceRecord;
  daysOverdue: number;
};

export function getDueInvoices(invoices: InvoiceRecord[], today = new Date()): DueDebtItem[] {
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  return invoices
    .filter((inv) => {
      if (!inv.remaining || inv.remaining <= 0) return false;
      const dueMs = new Date(inv.dueAt).getTime();
      return dueMs <= todayMs;
    })
    .map((inv) => {
      const dueMs = new Date(inv.dueAt).getTime();
      const diffDays = Math.max(0, Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24)));
      return { invoice: inv, daysOverdue: diffDays };
    })
    .sort((a, b) => b.invoice.remaining - a.invoice.remaining);
}

/**
 * Automatically checks all invoices for reached payment deadlines and triggers notifications.
 */
export async function checkDueInvoicesAndNotify(
  invoices: InvoiceRecord[],
  options: { force?: boolean; notifyIndividual?: boolean } = {}
): Promise<{ dueCount: number; notifiedCount: number }> {
  const dueItems = getDueInvoices(invoices);
  if (dueItems.length === 0) {
    return { dueCount: 0, notifiedCount: 0 };
  }

  const history = getNotifiedHistory();
  const now = Date.now();
  let notifiedCount = 0;

  // Filter items that need notification (not notified within cooldown unless forced)
  const pendingItems = dueItems.filter((item) => {
    if (options.force) return true;
    const lastTime = history[item.invoice.id];
    return !lastTime || now - lastTime > NOTIFICATION_COOLDOWN_MS;
  });

  if (pendingItems.length === 0) {
    return { dueCount: dueItems.length, notifiedCount: 0 };
  }

  if (pendingItems.length === 1 || options.notifyIndividual) {
    // Notify top due invoice individually
    const topItem = pendingItems[0];
    const { invoice, daysOverdue } = topItem;
    const timeText = daysOverdue === 0 ? "حان موعد سدادها اليوم" : `متأخرة عن السداد منذ ${daysOverdue} يوم`;

    const title = `⚠️ تنبيه استحقاق: ${invoice.warehouse || "مذخر غير محدد"}`;
    const body = `فاتورة رقم #${invoice.number || invoice.id} (${invoice.company}) بمبلغ متبقي ${invoice.remaining.toLocaleString()} د.ع ${timeText}.`;

    await sendSystemNotification({
      title,
      body,
      tag: `due-invoice-${invoice.id}`,
      url: `/dashboard?number=${encodeURIComponent(invoice.number || "")}&quick=المستحق+الآن`,
      warehouse: invoice.warehouse,
      remaining: invoice.remaining,
    });

    recordNotifiedInvoice(invoice.id);
    notifiedCount++;
  } else {
    // Group notification for multiple due debts
    const totalRemaining = pendingItems.reduce((sum, item) => sum + item.invoice.remaining, 0);
    const topWarehouses = Array.from(new Set(pendingItems.map((i) => i.invoice.warehouse).filter(Boolean))).slice(0, 3).join("، ");

    const title = `🔔 ${pendingItems.length} فواتير بلغت حد الدفع والاستحقاق`;
    const body = `إجمالي المستحقات: ${totalRemaining.toLocaleString()} د.ع تشمل (${topWarehouses}). يرجى المتابعة والتحصيل الفوري.`;

    await sendSystemNotification({
      title,
      body,
      tag: "due-invoices-summary",
      url: "/dashboard?quick=المستحق+الآن",
      remaining: totalRemaining,
    });

    pendingItems.forEach((item) => recordNotifiedInvoice(item.invoice.id));
    notifiedCount = pendingItems.length;
  }

  return { dueCount: dueItems.length, notifiedCount };
}

/**
 * Sends an immediate manual test notification to confirm the system works on the device.
 */
export async function sendTestNotification(): Promise<boolean> {
  const perm = getNotificationPermission();
  if (perm !== "granted") {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
  }

  return sendSystemNotification({
    title: "✅ تم تفعيل إشعارات الديون بنجاح — حساباتي",
    body: "نظام التنبيهات يعمل الآن على هاتفك وسيقوم بإشعارك فور وصول أي مذخر أو فاتورة لتاريخ الاستحقاق.",
    tag: "test-notification",
    url: "/dashboard",
  });
}
