import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Inbox, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/time";

const Row = ({ item }) => {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-bold break-words">{item.caregiver_name}</h3>
        {item.city && <p className="text-ink-soft">{item.city}</p>}
        {item.message && <p className="mt-1 text-base break-words line-clamp-2">"{item.message}"</p>}
        <p className="text-sm text-ink-soft mt-1">Enviado em {fmtDateTime(item.created_at)} · {item.seen ? "Visto pelo cuidador" : "Ainda não visto"}</p>
      </div>
      {item.ad_available && <ChevronRight className="w-6 h-6 text-ink-soft shrink-0" />}
    </>
  );
  const cls = "flex items-center gap-3 p-5 rounded-3xl bg-white border border-sand-line fade-up";
  return item.ad_available
    ? <Link to={`/cuidadores/${item.ad_id}`} className={cls} data-testid={`sent-interest-${item.id}`}>{body}</Link>
    : <div className={`${cls} opacity-70`} data-testid={`sent-interest-${item.id}`}>{body}</div>;
};

export default function MyInterestsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["my-interests"], queryFn: () => api.get("/marketplace/my-interests").then((r) => r.data) });
  return (
    <div className="px-5 pt-8 space-y-6">
      <header className="fade-up">
        <h1 className="font-heading text-4xl font-bold tracking-tight">Meus pedidos</h1>
        <p className="text-ink-soft text-base mt-1">Cuidadores com quem você pediu contato</p>
      </header>
      {isLoading && <div className="h-24 rounded-3xl bg-sand-deep animate-pulse" />}
      {!isLoading && !data.length && (
        <div className="text-center py-12 px-6 rounded-3xl bg-white border border-sand-line" data-testid="sent-interests-empty">
          <Inbox className="w-12 h-12 mx-auto text-sage" />
          <h2 className="font-heading text-xl font-semibold mt-3">Nenhum pedido ainda</h2>
          <Link to="/" className="mt-4 inline-flex h-12 px-6 rounded-full bg-sage text-white font-bold items-center">Buscar cuidadores</Link>
        </div>
      )}
      <div className="space-y-4" data-testid="sent-interests-list">{data.map((i) => <Row key={i.id} item={i} />)}</div>
    </div>
  );
}
