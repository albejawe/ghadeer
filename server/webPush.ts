import dotenv from "dotenv";
import webpush from "web-push";

// The deployment uses environment variables. A local .env is intentionally
// ignored by Git and gives the desktop development server the same behavior.
dotenv.config({ path: ".env", override: false, quiet: true });

export type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function resolveVapidSubject(value?: string) {
  const fallback = "https://ghadeer-seven.vercel.app";
  const candidate = value?.trim();
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:") {
      const host = parsed.hostname.toLowerCase();
      return host && host !== "localhost" && !host.endsWith(".local")
        ? candidate
        : fallback;
    }
    if (parsed.protocol === "mailto:") {
      const address = decodeURIComponent(parsed.pathname).toLowerCase();
      const domain = address.split("@").pop() || "";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) &&
        domain !== "localhost" &&
        !domain.endsWith(".local")
        ? candidate
        : fallback;
    }
  } catch {
    // Apple rejects malformed VAPID subjects with 403 BadJwtToken.
  }
  return fallback;
}

function configuration() {
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  const subject = resolveVapidSubject(process.env.PUSH_VAPID_SUBJECT);
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey };
}

export function pushPublicKey() {
  return configuration()?.publicKey || null;
}

export function isPushConfigured() {
  return Boolean(configuration());
}

export async function sendPush(subscription: StoredPushSubscription, payload: Record<string, unknown>) {
  if (!configuration()) throw new Error("PUSH_NOT_CONFIGURED");
  return webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  }, JSON.stringify(payload), { TTL: 86_400, urgency: "high" });
}
