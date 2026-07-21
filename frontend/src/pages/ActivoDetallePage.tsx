import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import api, { fmt } from '../services/api'
import type { Activo, Acta, Profesional } from '../types'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, RotateCcw, Image as ImageIcon, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const estadoBadge: Record<string, string> = { disponible: 'badge-green', asignado: 'badge-blue', de_baja: 'badge-gray' }
const estadoLabel: Record<string, string> = { disponible: 'disponible', asignado: 'asignado', de_baja: 'de baja' }
const condicionLabel: Record<string, string> = { bueno: 'Bueno', con_observaciones: 'Con observaciones', 'dañado': 'Dañado' }
const tipoLabel: Record<string, string> = { entrega: 'Entrega', devolucion: 'Devolución' }

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
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [modalTipo, setModalTipo] = useState<'entrega' | 'devolucion' | null>(null)
  const [profesionalId, setProfesionalId] = useState('')
  const [condicion, setCondicion] = useState('bueno')
  const [observaciones, setObservaciones] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const sigRef = useRef<SignatureCanvas | null>(null)

  const cargar = () => {
    Promise.all([
      api.get(`/activos/${id}`),
      api.get(`/activos/${id}/actas`)
    ]).then(([a, ac]) => {
      setActivo(a.data)
      setActas(ac.data)
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
              <button onClick={() => abrirModal('entrega')} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                Registrar entrega
              </button>
            )}
            {puedeEditar && activo.estado === 'asignado' && (
              <button onClick={() => abrirModal('devolucion')} className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                Registrar devolución
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Estado</p>
          <span className={estadoBadge[activo.estado]}>{estadoLabel[activo.estado]}</span>
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
      </div>

      {activo.accesorios && (
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Accesorios incluidos</p>
          <p className="text-sm text-gray-700">{activo.accesorios}</p>
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
                </tr>
              ))}
              {actas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Aún no hay actas para este activo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
