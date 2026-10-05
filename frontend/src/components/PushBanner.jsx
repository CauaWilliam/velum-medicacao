import { BellRing, BellOff } from "lucide-react";
import { usePush } from "@/hooks/usePush";

export const PushBanner = () => {
  const { supported, subscribed, permission, busy, enable } = usePush();
  if (subscribed) return null;
  const blocked = permission === "denied";
  return (
    <div data-testid="push-banner" className="fade-up bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] p-4 rounded-3xl flex items-center gap-3">
      <div className="w-11 h-11 shrink-0 rounded-2xl bg-white/70 flex items-center justify-center">
        {blocked || !supported ? <BellOff className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
      </div>
      <p className="flex-1 text-base leading-snug">
        {!supported
          ? "Para receber lembretes, instale o Velum na tela inicial do celular."
          : blocked
          ? "Notificações bloqueadas. Libere nas configurações do navegador."
          : "Ative os lembretes para não perder nenhum horário."}
      </p>
      {supported && !blocked && (
        <button onClick={enable} disabled={busy} data-testid="push-enable-button" className="shrink-0 bg-[#92400E] text-white px-4 h-11 rounded-full text-sm font-bold active:scale-95 transition-transform disabled:opacity-60">
          {busy ? "..." : "Ativar"}
        </button>
      )}
    </div>
  );
};
