import { NavLink, Outlet } from "react-router-dom";
import { CalendarHeart, UsersRound, CircleUserRound, Megaphone, Search, Inbox } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const CARE_TABS = [
  { to: "/", label: "Hoje", icon: CalendarHeart, id: "hoje", end: true },
  { to: "/pacientes", label: "Pacientes", icon: UsersRound, id: "pacientes" },
  { to: "/anuncio", label: "Anúncio", icon: Megaphone, id: "anuncio" },
  { to: "/perfil", label: "Perfil", icon: CircleUserRound, id: "perfil" },
];

const FAMILY_TABS = [
  { to: "/", label: "Buscar", icon: Search, id: "buscar", end: true },
  { to: "/pedidos", label: "Pedidos", icon: Inbox, id: "pedidos" },
  { to: "/perfil", label: "Perfil", icon: CircleUserRound, id: "perfil" },
];

const BottomNav = () => {
  const { user } = useAuth();
  const tabs = user?.role === "family" ? FAMILY_TABS : CARE_TABS;
  return (
  <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-sand/95 backdrop-blur-md border-t border-sand-line px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around gap-1 z-50 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]" data-testid="bottom-nav">
    {tabs.map(({ to, label, icon: Icon, id, end }) => (
      <NavLink
        key={id}
        to={to}
        end={end}
        data-testid={`nav-${id}-tab`}
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center gap-1 px-1 py-2 rounded-2xl transition-colors duration-200 ${isActive ? "bg-sage-light text-sage-dark" : "text-ink-soft hover:text-ink"}`
        }
      >
        <Icon className="w-6 h-6" strokeWidth={2} />
        <span className="text-sm font-semibold">{label}</span>
      </NavLink>
    ))}
  </nav>
  );
};

export const AppShell = () => (
  <div className="grain max-w-md mx-auto min-h-screen bg-sand text-ink pb-28 relative sm:border-x sm:border-sand-line sm:shadow-2xl">
    <div className="relative z-10">
      <Outlet />
    </div>
    <BottomNav />
  </div>
);
