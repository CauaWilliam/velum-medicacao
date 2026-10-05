import { NavLink, Outlet } from "react-router-dom";
import { CalendarHeart, UsersRound, CircleUserRound } from "lucide-react";

const TABS = [
  { to: "/", label: "Hoje", icon: CalendarHeart, id: "hoje", end: true },
  { to: "/pacientes", label: "Pacientes", icon: UsersRound, id: "pacientes" },
  { to: "/perfil", label: "Perfil", icon: CircleUserRound, id: "perfil" },
];

const BottomNav = () => (
  <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-sand/95 backdrop-blur-md border-t border-sand-line px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around z-50 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]" data-testid="bottom-nav">
    {TABS.map(({ to, label, icon: Icon, id, end }) => (
      <NavLink
        key={id}
        to={to}
        end={end}
        data-testid={`nav-${id}-tab`}
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-colors duration-200 ${isActive ? "bg-sage-light text-sage-dark" : "text-ink-soft hover:text-ink"}`
        }
      >
        <Icon className="w-6 h-6" strokeWidth={2} />
        <span className="text-sm font-semibold">{label}</span>
      </NavLink>
    ))}
  </nav>
);

export const AppShell = () => (
  <div className="grain max-w-md mx-auto min-h-screen bg-sand text-ink pb-28 relative sm:border-x sm:border-sand-line sm:shadow-2xl">
    <div className="relative z-10">
      <Outlet />
    </div>
    <BottomNav />
  </div>
);
