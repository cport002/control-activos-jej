import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { fmt } from '../services/api'
import type { Activo, Acta } from '../types'
import { LayoutDashboard, Boxes, CheckCircle2, UserCheck, Archive, FileText } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const tipoLabel: Record<string, string> = { entrega: 'Entrega', devolucion: 'Devolución' }

export default function DashboardPage() {
  const [activos, setActivos] = useState<Activo[]>([])
  const [actas, setActas] = useState<Acta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get<Activo[]>('/activos'), api.get<Acta[]>('/actas')])
      .then(([a, ac]) => { setActivos(a.data); setActas(ac.data.slice(0, 8)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  const disponibles = activos.filter(a => a.estado === 'disponible').length
  const asignados = activos.filter(a => a.estado === 'asignado').length
  const deBaja = activos.filter(a => a.estado === 'de_baja').length

  const cards = [
    { label: 'Total activos', value: activos.length, icon: Boxes, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Disponibles', value: disponibles, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Asignados', value: asignados, icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
    { label: 'De baja', value: deBaja, icon: Archive, color: 'text-gray-500 bg-gray-100' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Resumen de activos y últimas actas" icon={LayoutDashboard} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="card p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
              <c.icon className="w-4.5 h-4.5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <h3>Últimas actas</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {actas.map(a => (
            <Link key={a.id} to={`/activos/${a.activo_id}`} className="flex items-center justify-between px-6 py-3 hover:bg-indigo-50/40 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{a.activo_nombre} — {a.profesional_nombre}</p>
                <p className="text-xs text-gray-400">{fmt.fecha(a.fecha)}</p>
              </div>
              <span className={a.tipo === 'entrega' ? 'badge-blue' : 'badge-green'}>{tipoLabel[a.tipo]}</span>
            </Link>
          ))}
          {actas.length === 0 && (
            <div className="text-center py-10 text-gray-400">Aún no hay actas registradas</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/activos" className="btn-secondary">Ver activos</Link>
        <Link to="/profesionales" className="btn-secondary">Ver profesionales</Link>
      </div>
    </div>
  )
}
