import { Bell, CheckCheck, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Notice = { id: string; title: string; body: string; createdAt: string; readAt: string | null };
type PushState = "idle" | "ready" | "working" | "unsupported" | "denied" | "error";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/local${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((body as { error?: string }).error || "NOTIFICATION_REQUEST_FAILED"));
  return body as T;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(normalized);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

function isInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function SaleNotifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState<PushState>("idle");
  const [activationNeeded, setActivationNeeded] = useState(false);
  const seen = useRef(new Set<string>());

  const refresh = async () => {
    try {
      const result = await request<{ notifications: Notice[] }>("/notifications");
      const next = result.notifications || [];
      next.forEach((item) => seen.current.add(item.id));
      setItems(next);
      if ("setAppBadge" in navigator) void (navigator as Navigator & { setAppBadge: (count?: number) => Promise<void> }).setAppBadge(next.filter((item) => !item.readAt).length);
    } catch { /* the main dashboard remains available if polling is offline */ }
  };

  useEffect(() => {
    void refresh();
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) setPushState("unsupported");
    else if (Notification.permission === "denied") setPushState("denied");
    else if (isInstalledApp() && Notification.permission === "default") setActivationNeeded(true);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const subscribe = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setPushState("unsupported"); return; }
    setPushState("working");
    try {
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") { setPushState("denied"); return; }
      const keyResponse = await request<{ publicKey: string }>("/push/public-key");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyResponse.publicKey) });
      await request("/push/subscribe", { method: "POST", body: JSON.stringify({ subscription: subscription.toJSON() }) });
      setActivationNeeded(false);
      setPushState("ready");
      await request("/push/test", { method: "POST" });
    } catch { setPushState("error"); }
  };

  const unread = items.filter((item) => !item.readAt).length;
  const markAllRead = async () => {
    await request("/notifications/read", { method: "POST" });
    setItems((previous) => previous.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    if ("clearAppBadge" in navigator) void (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
  };

  return <>
    {activationNeeded && <aside className="local-push-activation" role="status"><Smartphone size={19} /><div><strong>فعّل إشعارات غدير</strong><span>ستصلك مبيعات المشرفين حتى عند إغلاق التطبيق.</span></div><button type="button" onClick={() => void subscribe()}>تفعيل الآن</button></aside>}
    <div className="local-notifications">
      <button className="local-icon" type="button" onClick={() => setOpen((value) => !value)} aria-label="الإشعارات"><Bell />{unread > 0 && <em>{unread > 9 ? "9+" : unread}</em>}</button>
      {open && <aside className="local-notification-popover">
        <div className="local-notification-title"><strong>إشعارات المبيعات</strong><button type="button" onClick={() => setOpen(false)} aria-label="إغلاق"><X size={16} /></button></div>
        {pushState !== "ready" && <button className="local-notification-enable" type="button" disabled={pushState === "working" || pushState === "unsupported"} onClick={() => void subscribe()}>{pushState === "working" ? "جارٍ التفعيل..." : pushState === "denied" ? "الإذن مرفوض من الجهاز" : pushState === "unsupported" ? "الإشعارات غير مدعومة هنا" : "تفعيل إشعارات الخلفية"}</button>}
        {pushState === "ready" && <p className="local-push-ready">الإشعارات الخلفية مفعّلة لهذا الجهاز.</p>}
        {pushState === "error" && <p className="local-push-error">تعذر التفعيل الآن. تأكد من الاتصال ثم حاول مجدداً.</p>}
        {unread > 0 && <button className="local-notification-read" type="button" onClick={() => void markAllRead()}><CheckCheck size={14} /> تم الاطلاع على الكل</button>}
        <div className="local-notification-list">{items.length ? items.map((item) => <article key={item.id} className={item.readAt ? "read" : ""}><strong>{item.title}</strong><span>{item.body}</span></article>) : <p>لا توجد إشعارات جديدة.</p>}</div>
      </aside>}
    </div>
  </>;
}