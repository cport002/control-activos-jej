import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import ActivosPage from './pages/ActivosPage'
import ActivoDetallePage from './pages/ActivoDetallePage'
import ProfesionalesPage from './pages/ProfesionalesPage'
import ProfesionalDetallePage from './pages/ProfesionalDetallePage'
import HistorialPage from './pages/HistorialPage'
import UsuariosPage from './pages/UsuariosPage'
import PerfilProfesionalPage from './pages/PerfilProfesionalPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const auth = useAuth()

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/login" element={auth.token ? <Navigate to="/" replace /> : <LoginPage onLogin={auth.login} />} />
        <Route path="/mi-equipo/:token" element={<PerfilProfesionalPage />} />
        <Route path="/" element={<PrivateRoute><Layout auth={auth} /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="activos" element={<ActivosPage />} />
          <Route path="activos/:id" element={<ActivoDetallePage />} />
          <Route path="profesionales" element={<ProfesionalesPage />} />
          <Route path="profesionales/:id" element={<ProfesionalDetallePage />} />
          <Route path="historial" element={<HistorialPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
