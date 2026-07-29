// Notification Manager Component
// Handles notification permission and subscription management

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  initializeNotifications,
  getPushSubscription,
  unsubscribeFromPush,
} from "@/lib/browser-notifications";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function NotificationManager({ className }: { className?: string }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isPushSupported());
    
    if (isPushSupported()) {
      initializeNotifications().then(() => {
        checkSubscriptionStatus();
      });
    }
  }, []);

  const checkSubscriptionStatus = async () => {
    const subscription = await getPushSubscription();
    setIsSubscribed(!!subscription);
  };

  const handleEnable = async () => {
    if (!supported) {
      toast.error("Your browser doesn't support push notifications");
      return;
    }

    setLoading(true);

    try {
      const granted = await requestNotificationPermission();
      
      if (granted) {
        setPermission("granted");
        await initializeNotifications();
        await checkSubscriptionStatus();
      } else {
        setPermission("denied");
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);

    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
      toast.success("Notifications disabled");
    } catch (error) {
      console.error("Error disabling notifications:", error);
      toast.error("Failed to disable notifications");
    } finally {
      setLoading(false);
    }
  };

  const openBrowserSettings = () => {
    // Open browser notification settings
    toast.info(
      "Please enable notifications in your browser settings",
      {
        description: "Go to Settings → Privacy → Notifications",
        duration: 5000,
      }
    );
  };

  if (!supported) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <AlertCircle className="size-4" />
        <span>Notifications not supported</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {permission === "granted" ? (
        <>
          {isSubscribed ? (
            <>
              <BellRing className="size-4 text-success" />
              <span className="text-xs">Notifications on</span>
              <button
                onClick={handleDisable}
                disabled={loading}
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                {loading ? "..." : "Disable"}
              </button>
            </>
          ) : (
            <>
              <Bell className="size-4 text-warning" />
              <span className="text-xs">Setting up...</span>
            </>
          )}
        </>
      ) : permission === "denied" ? (
        <>
          <BellOff className="size-4 text-destructive" />
          <span className="text-xs text-destructive">Blocked</span>
          <button
            onClick={openBrowserSettings}
            className="text-xs text-primary hover:underline"
          >
            Enable
          </button>
        </>
      ) : (
        <>
          <Bell className="size-4 text-muted-foreground" />
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Enabling...
              </>
            ) : (
              "Enable notifications"
            )}
          </button>
        </>
      )}
    </div>
  );
}
