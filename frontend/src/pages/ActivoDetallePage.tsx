import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import api, { fmt } from '../services/api'
import type { Activo, Acta, Profesional, ActivoMovimiento } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, RotateCcw, Image as ImageIcon, X, Trash2, Send, PackageCheck, Edit2, Archive, FileSignature } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { TIPOS_ACTIVO } from '../types'
import { parseNotas, composeNotas, type DetalleTecnico } from '../utils/notas'

const estadoBadge: Record<string, string> = { disponible: 'badge-green', asignado: 'badge-blue', de_baja: 'badge-gray' }
const estadoLabel: Record<string, string> = { disponible: 'disponible', asignado: 'asignado', de_baja: 'de baja' }
const condicionLabel: Record<string, string> = { bueno: 'Bueno', con_observaciones: 'Con observaciones', 'dañado': 'Dañado', extraviado: 'Extraviado', robado: 'Robado' }
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
  const [esHistorico, setEsHistorico] = useState(false)
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

  const EDITAR_INICIAL = { nombre: '', tipo: 'Notebook', marca: '', modelo: '', numero_serie: '', rotulo_codelco: '', accesorios: '' }
  const DETALLE_INICIAL: DetalleTecnico = { procesador: '', ram: '', disco: '', so: '', gama: '', resto: '' }
  const [editando, setEditando] = useState(false)
  const [formEditar, setFormEditar] = useState(EDITAR_INICIAL)
  const [detalleEditar, setDetalleEditar] = useState<DetalleTecnico>(DETALLE_INICIAL)
  const [fotoEditar, setFotoEditar] = useState<File | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [dandoBaja, setDandoBaja] = useState(false)

  const [firmarHistoricaId, setFirmarHistoricaId] = useState<number | null>(null)
  const [fotosFirmaHistorica, setFotosFirmaHistorica] = useState<File[]>([])
  const [guardandoFirmaHistorica, setGuardandoFirmaHistorica] = useState(false)
  const sigRefHistorico = useRef<SignatureCanvas | null>(null)

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
    setEsHistorico(false)
    setTimeout(() => sigRef.current?.clear(), 0)
  }

  // Equipo ya asignado pero sin ninguna acta de entrega (ej. cargado directo por importación masiva):
  // no puede usar "Registrar entrega" (exige estado disponible), así que se documenta aparte.
  const abrirEntregaYaVigente = () => {
    if (!activo?.profesional_actual_id) return
    setModalTipo('entrega')
    setProfesionalId(String(activo.profesional_actual_id))
    setCondicion('bueno')
    setObservaciones('')
    setFotos([])
    setEsHistorico(true)
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
      accesorios: activo.accesorios || ''
    })
    setDetalleEditar(parseNotas(activo.notas))
    setFotoEditar(null)
    setEditando(true)
  }

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardandoEdicion(true)
    try {
      const fd = new FormData()
      Object.entries(formEditar).forEach(([k, v]) => fd.append(k, v))
      fd.append('notas', composeNotas(detalleEditar))
      if (fotoEditar) fd.append('foto_equipo', fotoEditar)
      await api.put(`/activos/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
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
    if (!esHistorico && (!sigRef.current || sigRef.current.isEmpty())) { toast.error('Falta la firma'); return }

    setGuardando(true)
    try {
      const form = new FormData()
      form.append('activo_id', String(activo.id))
      form.append('profesional_id', profesionalId)
      form.append('tipo', modalTipo)
      form.append('condicion_equipo', condicion)
      form.append('observaciones', observaciones)
      if (esHistorico) {
        form.append('historico', 'true')
      } else {
        const firmaBlob = dataURLtoBlob(sigRef.current!.getTrimmedCanvas().toDataURL('image/png'))
        form.append('firma', firmaBlob, 'firma.png')
      }
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

  const abrirFirmarHistorica = (actaId: number) => {
    setFotosFirmaHistorica([])
    setFirmarHistoricaId(actaId)
    setTimeout(() => sigRefHistorico.current?.clear(), 0)
  }

  const guardarFirmaHistorica = async () => {
    if (!firmarHistoricaId) return
    if (!sigRefHistorico.current || sigRefHistorico.current.isEmpty()) { toast.error('Falta la firma'); return }

    setGuardandoFirmaHistorica(true)
    try {
      const form = new FormData()
      const firmaBlob = dataURLtoBlob(sigRefHistorico.current.getTrimmedCanvas().toDataURL('image/png'))
      form.append('firma', firmaBlob, 'firma.png')
      fotosFirmaHistorica.forEach(f => form.append('fotos', f))

      await api.put(`/actas/${firmarHistoricaId}/firmar`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Firma registrada, reemplazó el sello histórico')
      setFirmarHistoricaId(null)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar la firma')
    } finally {
      setGuardandoFirmaHistorica(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>
  if (!activo) return <div className="text-center py-12 text-gray-400">Activo no encontrado</div>

  const actaHistoricaPendiente = activo.estado === 'asignado'
    ? actas.find(a => a.tipo === 'entrega' && a.es_historico && a.profesional_id === activo.profesional_actual_id)
    : undefined

  // Asignado pero sin ninguna acta de entrega registrada todavía (ni real ni histórica)
  const entregaFaltante = activo.estado === 'asignado'
    && !actas.some(a => a.tipo === 'entrega' && a.profesional_id === activo.profesional_actual_id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={activo.nombre}
        subtitle={activo.tipo}
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
            {puedeEditar && actaHistoricaPendiente && (
              <button onClick={() => abrirFirmarHistorica(actaHistoricaPendiente.id)} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                <FileSignature className="w-4 h-4" /> Firmar recepción pendiente
              </button>
            )}
            {puedeEditar && entregaFaltante && (
              <button onClick={abrirEntregaYaVigente} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                <FileSignature className="w-4 h-4" /> Registrar entrega histórica
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
                  <td className="table-cell">
                    <span className={a.tipo === 'entrega' ? 'badge-blue' : 'badge-green'}>{tipoLabel[a.tipo]}</span>
                    {a.es_historico && <span className="badge-gray ml-1.5 text-[10px]">sin firma real</span>}
                  </td>
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

              <div className="pt-2 border-t border-gray-100">
                <p className="label mb-2">Detalle técnico</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Procesador</label>
                    <input className="input" value={detalleEditar.procesador} onChange={e => setDetalleEditar({ ...detalleEditar, procesador: e.target.value })} placeholder="Ej: Intel Core i7-1255U" />
                  </div>
                  <div>
                    <label className="label text-xs">RAM</label>
                    <input className="input" value={detalleEditar.ram} onChange={e => setDetalleEditar({ ...detalleEditar, ram: e.target.value })} placeholder="Ej: 32 GB" />
                  </div>
                  <div>
                    <label className="label text-xs">Disco</label>
                    <input className="input" value={detalleEditar.disco} onChange={e => setDetalleEditar({ ...detalleEditar, disco: e.target.value })} placeholder="Ej: 500 GB SSD" />
                  </div>
                  <div>
                    <label className="label text-xs">Sistema Operativo</label>
                    <input className="input" value={detalleEditar.so} onChange={e => setDetalleEditar({ ...detalleEditar, so: e.target.value })} placeholder="Ej: Windows 11 Pro" />
                  </div>
                  <div className="col-span-2">
                    <label className="label text-xs">Gama</label>
                    <input className="input" value={detalleEditar.gama} onChange={e => setDetalleEditar({ ...detalleEditar, gama: e.target.value })} placeholder="Ej: Alta / Media / Básica" />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Notas adicionales</label>
                <textarea className="input" rows={2} value={detalleEditar.resto} onChange={e => setDetalleEditar({ ...detalleEditar, resto: e.target.value })} />
              </div>

              <div>
                <label className="label">Foto del equipo {activo.foto_url && <span className="text-gray-400 font-normal">(ya tiene una — sube una nueva para reemplazarla)</span>}</label>
                <input type="file" accept="image/*" className="input" onChange={e => setFotoEditar(e.target.files?.[0] || null)} />
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
              <h2>{modalTipo === 'entrega' ? (activo.estado === 'asignado' ? 'Registrar entrega histórica' : 'Registrar entrega') : 'Registrar devolución'}</h2>
              <button onClick={() => setModalTipo(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {modalTipo === 'entrega' && activo.estado === 'asignado' && (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  Este equipo ya está asignado a {activo.profesional_nombre} pero no tenía ninguna acta de entrega registrada.
                </p>
              )}
              <div>
                <label className="label">Profesional</label>
                {modalTipo === 'devolucion' || (modalTipo === 'entrega' && activo.estado === 'asignado') ? (
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
                  {modalTipo === 'devolucion' && <option value="extraviado">Extraviado</option>}
                  {modalTipo === 'devolucion' && <option value="robado">Robado</option>}
                </select>
                {(condicion === 'extraviado' || condicion === 'robado') && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    El equipo pasará directo a "de baja" (no vuelve a quedar disponible). {condicion === 'robado' ? 'Adjunta el parte policial' : 'Detalla lo ocurrido'} en observaciones y como evidencia fotográfica.
                  </p>
                )}
              </div>

              <div>
                <label className="label">Observaciones</label>
                <textarea className="input" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  placeholder={
                    condicion === 'robado' ? 'N° de parte policial, comisaría, fecha del hecho...' :
                    condicion === 'extraviado' ? 'Circunstancias del extravío, fecha, lugar...' :
                    esHistorico ? 'Ej: Equipo entregado con anterioridad, registro administrativo' : ''
                  } />
              </div>

              <div>
                <label className="label">Evidencia fotográfica (opcional, máx. 5){(condicion === 'extraviado' || condicion === 'robado') && ' — incluye foto/escaneo del parte policial si tienes'}</label>
                <input type="file" accept="image/*" multiple className="input"
                  onChange={e => setFotos(Array.from(e.target.files || []).slice(0, 5))} />
              </div>

              <label className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={esHistorico} onChange={e => setEsHistorico(e.target.checked)} />
                <span className="text-sm text-gray-600">
                  <strong className="text-gray-800">Registro histórico</strong> — este equipo ya se entregó/devolvió hace tiempo y no hay firma real disponible.
                  Se usará un sello administrativo en vez de una firma, y podrás reemplazarlo después si consigues la firma real.
                </span>
              </label>

              {esHistorico ? (
                <p className="text-xs text-gray-400">Sin firma — quedará marcado como "sin firma real" en el historial, con opción de firmar después.</p>
              ) : (
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
              )}
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

      {firmarHistoricaId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2>Firmar recepción pendiente</h2>
              <button onClick={() => setFirmarHistoricaId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Este equipo quedó registrado con un sello de "registro histórico" (sin firma real) al cargarlo al inicio del contrato.
                Si tienes a <strong>{activo.profesional_nombre}</strong> contigo ahora, captura su firma real aquí — reemplazará el sello en esta misma acta.
              </p>
              <div>
                <label className="label">Evidencia fotográfica (opcional, máx. 5)</label>
                <input type="file" accept="image/*" multiple className="input"
                  onChange={e => setFotosFirmaHistorica(Array.from(e.target.files || []).slice(0, 5))} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Firma</label>
                  <button type="button" onClick={() => sigRefHistorico.current?.clear()} className="text-xs text-gray-400 hover:text-primary-600 inline-flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Limpiar
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                  <SignatureCanvas ref={sigRefHistorico} penColor="black" canvasProps={{ width: 448, height: 160, className: 'w-full' }} />
                </div>
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setFirmarHistoricaId(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarFirmaHistorica} disabled={guardandoFirmaHistorica}>
                {guardandoFirmaHistorica ? 'Guardando...' : 'Guardar firma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
