# Velum — PRD

## Original problem statement
"Crie um PWA para cuidadores de idosos chamado Velum . O visual deve ser acolhedor e humano, com tons terrosos suaves (bege, verde-sage, off-white), ícones arredondados e tipografia grande e legível para uso no celular.
Para o MVP, preciso de:
Cadastro de pacientes (nome, idade, informações básicas)
Cadastro de medicações por paciente (nome do remédio, dosagem e horário de cada dose)
Cadastro de compromissos por paciente (descrição, data e hora)
Notificações push no horário exato para medicações e com 1 dia e 2 horas de antecedência para compromissos
Cada ação (medicação ou compromisso) deve ter um botão de 'Concluído' e 'Não Concluído' para fins de auditoria
Se uma medicação ou compromisso não foi marcado como concluído após o horário, exibir um contador de atraso em tempo real (ex: '15 minutos de atraso')
Configure o app como PWA com manifest e service worker. Use textos em português brasileiro.
O app deve ser multi-tenant: cada cuidador deve ter seu próprio cadastro e login, visualizando apenas seus próprios pacientes e dados. Implemente autenticação com e-mail e senha."

User choices: Web Push real (VAPID); medications repeat daily at registered times; patient info = condições de saúde, alergias, contato de emergência; audit history screen per patient.

## Architecture
- Backend FastAPI (server.py routes, core.py auth/db/BaseDocument, notifier.py Web Push loop every 15s with dedup in notification_log). MongoDB collections: users, patients, medications, appointments, audit_logs (insert-only), push_subscriptions, notification_log, login_attempts. All data scoped by owner_id.
- Auth: JWT httpOnly cookies (15min access + 7d refresh), bcrypt, brute-force lockout. Owner seeded from .env.
- Frontend React (CRA) + React Query + shadcn; fonts Outfit + Atkinson Hyperlegible; PWA manifest.json + sw.js (push, notificationclick, offline shell).
- Timezones: user timezone synced from browser; doses computed in user tz.

## User personas
- Cuidador(a) profissional ou familiar que acompanha um ou mais idosos pelo celular.

## Core requirements (static)
Patients CRUD, medications (daily times) CRUD, appointments CRUD, push at dose time / 1d & 2h before appointments, Concluído/Não Concluído audit, real-time delay counter, PWA, pt-BR, multi-tenant email/password auth.

## Implemented (2026-10-05)
- All core requirements above; Hoje dashboard (Atrasados / Próximos / Já registrados), patient detail tabs Medicações / Compromissos / Histórico, Perfil with push toggle + install hint.
- Bug fix: medication occurrence_key parsing in POST /api/actions.
- Tested by testing agent (iteration_1); fix verified via curl.

## Backlog
- P1: Forgot/reset password; edit timezone manually; multiple caregivers sharing a patient (family/team).
- P2: Dose stock/refill reminders; PDF export of audit history; medication end date / weekly schedules.

## Next tasks
- User validation of push on a real phone (installed PWA).
