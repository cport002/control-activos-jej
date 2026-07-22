import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import type { Activo, Profesional } from '../types'
import { TIPOS_ACTIVO } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Plus, Search, Boxes, ChevronRight } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const estadoBadge: Record<string, string> = { disponible: 'badge-green', asignado: 'badge-blue', de_baja: 'badge-gray' }
const estadoLabel: Record<string, string> = { disponible: 'disponible', asignado: 'asignado', de_baja: 'de baja' }

const FORM_INICIAL = { nombre: '', tipo: 'Notebook', marca: '', modelo: '', numero_serie: '', accesorios: '', notas: '', profesional_id: '' }

export default function ActivosPage() {
  const { puedeEditar } = useAuth()
  const [searchParams] = useSearchParams()
  const [activos, setActivos] = useState<Activo[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState(searchParams.get('estado') || '')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const cargar = () => {
    const params: any = {}
    if (busqueda) params.busqueda = busqueda
    if (filtroEstado) params.estado = filtroEstado
    if (filtroTipo) params.tipo = filtroTipo
    api.get('/activos', { params }).then(r => { setActivos(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [busqueda, filtroEstado, filtroTipo])
  useEffect(() => { api.get('/profesionales').then(r => setProfesionales(r.data)).catch(() => {}) }, [])

  const abrirNuevo = () => { setForm(FORM_INICIAL); setShowForm(true) }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/activos', form)
      toast.success('Activo registrado')
      setShowForm(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al registrar el activo')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activos"
        subtitle={`${activos.length} activo${activos.length !== 1 ? 's' : ''}`}
        icon={Boxes}
        actions={puedeEditar ? (
          <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo Activo
          </button>
        ) : undefined}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por nombre, marca, modelo, N° serie o asignado a..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input sm:w-40" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="disponible">Disponible</option>
          <option value="asignado">Asignado</option>
          <option value="de_baja">De baja</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">Marca / Modelo</th>
              <th className="table-header">N° Serie</th>
              <th className="table-header">Asignado a</th>
              <th className="table-header text-center">Estado</th>
              <th className="table-header text-center">Ubicación</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {activos.map(a => (
              <tr key={a.id} className="table-row">
                <td className="table-cell font-medium">{a.nombre}</td>
                <td className="table-cell text-gray-600">{a.tipo}</td>
                <td className="table-cell text-gray-600">{[a.marca, a.modelo].filter(Boolean).join(' / ') || '-'}</td>
                <td className="table-cell text-gray-600">{a.numero_serie || '-'}</td>
                <td className="table-cell text-gray-600">{a.profesional_nombre || '-'}</td>
                <td className="table-cell text-center"><span className={estadoBadge[a.estado]}>{estadoLabel[a.estado]}</span></td>
                <td className="table-cell text-center">
                  {a.ubicacion === 'santiago' ? <span className="badge-yellow">Santiago</span> : <span className="text-gray-300 text-xs">Salvador</span>}
                </td>
                <td className="table-cell">
                  <Link to={`/activos/${a.id}`} className="text-gray-400 hover:text-primary-600 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </td>
              </tr>
            ))}
            {activos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No hay activos que coincidan con el filtro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2>Nuevo Activo</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Radio Motorola DGP8550e" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">N° de Serie</label>
                  <input className="input" value={form.numero_serie} onChange={e => setForm({ ...form, numero_serie: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Marca</label>
                  <input className="input" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
                </div>
                <div>
                  <label className="label">Modelo</label>
                  <input className="input" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Asignar a (opcional)</label>
                <select className="input" value={form.profesional_id} onChange={e => setForm({ ...form, profesional_id: e.target.value })}>
                  <option value="">Dejar disponible (asignar después)</option>
                  {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.cargo ? ` — ${p.cargo}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Accesorios incluidos</label>
                <input className="input" value={form.accesorios} onChange={e => setForm({ ...form, accesorios: e.target.value })} placeholder="Ej: Cargador, Antena, Batería y Base de carga" />
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input" rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Registrar Activo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
