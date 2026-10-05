import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { disablePush, enablePush, getSubscription, pushSupported } from "@/lib/push";

export function usePush() {
  const supported = pushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const permission = supported ? Notification.permission : "unsupported";

  useEffect(() => {
    if (!supported) return;
    getSubscription().then((sub) => {
      setSubscribed(!!sub && Notification.permission === "granted");
      if (sub) api.post("/push/subscribe", sub.toJSON()).catch(() => null);
    });
  }, [supported]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await enablePush();
      setSubscribed(true);
      toast.success("Notificações ativadas neste aparelho");
      await api.post("/push/test").catch(() => null);
    } catch (e) {
      toast.error(e.message || "Não foi possível ativar as notificações");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    await disablePush();
    setSubscribed(false);
    setBusy(false);
    toast("Notificações desativadas neste aparelho");
  }, []);

  return { supported, permission, subscribed, busy, enable, disable };
}
