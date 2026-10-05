import { Phone, AlertTriangle, Stethoscope, NotebookPen } from "lucide-react";
import { maskPhone, phoneDigits } from "@/lib/phone";

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
      <div className="flex items-center gap-3 rounded-2xl bg-sage-light text-sage-dark p-3" data-testid="patient-emergency-contact">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold uppercase tracking-wide">Contato de emergência</div>
          {patient.emergency_contact_name && <div className="text-base font-semibold break-words" data-testid="patient-emergency-name">{patient.emergency_contact_name}</div>}
          {patient.emergency_contact_phone && (
            <a href={`tel:+55${phoneDigits(patient.emergency_contact_phone)}`} className="text-lg font-bold underline underline-offset-4" data-testid="patient-emergency-phone-link">
              {maskPhone(patient.emergency_contact_phone)}
            </a>
          )}
        </div>
        {patient.emergency_contact_phone && (
          <a href={`tel:+55${phoneDigits(patient.emergency_contact_phone)}`} aria-label="Ligar" className="w-14 h-14 rounded-full bg-sage hover:bg-sage-dark text-white flex items-center justify-center shrink-0 active:scale-95 transition-[background-color,transform]" data-testid="patient-emergency-call-button">
            <Phone className="w-6 h-6" />
          </a>
        )}
      </div>
    )}
    {!patient.allergies && !patient.conditions && !patient.notes && !patient.emergency_contact_name && !patient.emergency_contact_phone && (
      <p className="text-ink-soft">Nenhuma informação adicional cadastrada.</p>
    )}
  </div>
);
