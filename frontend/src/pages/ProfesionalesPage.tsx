import { useEffect, useState } from 'react'
import api, { whatsappUrl } from '../services/api'
import type { Profesional } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Plus, Search, Users, ChevronRight, Link2, MessageCircle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const FORM_INICIAL = { nombre: '', rut: '', cargo: '', cco: '', email: '', telefono: '' }

export default function ProfesionalesPage() {
  const { puedeEditar } = useAuth()
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Profesional | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)

  const cargar = () => {
    const params: any = {}
    if (busqueda) params.busqueda = busqueda
    api.get('/profesionales', { params }).then(r => { setProfesionales(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [busqueda])

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

  const abrirNuevo = () => { setEditando(null); setForm(FORM_INICIAL); setShowForm(true) }
  const abrirEditar = (p: Profesional) => {
    setEditando(p)
    setForm({ nombre: p.nombre, rut: p.rut || '', cargo: p.cargo || '', cco: p.cco || '', email: p.email || '', telefono: p.telefono || '' })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/profesionales/${editando.id}`, form)
        toast.success('Profesional actualizado')
      } else {
        await api.post('/profesionales', form)
        toast.success('Profesional registrado')
      }
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
        actions={puedeEditar ? (
          <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo Profesional
          </button>
        ) : undefined}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-10" placeholder="Buscar por nombre, RUT o cargo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Nombre</th>
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
                    {puedeEditar && (
                      <button onClick={() => abrirEditar(p)} className="text-gray-400 hover:text-primary-600 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {profesionales.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay profesionales que coincidan con el filtro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2>{editando ? 'Editar profesional' : 'Nuevo profesional'}</h2>
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
                <button type="submit" className="btn-primary">{editando ? 'Guardar cambios' : 'Registrar Profesional'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
