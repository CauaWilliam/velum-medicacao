import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, formatApiError } from "@/lib/api";
import { PatientInfoCard } from "@/components/patient/PatientInfoCard";
import { MedicationsTab } from "@/components/patient/MedicationsTab";
import { AppointmentsTab } from "@/components/patient/AppointmentsTab";
import { HistoryTab } from "@/components/patient/HistoryTab";
import { PatientFormDialog } from "@/components/PatientFormDialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";

const TABS = [["medicacoes", "Medicações"], ["compromissos", "Compromissos"], ["historico", "Histórico"]];

export default function PatientDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const { data: patient, isLoading, isError } = useQuery({ queryKey: ["patient", id], queryFn: () => api.get(`/patients/${id}`).then((r) => r.data) });
  const del = useMutation({
    mutationFn: () => api.delete(`/patients/${id}`),
    onSuccess: () => { toast.success("Paciente removido"); qc.invalidateQueries(); nav("/pacientes"); },
    onError: (e) => toast.error(formatApiError(e)),
  });

  if (isLoading) return <div className="p-5"><div className="h-40 rounded-3xl bg-sand-deep animate-pulse" /></div>;
  if (isError || !patient) return <div className="p-8 text-center text-ink-soft" data-testid="patient-not-found">Paciente não encontrado. <Link to="/pacientes" className="underline">Voltar</Link></div>;

  return (
    <div className="px-5 pt-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/pacientes" className="w-12 h-12 rounded-full bg-white border border-sand-line flex items-center justify-center" data-testid="patient-back-button" aria-label="Voltar"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex gap-2">
          <button onClick={() => setEditOpen(true)} className="w-12 h-12 rounded-full bg-white border border-sand-line flex items-center justify-center" data-testid="patient-edit-button" aria-label="Editar"><Pencil className="w-5 h-5" /></button>
          <ConfirmDelete
            testId="patient-delete"
            title="Excluir paciente?"
            description="Todas as medicações, compromissos e histórico deste paciente serão apagados."
            onConfirm={() => del.mutate()}
            trigger={<button className="w-12 h-12 rounded-full bg-white border border-sand-line text-clay flex items-center justify-center" data-testid="patient-delete-button" aria-label="Excluir"><Trash2 className="w-5 h-5" /></button>}
          />
        </div>
      </div>
      <header className="fade-up flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-sage text-white flex items-center justify-center font-heading text-3xl font-bold shrink-0">{patient.name.charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight break-words" data-testid="patient-name">{patient.name}</h1>
          <p className="text-ink-soft text-lg" data-testid="patient-age">{patient.age} anos</p>
        </div>
      </header>
      <PatientInfoCard patient={patient} />
      <Tabs defaultValue="medicacoes">
        <TabsList className="w-full h-14 p-1.5 rounded-2xl bg-sand-deep grid grid-cols-3">
          {TABS.map(([v, l]) => (
            <TabsTrigger key={v} value={v} data-testid={`tab-${v}`} className="h-full rounded-xl text-sm sm:text-base font-bold data-[state=active]:bg-white data-[state=active]:text-sage-dark data-[state=active]:shadow-sm">{l}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="medicacoes" className="mt-5"><MedicationsTab patientId={id} /></TabsContent>
        <TabsContent value="compromissos" className="mt-5"><AppointmentsTab patientId={id} /></TabsContent>
        <TabsContent value="historico" className="mt-5"><HistoryTab patientId={id} /></TabsContent>
      </Tabs>
      <PatientFormDialog open={editOpen} onOpenChange={setEditOpen} patient={patient} />
    </div>
  );
}
