import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import api, { fmt } from '../services/api'
import type { Activo, Acta, Profesional, ActivoMovimiento } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, RotateCcw, Image as ImageIcon, X, Trash2, Send, PackageCheck, Edit2, Archive } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { TIPOS_ACTIVO } from '../types'

const estadoBadge: Record<string, string> = { disponible: 'badge-green', asignado: 'badge-blue', de_baja: 'badge-gray' }
const estadoLabel: Record<string, string> = { disponible: 'disponible', asignado: 'asignado', de_baja: 'de baja' }
const condicionLabel: Record<string, string> = { bueno: 'Bueno', con_observaciones: 'Con observaciones', 'dañado': 'Dañado' }
const tipoLabel: Record<string, string> = { entrega: 'Entrega', devolucion: 'Devolución' }
const movTipoLabel: Record<string, string> = { envio_santiago: 'Enviado a Santiago', recepcion_salvador: 'Recibido en Salvador' }

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new Blob([u8arr], { type: mime })
}

export default function ActivoDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { puedeEditar } = useAuth()
  const [activo, setActivo] = useState<Activo | null>(null)
  const [actas, setActas] = useState<Acta[]>([])
  const [movimientos, setMovimientos] = useState<ActivoMovimiento[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [modalTipo, setModalTipo] = useState<'entrega' | 'devolucion' | null>(null)
  const [profesionalId, setProfesionalId] = useState('')
  const [condicion, setCondicion] = useState('bueno')
  const [observaciones, setObservaciones] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const sigRef = useRef<SignatureCanvas | null>(null)

  const [asignando, setAsignando] = useState(false)
  const [asignarProfesionalId, setAsignarProfesionalId] = useState('')
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false)

  const [movTipo, setMovTipo] = useState<'envio_santiago' | 'recepcion_salvador' | null>(null)
  const [movFecha, setMovFecha] = useState('')
  const [movObservaciones, setMovObservaciones] = useState('')
  const [movFoto, setMovFoto] = useState<File | null>(null)
  const [guardandoMov, setGuardandoMov] = useState(false)

  const EDITAR_INICIAL = { nombre: '', tipo: 'Notebook', marca: '', modelo: '', numero_serie: '', rotulo_codelco: '', accesorios: '', notas: '' }
  const [editando, setEditando] = useState(false)
  const [formEditar, setFormEditar] = useState(EDITAR_INICIAL)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [dandoBaja, setDandoBaja] = useState(false)

  const cargar = () => {
    Promise.all([
      api.get(`/activos/${id}`),
      api.get(`/activos/${id}/actas`),
      api.get(`/activos/${id}/movimientos`)
    ]).then(([a, ac, mv]) => {
      setActivo(a.data)
      setActas(ac.data)
      setMovimientos(mv.data)
      setLoading(false)
    }).catch(() => { setLoading(false); toast.error('No se pudo cargar el activo') })
  }
  useEffect(cargar, [id])
  useEffect(() => { api.get('/profesionales', { params: { estado: 'activo' } }).then(r => setProfesionales(r.data)).catch(() => {}) }, [])

  const abrirModal = (tipo: 'entrega' | 'devolucion') => {
    setModalTipo(tipo)
    setProfesionalId(tipo === 'devolucion' ? String(activo?.profesional_actual_id || '') : '')
    setCondicion('bueno')
    setObservaciones('')
    setFotos([])
    setTimeout(() => sigRef.current?.clear(), 0)
  }

  const eliminarActa = async (acta: Acta) => {
    if (!confirm(`¿Eliminar esta acta de ${tipoLabel[acta.tipo].toLowerCase()} de ${acta.profesional_nombre}? Esto permite volver a firmar (por ejemplo, si era una prueba).`)) return
    try {
      await api.delete(`/actas/${acta.id}`)
      toast.success('Acta eliminada')
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar el acta')
    }
  }

  const abrirAsignar = () => {
    setAsignarProfesionalId('')
    setAsignando(true)
  }

  const guardarAsignacion = async () => {
    if (!asignarProfesionalId) { toast.error('Selecciona un profesional'); return }
    setGuardandoAsignacion(true)
    try {
      await api.post(`/activos/${id}/asignar`, { profesional_id: asignarProfesionalId })
      toast.success('Activo asignado')
      setAsignando(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al asignar el activo')
    } finally {
      setGuardandoAsignacion(false)
    }
  }

  const abrirMovimiento = (tipo: 'envio_santiago' | 'recepcion_salvador') => {
    setMovTipo(tipo)
    setMovFecha(new Date().toISOString().slice(0, 10))
    setMovObservaciones('')
    setMovFoto(null)
  }

  const guardarMovimiento = async () => {
    if (!movTipo) return
    setGuardandoMov(true)
    try {
      const form = new FormData()
      form.append('tipo', movTipo)
      form.append('fecha', movFecha)
      form.append('observaciones', movObservaciones)
      if (movFoto) form.append('foto', movFoto)

      await api.post(`/activos/${id}/movimientos`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(movTipo === 'envio_santiago' ? 'Envío a Santiago registrado' : 'Recepción en Salvador registrada')
      setMovTipo(null)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al registrar el movimiento')
    } finally {
      setGuardandoMov(false)
    }
  }

  const abrirEditar = () => {
    if (!activo) return
    setFormEditar({
      nombre: activo.nombre, tipo: activo.tipo, marca: activo.marca || '', modelo: activo.modelo || '',
      numero_serie: activo.numero_serie || '', rotulo_codelco: activo.rotulo_codelco || '',
      accesorios: activo.accesorios || '', notas: activo.notas || ''
    })
    setEditando(true)
  }

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardandoEdicion(true)
    try {
      await api.put(`/activos/${id}`, formEditar)
      toast.success('Activo actualizado')
      setEditando(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const darDeBaja = async () => {
    if (!activo) return
    if (!confirm(`¿Dar de baja "${activo.nombre}"? Pasará a estado "de baja" y no podrá asignarse hasta reactivarlo.`)) return
    setDandoBaja(true)
    try {
      await api.delete(`/activos/${id}`)
      toast.success('Activo dado de baja')
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al dar de baja')
    } finally {
      setDandoBaja(false)
    }
  }

  const reactivar = async () => {
    try {
      await api.put(`/activos/${id}`, { estado: 'disponible' })
      toast.success('Activo reactivado (disponible)')
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al reactivar')
    }
  }

  const descargarPDF = async (actaId: number) => {
    try {
      const r = await api.get(`/actas/${actaId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo generar el PDF')
    }
  }

  const guardarActa = async () => {
    if (!modalTipo || !activo) return
    if (!profesionalId) { toast.error('Selecciona un profesional'); return }
    if (!sigRef.current || sigRef.current.isEmpty()) { toast.error('Falta la firma'); return }

    setGuardando(true)
    try {
      const form = new FormData()
      form.append('activo_id', String(activo.id))
      form.append('profesional_id', profesionalId)
      form.append('tipo', modalTipo)
      form.append('condicion_equipo', condicion)
      form.append('observaciones', observaciones)
      const firmaBlob = dataURLtoBlob(sigRef.current.getTrimmedCanvas().toDataURL('image/png'))
      form.append('firma', firmaBlob, 'firma.png')
      fotos.forEach(f => form.append('fotos', f))

      await api.post('/actas', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(`Acta de ${modalTipo === 'entrega' ? 'entrega' : 'devolución'} registrada`)
      setModalTipo(null)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al registrar el acta')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>
  if (!activo) return <div className="text-center py-12 text-gray-400">Activo no encontrado</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title={activo.nombre}
        subtitle={activo.tipo}
        icon={ArrowLeft}
        actions={
          <div className="flex gap-2">
            <button onClick={() => navigate('/activos')} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            {puedeEditar && activo.estado === 'disponible' && (
              <button onClick={abrirAsignar} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
                Asignar a...
              </button>
            )}
            {puedeEditar && activo.estado === 'disponible' && (
              <button onClick={() => abrirModal('entrega')} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                Registrar entrega
              </button>
            )}
            {puedeEditar && activo.estado === 'asignado' && (
              <button onClick={() => abrirModal('devolucion')} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                Registrar devolución
              </button>
            )}
            {puedeEditar && activo.estado !== 'asignado' && activo.ubicacion === 'salvador' && (
              <button onClick={() => abrirMovimiento('envio_santiago')} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
                <Send className="w-4 h-4" /> Enviar a Santiago
              </button>
            )}
            {puedeEditar && activo.ubicacion === 'santiago' && (
              <button onClick={() => abrirMovimiento('recepcion_salvador')} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
                <PackageCheck className="w-4 h-4" /> Recibido en Salvador
              </button>
            )}
            {puedeEditar && (
              <button onClick={abrirEditar} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
                <Edit2 className="w-4 h-4" /> Editar
              </button>
            )}
            {puedeEditar && activo.estado === 'de_baja' && (
              <button onClick={reactivar} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors">
                Reactivar
              </button>
            )}
            {puedeEditar && activo.estado === 'disponible' && (
              <button onClick={darDeBaja} disabled={dandoBaja} className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-red-500/30 transition-colors">
                <Archive className="w-4 h-4" /> Dar de baja
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Estado</p>
          <span className={estadoBadge[activo.estado]}>{estadoLabel[activo.estado]}</span>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Ubicación</p>
          {activo.ubicacion === 'santiago' ? <span className="badge-yellow">Santiago</span> : <span className="badge-gray">Salvador</span>}
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Marca / Modelo</p>
          <p className="text-sm font-medium text-gray-900">{[activo.marca, activo.modelo].filter(Boolean).join(' / ') || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">N° de Serie</p>
          <p className="text-sm font-medium text-gray-900">{activo.numero_serie || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Asignado a</p>
          <p className="text-sm font-medium text-gray-900">{activo.profesional_nombre || '-'}</p>
        </div>
        {activo.rotulo_codelco && (
          <div className="card p-4">
            <p className="text-xs text-gray-400 mb-1">Rótulo Codelco</p>
            <p className="text-sm font-medium text-gray-900">{activo.rotulo_codelco}</p>
          </div>
        )}
      </div>

      {activo.foto_url && (
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-2">Foto del equipo</p>
          <a href={activo.foto_url} target="_blank" rel="noreferrer">
            <img src={activo.foto_url} alt={activo.nombre} className="max-h-64 rounded-lg border border-gray-100" />
          </a>
        </div>
      )}

      {activo.accesorios && (
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Accesorios incluidos</p>
          <p className="text-sm text-gray-700">{activo.accesorios}</p>
        </div>
      )}

      {activo.notas && (
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-3">Detalle técnico</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {activo.notas.split(' · ').map((item, i) => {
              const idx = item.indexOf(':')
              const label = idx > -1 ? item.slice(0, idx) : null
              const valor = idx > -1 ? item.slice(idx + 1).trim() : item
              return (
                <div key={i} className="flex justify-between gap-3 text-sm border-b border-gray-50 pb-1.5">
                  {label && <dt className="text-gray-400">{label}</dt>}
                  <dd className="text-gray-700 text-right">{valor}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100"><h3>Historial de actas</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Fecha</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Profesional</th>
                <th className="table-header">Condición</th>
                <th className="table-header text-center">Evidencia</th>
                <th className="table-header text-center">PDF</th>
                {puedeEditar && <th className="table-header text-center">Eliminar</th>}
              </tr>
            </thead>
            <tbody>
              {actas.map(a => (
                <tr key={a.id} className="table-row">
                  <td className="table-cell text-gray-500">{fmt.fecha(a.fecha)}</td>
                  <td className="table-cell"><span className={a.tipo === 'entrega' ? 'badge-blue' : 'badge-green'}>{tipoLabel[a.tipo]}</span></td>
                  <td className="table-cell font-medium">
                    <Link to="/profesionales" className="hover:text-primary-600">{a.profesional_nombre}</Link>
                  </td>
                  <td className="table-cell text-gray-600">{condicionLabel[a.condicion_equipo]}</td>
                  <td className="table-cell text-center">
                    {a.fotos && a.fotos.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-gray-500 text-xs"><ImageIcon className="w-3.5 h-3.5" /> {a.fotos.length}</span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="table-cell text-center">
                    <button onClick={() => descargarPDF(a.id)} title="Descargar PDF" className="text-gray-400 hover:text-primary-600 transition-colors">
                      <Download className="w-4 h-4 inline" />
                    </button>
                  </td>
                  {puedeEditar && (
                    <td className="table-cell text-center">
                      <button onClick={() => eliminarActa(a)} title="Eliminar acta (permite volver a firmar)" className="text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {actas.length === 0 && (
                <tr><td colSpan={puedeEditar ? 7 : 6} className="text-center py-10 text-gray-400">Aún no hay actas para este activo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {movimientos.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100"><h3>Historial Salvador ↔ Santiago</h3></div>
          <div className="divide-y divide-gray-100">
            {movimientos.map(m => (
              <div key={m.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{movTipoLabel[m.tipo]}</p>
                  <p className="text-xs text-gray-400">{fmt.fecha(m.fecha)}{m.usuario_nombre ? ` · ${m.usuario_nombre}` : ''}</p>
                  {m.observaciones && <p className="text-xs text-gray-500 mt-0.5">{m.observaciones}</p>}
                </div>
                {m.foto_url && (
                  <a href={m.foto_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary-600">
                    <ImageIcon className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {asignando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2>Asignar activo</h2>
              <button onClick={() => setAsignando(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Profesional</label>
                <select className="input" value={asignarProfesionalId} onChange={e => setAsignarProfesionalId(e.target.value)}>
                  <option value="">Selecciona un profesional</option>
                  {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.cargo ? ` — ${p.cargo}` : ''}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-400">Esto asigna el activo directamente, sin firma. El profesional puede firmar la recepción después desde su link personal.</p>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setAsignando(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarAsignacion} disabled={guardandoAsignacion}>
                {guardandoAsignacion ? 'Guardando...' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {movTipo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2>{movTipo === 'envio_santiago' ? 'Enviar a Santiago' : 'Recibido en Salvador'}</h2>
              <button onClick={() => setMovTipo(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" value={movFecha} onChange={e => setMovFecha(e.target.value)} />
              </div>
              <div>
                <label className="label">Foto de evidencia (opcional)</label>
                <input type="file" accept="image/*" className="input" onChange={e => setMovFoto(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="label">Observaciones</label>
                <textarea className="input" rows={2} value={movObservaciones} onChange={e => setMovObservaciones(e.target.value)} />
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setMovTipo(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarMovimiento} disabled={guardandoMov}>
                {guardandoMov ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2>Editar activo</h2>
              <button onClick={() => setEditando(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={guardarEdicion} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={formEditar.nombre} onChange={e => setFormEditar({ ...formEditar, nombre: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={formEditar.tipo} onChange={e => setFormEditar({ ...formEditar, tipo: e.target.value })}>
                    {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">N° de Serie</label>
                  <input className="input" value={formEditar.numero_serie} onChange={e => setFormEditar({ ...formEditar, numero_serie: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Marca</label>
                  <input className="input" value={formEditar.marca} onChange={e => setFormEditar({ ...formEditar, marca: e.target.value })} />
                </div>
                <div>
                  <label className="label">Modelo</label>
                  <input className="input" value={formEditar.modelo} onChange={e => setFormEditar({ ...formEditar, modelo: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Rótulo Codelco</label>
                <input className="input" value={formEditar.rotulo_codelco} onChange={e => setFormEditar({ ...formEditar, rotulo_codelco: e.target.value })} placeholder="Ej: ZEX000263296" />
              </div>
              <div>
                <label className="label">Accesorios incluidos</label>
                <input className="input" value={formEditar.accesorios} onChange={e => setFormEditar({ ...formEditar, accesorios: e.target.value })} />
              </div>
              <div>
                <label className="label">Notas / Detalle técnico</label>
                <textarea className="input" rows={3} value={formEditar.notas} onChange={e => setFormEditar({ ...formEditar, notas: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setEditando(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={guardandoEdicion}>{guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalTipo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2>{modalTipo === 'entrega' ? 'Registrar entrega' : 'Registrar devolución'}</h2>
              <button onClick={() => setModalTipo(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Profesional</label>
                {modalTipo === 'devolucion' ? (
                  <input className="input bg-gray-50" value={activo.profesional_nombre || ''} disabled />
                ) : (
                  <select className="input" value={profesionalId} onChange={e => setProfesionalId(e.target.value)}>
                    <option value="">Selecciona un profesional</option>
                    {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.cargo ? ` — ${p.cargo}` : ''}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="label">Condición del equipo</label>
                <select className="input" value={condicion} onChange={e => setCondicion(e.target.value)}>
                  <option value="bueno">Bueno</option>
                  <option value="con_observaciones">Con observaciones</option>
                  <option value="dañado">Dañado</option>
                </select>
              </div>

              <div>
                <label className="label">Observaciones</label>
                <textarea className="input" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
              </div>

              <div>
                <label className="label">Evidencia fotográfica (opcional, máx. 5)</label>
                <input type="file" accept="image/*" multiple className="input"
                  onChange={e => setFotos(Array.from(e.target.files || []).slice(0, 5))} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Firma</label>
                  <button type="button" onClick={() => sigRef.current?.clear()} className="text-xs text-gray-400 hover:text-primary-600 inline-flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Limpiar
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                  <SignatureCanvas ref={sigRef} penColor="black" canvasProps={{ width: 448, height: 160, className: 'w-full' }} />
                </div>
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setModalTipo(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarActa} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar y generar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
