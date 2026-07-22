import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import api from '../services/api'
import toast from 'react-hot-toast'
import { HardHat, CheckCircle2, Download, RotateCcw, X } from 'lucide-react'

interface ActivoAsignado {
  id: number
  nombre: string
  tipo: string
  marca?: string | null
  modelo?: string | null
  numero_serie?: string | null
  accesorios?: string | null
  notas?: string | null
  acta_id: number | null
}

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new Blob([u8arr], { type: mime })
}

export default function PerfilProfesionalPage() {
  const { token } = useParams()
  const [profesional, setProfesional] = useState<{ nombre: string; cargo?: string | null; cco?: string | null } | null>(null)
  const [activos, setActivos] = useState<ActivoAsignado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [firmando, setFirmando] = useState<ActivoAsignado | null>(null)
  const [accion, setAccion] = useState<'entrega' | 'devolucion'>('entrega')
  const [observaciones, setObservaciones] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const sigRef = useRef<SignatureCanvas | null>(null)

  const cargar = () => {
    api.get(`/public/profesional/${token}`).then(r => {
      setProfesional(r.data.profesional)
      setActivos(r.data.activos)
      setLoading(false)
    }).catch(err => {
      setError(err.response?.data?.error || 'No se pudo cargar la información')
      setLoading(false)
    })
  }
  useEffect(cargar, [token])

  const abrirFirmar = (activo: ActivoAsignado, tipo: 'entrega' | 'devolucion') => {
    setFirmando(activo)
    setAccion(tipo)
    setObservaciones('')
    setFotos([])
    setTimeout(() => sigRef.current?.clear(), 0)
  }

  const descargarPDF = async (actaId: number) => {
    try {
      const r = await api.get(`/public/profesional/${token}/acta/${actaId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo generar el PDF')
    }
  }

  const guardarFirma = async () => {
    if (!firmando) return
    if (!sigRef.current || sigRef.current.isEmpty()) { toast.error('Falta tu firma'); return }

    setGuardando(true)
    try {
      const form = new FormData()
      form.append('observaciones', observaciones)
      const firmaBlob = dataURLtoBlob(sigRef.current.getTrimmedCanvas().toDataURL('image/png'))
      form.append('firma', firmaBlob, 'firma.png')
      fotos.forEach(f => form.append('fotos', f))

      const endpoint = accion === 'entrega' ? 'firmar' : 'devolver'
      await api.post(`/public/profesional/${token}/activo/${firmando.id}/${endpoint}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(accion === 'entrega' ? 'Recepción firmada, gracias' : 'Devolución registrada, gracias')
      setFirmando(null)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al firmar')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>

  if (error || !profesional) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="card max-w-sm text-center">
          <p className="text-gray-700 font-medium">Este link no es válido.</p>
          <p className="text-gray-400 text-sm mt-1">Contacta al área de TI de JEJ para obtener tu link correcto.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">JEJ INGENIERÍA</p>
            <p className="text-xs text-gray-400">Mis equipos asignados</p>
          </div>
        </div>

        <div className="card text-center">
          <p className="text-sm text-gray-400">Hola,</p>
          <h1 className="text-xl font-bold text-gray-900">{profesional.nombre}</h1>
          {profesional.cargo && <p className="text-sm text-gray-500 mt-0.5">{profesional.cargo}</p>}
        </div>

        {activos.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-gray-700 font-medium">No tienes equipos asignados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activos.map(a => (
              <div key={a.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{a.nombre}</p>
                    <p className="text-xs text-gray-400">{a.tipo} · {[a.marca, a.modelo].filter(Boolean).join(' ')}</p>
                    {a.numero_serie && <p className="text-xs text-gray-400">N° Serie: {a.numero_serie}</p>}
                  </div>
                  {a.acta_id ? (
                    <span className="badge-green flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Firmado</span>
                  ) : (
                    <span className="badge-yellow">Pendiente</span>
                  )}
                </div>
                {a.accesorios && <p className="text-xs text-gray-500 mt-2">Accesorios: {a.accesorios}</p>}

                {a.notas && (
                  <dl className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    {a.notas.split(' · ').map((item, i) => {
                      const idx = item.indexOf(':')
                      const label = idx > -1 ? item.slice(0, idx) : null
                      const valor = idx > -1 ? item.slice(idx + 1).trim() : item
                      return (
                        <div key={i} className="flex justify-between gap-3 text-xs">
                          {label && <dt className="text-gray-400">{label}</dt>}
                          <dd className="text-gray-600 text-right">{valor}</dd>
                        </div>
                      )
                    })}
                  </dl>
                )}

                {a.acta_id ? (
                  <div className="mt-3 space-y-2">
                    <button onClick={() => descargarPDF(a.acta_id!)} className="btn-secondary w-full flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" /> Ver / descargar PDF firmado
                    </button>
                    <button onClick={() => abrirFirmar(a, 'devolucion')} className="btn-primary w-full">
                      Solicitar devolución de este equipo
                    </button>
                  </div>
                ) : (
                  <button onClick={() => abrirFirmar(a, 'entrega')} className="btn-primary w-full mt-3">
                    Firmar recepción de este equipo
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Cualquier duda, contacta al área de TI de JEJ.</p>
      </div>

      {firmando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm my-8 relative">
            <button onClick={() => setFirmando(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 space-y-4">
              <div>
                <h2 className="mb-1">{accion === 'entrega' ? 'Confirmar recepción' : 'Confirmar devolución'}</h2>
                <p className="text-sm text-gray-500">{firmando.nombre} — {[firmando.marca, firmando.modelo].filter(Boolean).join(' ')}</p>
              </div>

              <div>
                <label className="label">Observaciones (opcional)</label>
                <textarea className="input" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
              </div>

              <div>
                <label className="label">Foto del equipo (opcional)</label>
                <input type="file" accept="image/*" multiple className="input"
                  onChange={e => setFotos(Array.from(e.target.files || []).slice(0, 5))} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Tu firma</label>
                  <button type="button" onClick={() => sigRef.current?.clear()} className="text-xs text-gray-400 hover:text-primary-600 inline-flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Limpiar
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                  <SignatureCanvas ref={sigRef} penColor="black" canvasProps={{ width: 380, height: 160, className: 'w-full' }} />
                </div>
              </div>

              <button className="btn-primary w-full" onClick={guardarFirma} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Confirmar y firmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
