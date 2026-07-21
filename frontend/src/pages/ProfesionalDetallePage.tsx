import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api, { whatsappUrl } from '../services/api'
import type { Profesional, Activo } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, Link2, MessageCircle, ChevronRight, Boxes } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const FORM_INICIAL = { nombre: '', rut: '', cargo: '', cco: '', email: '', telefono: '' }

export default function ProfesionalDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { puedeEditar } = useAuth()
  const [profesional, setProfesional] = useState<Profesional | null>(null)
  const [activos, setActivos] = useState<Activo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const cargar = () => {
    Promise.all([
      api.get(`/profesionales/${id}`),
      api.get(`/profesionales/${id}/activos`)
    ]).then(([p, a]) => {
      setProfesional(p.data)
      setActivos(a.data)
      setLoading(false)
    }).catch(() => { setLoading(false); toast.error('No se pudo cargar el profesional') })
  }
  useEffect(cargar, [id])

  const abrirEditar = () => {
    if (!profesional) return
    setForm({
      nombre: profesional.nombre, rut: profesional.rut || '', cargo: profesional.cargo || '',
      cco: profesional.cco || '', email: profesional.email || '', telefono: profesional.telefono || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.put(`/profesionales/${id}`, form)
      toast.success('Profesional actualizado')
      setShowForm(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  const copiarLink = async () => {
    if (!profesional?.token) return
    const url = `${window.location.origin}/mi-equipo/${profesional.token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  const enviarWhatsapp = () => {
    if (!profesional?.telefono || !profesional?.token) { toast.error('Este profesional no tiene teléfono registrado'); return }
    const url = `${window.location.origin}/mi-equipo/${profesional.token}`
    const mensaje = `Hola ${profesional.nombre.split(' ')[0]}! Te escribimos de JEJ Ingeniería. Puedes ver el equipo que tienes asignado y firmar su recepción aquí: ${url}`
    window.open(whatsappUrl(profesional.telefono, mensaje), '_blank')
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>
  if (!profesional) return <div className="text-center py-12 text-gray-400">Profesional no encontrado</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title={profesional.nombre}
        subtitle={profesional.cargo || 'Sin cargo registrado'}
        icon={ArrowLeft}
        actions={
          <div className="flex gap-2">
            <button onClick={() => navigate('/profesionales')} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            {profesional.token && (
              <button onClick={copiarLink} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
                <Link2 className="w-4 h-4" /> Copiar link
              </button>
            )}
            {profesional.telefono && (
              <button onClick={enviarWhatsapp} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
            )}
            {puedeEditar && (
              <button onClick={abrirEditar} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                <Edit2 className="w-4 h-4" /> Editar
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">RUT</p>
          <p className="text-sm font-medium text-gray-900">{profesional.rut || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">CCO</p>
          <p className="text-sm font-medium text-gray-900">{profesional.cco || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Contacto</p>
          <p className="text-sm text-gray-700 truncate">{profesional.email || '-'}</p>
          <p className="text-xs text-gray-400">{profesional.telefono || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Estado</p>
          <span className={profesional.activo ? 'badge-green' : 'badge-gray'}>{profesional.activo ? 'activo' : 'inactivo'}</span>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Boxes className="w-4 h-4 text-primary-600" />
          <h3>Equipos asignados ({activos.length})</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {activos.map(a => (
            <Link key={a.id} to={`/activos/${a.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-indigo-50/40 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{a.nombre}</p>
                <p className="text-xs text-gray-400">{a.tipo} · {[a.marca, a.modelo].filter(Boolean).join(' ')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
            </Link>
          ))}
          {activos.length === 0 && (
            <div className="text-center py-10 text-gray-400">No tiene equipos asignados actualmente</div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2>Editar profesional</h2>
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
                <input className="input" value={form.cco} onChange={e => setForm({ ...form, cco: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Ej: +56912345678" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
