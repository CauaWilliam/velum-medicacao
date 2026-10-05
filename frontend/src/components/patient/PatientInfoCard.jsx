import { Phone, AlertTriangle, Stethoscope, NotebookPen } from "lucide-react";

const Row = ({ icon: Icon, label, value, testId, cls = "" }) =>
  value ? (
    <div className={`flex gap-3 ${cls}`} data-testid={testId}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-bold uppercase tracking-wide opacity-80">{label}</div>
        <div className="text-base break-words">{value}</div>
      </div>
    </div>
  ) : null;

export const PatientInfoCard = ({ patient }) => (
  <div className="p-5 rounded-3xl bg-white border border-sand-line space-y-4 fade-up" data-testid="patient-info-card">
    {patient.allergies && (
      <div className="rounded-2xl bg-clay-light text-clay p-3">
        <Row icon={AlertTriangle} label="Alergias" value={patient.allergies} testId="patient-allergies" />
      </div>
    )}
    <Row icon={Stethoscope} label="Condições de saúde" value={patient.conditions} testId="patient-conditions" />
    <Row icon={NotebookPen} label="Observações" value={patient.notes} testId="patient-notes" />
    {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
      <a
        href={patient.emergency_contact_phone ? `tel:${patient.emergency_contact_phone.replace(/[^\d+]/g, "")}` : undefined}
        className="flex items-center gap-3 rounded-2xl bg-sage-light text-sage-dark p-3 active:scale-[0.98] transition-transform"
        data-testid="patient-emergency-contact"
      >
        <div className="w-11 h-11 rounded-full bg-sage text-white flex items-center justify-center shrink-0"><Phone className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="text-sm font-bold uppercase tracking-wide">Contato de emergência</div>
          <div className="text-base font-semibold break-words">{patient.emergency_contact_name} {patient.emergency_contact_phone && `· ${patient.emergency_contact_phone}`}</div>
        </div>
      </a>
    )}
    {!patient.allergies && !patient.conditions && !patient.notes && !patient.emergency_contact_name && !patient.emergency_contact_phone && (
      <p className="text-ink-soft">Nenhuma informação adicional cadastrada.</p>
    )}
  </div>
);
