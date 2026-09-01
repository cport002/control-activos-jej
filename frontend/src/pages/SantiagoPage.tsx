import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import api, { fmt } from '../services/api'
import type { ActivoEnSantiago } from '../types'
import { TIPOS_ACTIVO } from '../types'
import { PlaneTakeoff, Download, Search } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function SantiagoPage() {
  const [equipos, setEquipos] = useState<ActivoEnSantiago[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroPropietario, setFiltroPropietario] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const cargar = () => {
    const params: any = {}
    if (busqueda) params.busqueda = busqueda
    if (filtroTipo) params.tipo = filtroTipo
    if (filtroPropietario) params.propietario = filtroPropietario
    if (desde) params.desde = desde
    if (hasta) params.hasta = hasta
    api.get('/activos/informes/santiago', { params }).then(r => { setEquipos(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [busqueda, filtroTipo, filtroPropietario, desde, hasta])

  const exportarExcel = () => {
    const filas = equipos.map(e => ({
      Nombre: e.nombre,
      Tipo: e.tipo,
      Marca: e.marca || '',
      Modelo: e.modelo || '',
      'N° Serie': e.numero_serie || '',
      'Rótulo Codelco': e.rotulo_codelco || '',
      Propietario: e.propietario === 'Codelco' ? 'Codelco (préstamo)' : 'JEJ',
      'Fecha envío a Santiago': fmt.fecha(e.fecha_envio),
      'Último usuario': e.ultimo_usuario || '',
      'Observaciones envío': e.observaciones_envio || '',
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'En Santiago')
    XLSX.writeFile(wb, `Equipos en Santiago - ${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipos en Santiago"
        subtitle={`${equipos.length} equipo${equipos.length !== 1 ? 's' : ''} actualmente en Santiago`}
        icon={PlaneTakeoff}
        actions={
          <button onClick={exportarExcel} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
            <Download size={16} /> Exportar Excel
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por equipo, serie, rótulo o último usuario..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input lg:w-44" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input lg:w-48" value={filtroPropietario} onChange={e => setFiltroPropietario(e.target.value)}>
          <option value="">Cualquier propietario</option>
          <option value="JEJ">Propiedad JEJ</option>
          <option value="Codelco">Préstamo Codelco</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">Envío desde</label>
          <input type="date" className="input lg:w-40" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">hasta</label>
          <input type="date" className="input lg:w-40" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Equipo</th>
              <th className="table-header">N° Serie</th>
              <th className="table-header">Rótulo Codelco</th>
              <th className="table-header">Fecha envío</th>
              <th className="table-header">Último usuario</th>
              <th className="table-header">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Cargando...</td></tr>
            )}
            {!loading && equipos.map(e => (
              <tr key={e.id} className="table-row">
                <td className="table-cell font-medium">
                  <Link to={`/activos/${e.id}`} className="hover:text-primary-600">{e.nombre}</Link>
                  <div className="text-xs text-gray-400">{[e.marca, e.modelo].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="table-cell text-gray-600 font-mono text-xs">{e.numero_serie || '—'}</td>
                <td className="table-cell text-gray-600 font-mono text-xs">{e.rotulo_codelco || '—'}</td>
                <td className="table-cell text-gray-500">{fmt.fecha(e.fecha_envio)}</td>
                <td className="table-cell text-gray-600">{e.ultimo_usuario || '—'}</td>
                <td className="table-cell text-gray-500 text-xs">{e.observaciones_envio || '—'}</td>
              </tr>
            ))}
            {!loading && equipos.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay equipos que coincidan con el filtro</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
