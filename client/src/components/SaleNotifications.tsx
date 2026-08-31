import { Bell, CheckCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Notice = { id: string; title: string; body: string; createdAt: string; readAt: string | null };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/local${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!response.ok) throw new Error("NOTIFICATION_REQUEST_FAILED");
  return response.json() as Promise<T>;
}

export function SaleNotifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const seen = useRef(new Set<string>());

  const refresh = async () => {
    try {
      const result = await request<{ notifications: Notice[] }>("/notifications");
      const next = result.notifications || [];
      for (const item of next) {
        if (!item.readAt && seen.current.size && !seen.current.has(item.id) && Notification.permission === "granted") {
          new Notification(item.title, { body: item.body, tag: item.id });
        }
      }
      next.forEach((item) => seen.current.add(item.id));
      setItems(next);
    } catch { /* keep the dashboard usable if notifications are unavailable */ }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const unread = items.filter((item) => !item.readAt).length;
  const markAllRead = async () => {
    await request("/notifications/read", { method: "POST" });
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
  };

  return <div className="local-notifications">
    <button className="local-icon" type="button" onClick={() => setOpen((value) => !value)} aria-label="الإشعارات">
      <Bell />{unread > 0 && <em>{unread > 9 ? "9+" : unread}</em>}
    </button>
    {open && <aside className="local-notification-popover">
      <div className="local-notification-title"><strong>إشعارات المبيعات</strong><button type="button" onClick={() => setOpen(false)} aria-label="إغلاق"><X size={16} /></button></div>
      {unread > 0 && <button className="local-notification-read" type="button" onClick={() => void markAllRead()}><CheckCheck size={14} /> تم الاطلاع على الكل</button>}
      <div className="local-notification-list">
        {items.length ? items.map((item) => <article key={item.id} className={item.readAt ? "read" : ""}><strong>{item.title}</strong><span>{item.body}</span></article>) : <p>لا توجد إشعارات جديدة.</p>}
      </div>
      {typeof Notification !== "undefined" && Notification.permission === "default" && <button className="local-notification-enable" type="button" onClick={() => void Notification.requestPermission()}>تفعيل إشعارات الجهاز</button>}
    </aside>}
  </div>;
}
