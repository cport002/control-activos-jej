import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import api, { whatsappUrl } from '../services/api'
import type { Profesional, Activo } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Plus, Search, Users, ChevronRight, Link2, MessageCircle, FileDown } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const FORM_INICIAL = { nombre: '', rut: '', cargo: '', cco: '', email: '', telefono: '', tipo: 'jej', empresa: '' }

export default function ProfesionalesPage() {
  const { puedeEditar } = useAuth()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [activos, setActivos] = useState<Activo[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const cargar = () => {
    const params: any = {}
    if (busqueda) params.busqueda = busqueda
    if (filtroTipo) params.tipo = filtroTipo
    if (filtroEstado) params.estado = filtroEstado
    api.get('/profesionales', { params }).then(r => { setProfesionales(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [busqueda, filtroTipo, filtroEstado])
  useEffect(() => { api.get('/activos').then(r => setActivos(r.data)).catch(() => {}) }, [])

  const exportarExcel = () => {
    const filas: Record<string, string>[] = []
    profesionales.forEach(p => {
      const equipos = activos.filter(a => a.profesional_actual_id === p.id && a.estado === 'asignado')
      const datosPersona = {
        Nombre: p.nombre,
        Tipo: p.tipo === 'externo' ? `Externo${p.empresa ? ` (${p.empresa})` : ''}` : 'JEJ',
        RUT: p.rut || '',
        Cargo: p.cargo || '',
        CCO: p.cco || '',
        'N° ODS': p.numero_ods || '',
        Email: p.email || '',
        Teléfono: p.telefono || '',
        Estado: p.activo ? 'Activo' : 'Inactivo',
      }
      if (equipos.length === 0) {
        filas.push({ ...datosPersona, 'Equipo Nombre': '', 'Equipo Tipo': '', 'Marca / Modelo': '', 'N° Serie': '', 'Rótulo Codelco': '', Propietario: '' })
      } else {
        equipos.forEach(eq => {
          filas.push({
            ...datosPersona,
            'Equipo Nombre': eq.nombre,
            'Equipo Tipo': eq.tipo,
            'Marca / Modelo': [eq.marca, eq.modelo].filter(Boolean).join(' / '),
            'N° Serie': eq.numero_serie || '',
            'Rótulo Codelco': eq.rotulo_codelco || '',
            Propietario: eq.propietario === 'Codelco' ? 'Codelco (préstamo)' : 'JEJ',
          })
        })
      }
    })
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Profesionales')
    XLSX.writeFile(wb, `Profesionales JEJ - ${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const copiarLink = async (p: Profesional) => {
    if (!p.token) return
    const url = `${window.location.origin}/mi-equipo/${p.token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  const enviarWhatsapp = (p: Profesional) => {
    if (!p.telefono || !p.token) { toast.error('Este profesional no tiene teléfono registrado'); return }
    const url = `${window.location.origin}/mi-equipo/${p.token}`
    const mensaje = `Hola ${p.nombre.split(' ')[0]}! Te escribimos de JEJ Ingeniería. Puedes ver el equipo que tienes asignado y firmar su recepción aquí: ${url}`
    window.open(whatsappUrl(p.telefono, mensaje), '_blank')
  }

  const abrirNuevo = () => { setForm(FORM_INICIAL); setShowForm(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/profesionales', form)
      toast.success('Profesional registrado')
      setShowForm(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profesionales"
        subtitle={`${profesionales.length} profesional${profesionales.length !== 1 ? 'es' : ''}`}
        icon={Users}
        actions={
          <div className="flex gap-2">
            <button onClick={exportarExcel} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
              <FileDown className="w-4 h-4" /> Exportar Excel
            </button>
            {puedeEditar && (
              <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> Nuevo Profesional
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Buscar por nombre, RUT o cargo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input sm:w-44" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="jej">Personal JEJ</option>
          <option value="externo">Externo</option>
        </select>
        <select className="input sm:w-40" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">RUT</th>
              <th className="table-header">Cargo</th>
              <th className="table-header">CCO</th>
              <th className="table-header text-center">Estado</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {profesionales.map(p => (
              <tr key={p.id} className="table-row">
                <td className="table-cell font-medium">{p.nombre}</td>
                <td className="table-cell">{p.tipo === 'externo' ? <span className="badge-yellow">Externo{p.empresa ? ` · ${p.empresa}` : ''}</span> : <span className="text-gray-400 text-xs">JEJ</span>}</td>
                <td className="table-cell text-gray-600">{p.rut || '-'}</td>
                <td className="table-cell text-gray-600">{p.cargo || '-'}</td>
                <td className="table-cell text-gray-600">{p.cco || '-'}</td>
                <td className="table-cell text-center"><span className={p.activo ? 'badge-green' : 'badge-gray'}>{p.activo ? 'activo' : 'inactivo'}</span></td>
                <td className="table-cell">
                  <div className="flex items-center justify-end gap-3">
                    {p.token && (
                      <button onClick={() => copiarLink(p)} title="Copiar link de firma" className="text-gray-400 hover:text-primary-600 transition-colors">
                        <Link2 className="w-4 h-4" />
                      </button>
                    )}
                    {p.telefono && (
                      <button onClick={() => enviarWhatsapp(p)} title="Enviar por WhatsApp" className="text-gray-400 hover:text-emerald-600 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    <Link to={`/profesionales/${p.id}`} className="text-gray-400 hover:text-primary-600 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {profesionales.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay profesionales que coincidan con el filtro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2>Nuevo profesional</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">RUT</label>
                  <input className="input" value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cargo</label>
                  <input className="input" value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="jej">Personal JEJ</option>
                    <option value="externo">Externo (Codelco / otra empresa)</option>
                  </select>
                </div>
                {form.tipo === 'externo' && (
                  <div>
                    <label className="label">Empresa</label>
                    <input className="input" value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} placeholder="Ej: Codelco" />
                  </div>
                )}
              </div>
              <div>
                <label className="label">CCO</label>
                <input className="input" value={form.cco} onChange={e => setForm({ ...form, cco: e.target.value })} placeholder="Ej: 669 - CDCO DSAL Serv Contrpte Ing y Apoyo PEM" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Registrar Profesional</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
