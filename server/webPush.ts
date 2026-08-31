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

function configuration() {
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.PUSH_VAPID_SUBJECT || "mailto:admin@ghadeer.local";
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
