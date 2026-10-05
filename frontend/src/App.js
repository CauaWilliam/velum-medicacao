import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/AppShell";
import AuthPage from "@/pages/AuthPage";
import TodayPage from "@/pages/TodayPage";
import PatientsPage from "@/pages/PatientsPage";
import PatientDetailPage from "@/pages/PatientDetailPage";
import ProfilePage from "@/pages/ProfilePage";

const Splash = () => (
  <div className="min-h-screen flex items-center justify-center bg-sand" data-testid="app-loading">
    <img src="/icon-192.png" alt="Velum" className="w-16 h-16 rounded-2xl animate-pulse" />
  </div>
);

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  if (!user) return <Navigate to="/entrar" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors toastOptions={{ style: { fontSize: "16px", borderRadius: "16px" } }} />
        <Routes>
          <Route path="/entrar" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
          <Route path="/cadastro" element={<PublicOnly><AuthPage mode="register" /></PublicOnly>} />
          <Route element={<Protected><AppShell /></Protected>}>
            <Route index element={<TodayPage />} />
            <Route path="pacientes" element={<PatientsPage />} />
            <Route path="pacientes/:id" element={<PatientDetailPage />} />
            <Route path="perfil" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
