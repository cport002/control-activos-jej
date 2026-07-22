import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { fmt } from '../services/api'
import type { Acta } from '../types'
import toast from 'react-hot-toast'
import { Search, History, Download } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const tipoLabel: Record<string, string> = { entrega: 'Entrega', devolucion: 'Devolución' }
const condicionLabel: Record<string, string> = { bueno: 'Bueno', con_observaciones: 'Con observaciones', 'dañado': 'Dañado' }

export default function HistorialPage() {
  const [actas, setActas] = useState<Acta[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  const cargar = () => {
    const params: any = {}
    if (busqueda) params.busqueda = busqueda
    if (filtroTipo) params.tipo = filtroTipo
    api.get('/actas', { params }).then(r => { setActas(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [busqueda, filtroTipo])

  const descargarPDF = async (actaId: number) => {
    try {
      const r = await api.get(`/actas/${actaId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo generar el PDF')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historial"
        subtitle={`${actas.length} acta${actas.length !== 1 ? 's' : ''} de entrega/devolución`}
        icon={History}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por activo o profesional..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="entrega">Entrega</option>
          <option value="devolucion">Devolución</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Fecha</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">Activo</th>
              <th className="table-header">Profesional</th>
              <th className="table-header">Condición</th>
              <th className="table-header text-center">PDF</th>
            </tr>
          </thead>
          <tbody>
            {actas.map(a => (
              <tr key={a.id} className="table-row">
                <td className="table-cell text-gray-500">{fmt.fecha(a.fecha)}</td>
                <td className="table-cell"><span className={a.tipo === 'entrega' ? 'badge-blue' : 'badge-green'}>{tipoLabel[a.tipo]}</span></td>
                <td className="table-cell font-medium">
                  <Link to={`/activos/${a.activo_id}`} className="hover:text-primary-600">{a.activo_nombre}</Link>
                </td>
                <td className="table-cell text-gray-600">{a.profesional_nombre}</td>
                <td className="table-cell text-gray-600">{condicionLabel[a.condicion_equipo]}</td>
                <td className="table-cell text-center">
                  <button onClick={() => descargarPDF(a.id)} title="Descargar PDF" className="text-gray-400 hover:text-primary-600 transition-colors">
                    <Download className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {actas.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay actas que coincidan con el filtro</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
