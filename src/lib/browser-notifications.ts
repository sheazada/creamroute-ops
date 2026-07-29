// Browser Push Notification utilities
// Handles service worker registration, push subscription, and permission management

import { toast } from "sonner";

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = "BLdJdq0AZpnIG6E0fGEEeKze3IWcKaX1iz7Ih92hwq19US-qsw_jc4UCBS2OpqA9sa0wcc0Pt2LVAufHn9k88Qk";

// Check if browser supports push notifications
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

// Check current permission status
export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    toast.error("Your browser doesn't support notifications");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast.success("Notifications enabled!");
      return true;
    } else if (permission === "denied") {
      toast.error("Notifications blocked. Please enable them in browser settings.");
      return false;
    }
    return false;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    toast.error("Failed to request notification permission");
    return false;
  }
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("[Notifications] Service Worker registered:", registration.scope);
    return registration;
  } catch (error) {
    console.error("[Notifications] Service Worker registration failed:", error);
    return null;
  }
}

// Get push subscription
export async function getPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription;
}

// Subscribe to push notifications
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    console.log("[Notifications] Subscribed to push:", subscription);
    return subscription;
  } catch (error) {
    console.error("[Notifications] Push subscription failed:", error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getPushSubscription();
  
  if (!subscription) {
    return false;
  }

  try {
    // Remove from server first
    await removeSubscriptionFromServer(subscription.endpoint);
    // Then unsubscribe from push
    await subscription.unsubscribe();
    console.log("[Notifications] Unsubscribed from push");
    return true;
  } catch (error) {
    console.error("[Notifications] Unsubscribe failed:", error);
    return false;
  }
}

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray.buffer as ArrayBuffer;
}

// Show local notification (for testing or immediate feedback)
export function showLocalNotification(title: string, body: string, icon?: string): void {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: icon || "/favicon.ico",
      badge: "/favicon.ico",
    } as NotificationOptions);
  }
}

// Initialize browser notifications (call this on app load)
export async function initializeNotifications(): Promise<void> {
  if (!isPushSupported()) {
    console.warn("[Notifications] Push not supported");
    return;
  }

  // Register service worker
  await registerServiceWorker();

  // Check permission and subscribe if needed
  const permission = getNotificationPermission();
  
  if (permission === "granted") {
    const subscription = await getPushSubscription();
    
    if (!subscription) {
      // Auto-subscribe if permission is granted
      const newSubscription = await subscribeToPush();
      
      if (newSubscription) {
        // Save subscription to server (Supabase)
        await saveSubscriptionToServer(newSubscription);
      }
    } else {
      // Already subscribed — make sure server has it
      await saveSubscriptionToServer(subscription);
    }
  }
}

// Save push subscription to server (saves to Supabase push_subscriptions table)
export async function saveSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      console.warn("[Notifications] No authenticated user, skipping subscription save");
      return;
    }

    const keys = subscription.toJSON().keys;
    if (!keys?.p256dh || !keys?.auth) {
      console.error("[Notifications] Subscription missing keys");
      return;
    }

    // Upsert: delete any existing subscription for this endpoint, then insert
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);

    const { error } = await supabase
      .from("push_subscriptions")
      .insert({
        user_id: userRes.user.id,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

    if (error) {
      console.error("[Notifications] Failed to save subscription:", error.message);
    } else {
      console.log("[Notifications] Subscription saved to server");
    }
  } catch (error) {
    console.error("[Notifications] Failed to save subscription:", error);
  }
}

// Remove push subscription from server
export async function removeSubscriptionFromServer(endpoint: string): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) {
      console.error("[Notifications] Failed to remove subscription:", error.message);
    } else {
      console.log("[Notifications] Subscription removed from server");
    }
  } catch (error) {
    console.error("[Notifications] Failed to remove subscription:", error);
  }
}

// Send notification to all subscribers (admin function)
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
  data?: Record<string, unknown>;
  url?: string; // URL to open when notification is clicked
}

// Trigger notification from client-side (for immediate feedback)
export function triggerLocalNotification(payload: NotificationPayload): void {
  if (Notification.permission === "granted") {
    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/favicon.ico",
      badge: payload.badge || "/favicon.ico",
      tag: payload.tag || "default",
      requireInteraction: payload.requireInteraction || false,
      data: {
        ...payload.data,
        url: payload.url,
      },
    });

    notification.onclick = () => {
      if (payload.url) {
        window.open(payload.url, "_blank");
      }
      notification.close();
    };
  }
}
