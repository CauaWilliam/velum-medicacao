import { BellRing, LogOut, Smartphone, Globe, ShieldCheck, Search, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { usePush } from "@/hooks/usePush";

const PushCard = () => {
  const { supported, subscribed, permission, busy, enable, disable } = usePush();
  return (
    <div className={`p-5 rounded-3xl border ${subscribed ? "bg-sage-light border-[#B3CBC0]" : "bg-white border-sand-line"}`} data-testid="push-card">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white text-sage flex items-center justify-center shrink-0"><BellRing className="w-6 h-6" /></div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Notificações push</h2>
          <p className="text-ink-soft text-sm" data-testid="push-status-text">
            {!supported ? "Não suportado neste navegador" : permission === "denied" ? "Bloqueadas no navegador" : subscribed ? "Ativas neste aparelho" : "Desativadas"}
          </p>
        </div>
        <Switch checked={subscribed} disabled={!supported || busy || permission === "denied"} onCheckedChange={(v) => (v ? enable() : disable())} data-testid="push-notification-toggle" className="scale-125" />
      </div>
      <p className="text-sm text-ink-soft mt-4 leading-relaxed">
        Medicações: aviso no horário exato de cada dose. Compromissos: aviso 1 dia e 2 horas antes.
      </p>
    </div>
  );
};

const ROLE_LABELS = { caregiver: "Cuidador(a)", family: "Família", admin: "Administrador" };

const AdminLinks = () => {
  const { data } = useQuery({ queryKey: ["admin-counts"], queryFn: () => api.get("/admin/ads/counts").then((r) => r.data) });
  const cls = "flex items-center gap-4 p-5 rounded-3xl bg-white border border-sand-line hover:shadow-md transition-shadow";
  return (
    <div className="space-y-3">
      <Link to="/admin/anuncios" className={cls} data-testid="admin-ads-link">
        <ShieldCheck className="w-7 h-7 text-clay" />
        <div className="flex-1"><b className="text-lg">Aprovar anúncios</b><p className="text-ink-soft text-sm" data-testid="admin-pending-count">{data?.pending ?? 0} aguardando revisão</p></div>
        <ChevronRight className="w-6 h-6 text-ink-soft" />
      </Link>
      <Link to="/buscar" className={cls} data-testid="admin-market-link">
        <Search className="w-7 h-7 text-sage" />
        <div className="flex-1"><b className="text-lg">Ver marketplace</b><p className="text-ink-soft text-sm">Como as famílias veem os anúncios</p></div>
        <ChevronRight className="w-6 h-6 text-ink-soft" />
      </Link>
    </div>
  );
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  return (
    <div className="px-5 pt-8 space-y-6">
      <header className="fade-up">
        <h1 className="font-heading text-4xl font-bold tracking-tight">Perfil</h1>
      </header>
      <div className="p-5 rounded-3xl bg-white border border-sand-line flex items-center gap-4 fade-up">
        <div className="w-14 h-14 rounded-full bg-clay text-white flex items-center justify-center font-heading text-2xl font-bold shrink-0">{(user?.name || "?").charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <div className="text-xl font-bold break-words" data-testid="profile-name">{user?.name}</div>
          <div className="text-ink-soft break-all" data-testid="profile-email">{user?.email}</div>
          <div className="text-sm text-ink-soft inline-flex items-center gap-1 mt-1"><Globe className="w-4 h-4" />{user?.timezone} · <span data-testid="profile-role">{ROLE_LABELS[user?.role]}</span></div>
        </div>
      </div>
      {user?.role === "admin" && <AdminLinks />}
      {user?.role !== "family" && <PushCard />}
      <div className="p-5 rounded-3xl bg-sand-deep flex gap-4" data-testid="install-hint">
        <Smartphone className="w-6 h-6 text-sage shrink-0 mt-0.5" />
        <p className="text-base leading-relaxed">
          <strong>Instale o Velum no celular:</strong> no Android, toque em "Adicionar à tela inicial" no menu do navegador. No iPhone, toque em Compartilhar → "Adicionar à Tela de Início".
        </p>
      </div>
      <button onClick={logout} data-testid="logout-button" className="w-full h-14 rounded-2xl border-2 border-sand-line text-clay text-lg font-bold flex items-center justify-center gap-2 hover:bg-clay-light transition-colors">
        <LogOut className="w-5 h-5" /> Sair da conta
      </button>
    </div>
  );
}
