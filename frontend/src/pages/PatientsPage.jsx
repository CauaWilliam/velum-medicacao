import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronRight, Pill, CalendarClock, HeartHandshake } from "lucide-react";
import { api } from "@/lib/api";
import { PatientFormDialog } from "@/components/PatientFormDialog";

const PatientCard = ({ p }) => (
  <Link to={`/pacientes/${p.id}`} data-testid={`patient-card-${p.id}`} className="fade-up flex items-center gap-4 p-5 rounded-3xl bg-white border border-sand-line shadow-sm hover:shadow-md transition-shadow duration-200">
    <div className="w-14 h-14 shrink-0 rounded-full bg-sage-light text-sage-dark flex items-center justify-center font-heading text-2xl font-bold">
      {p.name.charAt(0).toUpperCase()}
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="text-lg font-bold truncate">{p.name}</h3>
      <p className="text-ink-soft">{p.age} anos{p.conditions ? ` · ${p.conditions}` : ""}</p>
      <div className="flex gap-4 mt-1 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1"><Pill className="w-4 h-4" />{p.medication_count} medicações</span>
        <span className="inline-flex items-center gap-1"><CalendarClock className="w-4 h-4" />{p.upcoming_appointments} próximos</span>
      </div>
    </div>
    <ChevronRight className="w-6 h-6 text-ink-soft shrink-0" />
  </Link>
);

export default function PatientsPage() {
  const [open, setOpen] = useState(false);
  const { data: patients = [], isLoading } = useQuery({ queryKey: ["patients"], queryFn: () => api.get("/patients").then((r) => r.data) });

  return (
    <div className="px-5 pt-8 space-y-6">
      <header className="flex items-end justify-between gap-3 fade-up">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-ink-soft text-base">Quem está sob seus cuidados</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="add-patient-button" className="h-14 px-5 rounded-full bg-sage hover:bg-sage-dark text-white font-bold flex items-center gap-2 shadow-md active:scale-95 transition-[background-color,transform]">
          <Plus className="w-5 h-5" /> Novo
        </button>
      </header>
      {isLoading && <div className="h-24 rounded-3xl bg-sand-deep animate-pulse" />}
      {!isLoading && patients.length === 0 && (
        <div className="text-center py-12 px-6 rounded-3xl bg-white border border-sand-line" data-testid="patients-empty">
          <HeartHandshake className="w-12 h-12 mx-auto text-clay" />
          <h2 className="font-heading text-xl font-semibold mt-3">Nenhum paciente ainda</h2>
          <p className="text-ink-soft mt-1">Cadastre a primeira pessoa que você acompanha.</p>
        </div>
      )}
      <div className="space-y-4" data-testid="patients-list">
        {patients.map((p) => <PatientCard key={p.id} p={p} />)}
      </div>
      <PatientFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
