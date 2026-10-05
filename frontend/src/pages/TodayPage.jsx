import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sprout, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { todayLong } from "@/lib/time";
import { useAuth } from "@/context/AuthContext";
import { useNow } from "@/hooks/useNow";
import { AgendaItemCard } from "@/components/AgendaItemCard";
import { PushBanner } from "@/components/PushBanner";

const Section = ({ title, items, testId, tone = "text-ink" }) =>
  items.length > 0 && (
    <section className="space-y-3" data-testid={testId}>
      <h2 className={`font-heading text-xl font-semibold ${tone}`}>{title} <span className="text-ink-soft font-normal">({items.length})</span></h2>
      <div className="space-y-4">{items.map((i) => <AgendaItemCard key={i.occurrence_key} item={i} />)}</div>
    </section>
  );

const Stat = ({ label, value, cls, testId }) => (
  <div className={`rounded-2xl p-3 text-center ${cls}`} data-testid={testId}>
    <div className="font-heading text-3xl font-bold">{value}</div>
    <div className="text-sm font-semibold">{label}</div>
  </div>
);

export default function TodayPage() {
  const { user } = useAuth();
  const now = useNow(15000);
  const { data, isLoading } = useQuery({ queryKey: ["agenda"], queryFn: () => api.get("/agenda/today").then((r) => r.data), refetchInterval: 60000 });
  const { data: patients } = useQuery({ queryKey: ["patients"], queryFn: () => api.get("/patients").then((r) => r.data) });
  const items = data?.items || [];
  const late = items.filter((i) => !i.status && new Date(i.scheduled_at).getTime() < now);
  const upcoming = items.filter((i) => !i.status && new Date(i.scheduled_at).getTime() >= now);
  const done = items.filter((i) => i.status);
  const firstName = (user?.name || "").split(" ")[0];

  return (
    <div className="px-5 pt-8 space-y-7">
      <header className="fade-up">
        <p className="text-ink-soft text-base first-letter:uppercase" data-testid="today-date">{todayLong()}</p>
        <h1 className="font-heading text-4xl font-bold tracking-tight mt-1" data-testid="today-greeting">Olá, {firstName}</h1>
      </header>
      <PushBanner />
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 fade-up">
          <Stat label="Atrasados" value={late.length} cls="bg-alert-light text-alert" testId="stat-late" />
          <Stat label="A fazer" value={upcoming.length} cls="bg-sage-light text-sage-dark" testId="stat-upcoming" />
          <Stat label="Registrados" value={done.length} cls="bg-sand-deep text-ink" testId="stat-done" />
        </div>
      )}
      {isLoading && <div className="h-40 rounded-3xl bg-sand-deep animate-pulse" />}
      {!isLoading && items.length === 0 && (
        <div className="text-center py-12 px-6 rounded-3xl bg-white border border-sand-line fade-up" data-testid="today-empty">
          <Sprout className="w-12 h-12 mx-auto text-sage" />
          <h2 className="font-heading text-xl font-semibold mt-3">Nada agendado para hoje</h2>
          <p className="text-ink-soft mt-1">
            {patients?.length ? "Cadastre medicações ou compromissos nos seus pacientes." : "Comece cadastrando o primeiro paciente."}
          </p>
          <Link to="/pacientes" className="mt-5 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-sage text-white font-bold" data-testid="today-go-patients">
            <UserPlus className="w-5 h-5" /> Ver pacientes
          </Link>
        </div>
      )}
      <Section title="Atrasados" items={late} testId="section-late" tone="text-alert" />
      <Section title="Próximos" items={upcoming} testId="section-upcoming" />
      <Section title="Já registrados" items={done} testId="section-done" tone="text-ink-soft" />
    </div>
  );
}
