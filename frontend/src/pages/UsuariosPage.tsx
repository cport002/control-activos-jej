import { useEffect, useState } from 'react'
import api from '../services/api'
import type { Usuario } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UserPlus, Edit2, UserX, UserCog } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const rolColor: Record<string, string> = { admin: 'badge-red', operador: 'badge-blue', visor: 'badge-gray' }
const rolDesc: Record<string, string> = {
  admin: 'Acceso completo: usuarios, activos, profesionales, actas',
  operador: 'Puede registrar activos, profesionales y actas de entrega/devolución. Sin gestión de usuarios.',
  visor: 'Solo lectura. No puede modificar ningún dato.'
}

export default function UsuariosPage() {
  const { esAdmin } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'visor' as Usuario['rol'], activo: true })

  if (!esAdmin) return <Navigate to="/" replace />

  const cargar = () => {
    api.get('/usuarios').then(r => { setUsuarios(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(cargar, [])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', email: '', password: '', rol: 'visor', activo: true })
    setShowForm(true)
  }

  const abrirEditar = (u: Usuario) => {
    setEditando(u)
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: !!u.activo })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editando) {
        const payload: any = { nombre: form.nombre, email: form.email, rol: form.rol, activo: form.activo }
        if (form.password) payload.password = form.password
        await api.put(`/usuarios/${editando.id}`, payload)
        toast.success('Usuario actualizado')
      } else {
        await api.post('/usuarios', form)
        toast.success(`Usuario ${form.email} creado`)
      }
      setShowForm(false)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error')
    }
  }

  const handleDesactivar = async (u: Usuario) => {
    if (!confirm(`¿Desactivar a ${u.nombre}?`)) return
    try {
      await api.delete(`/usuarios/${u.id}`)
      toast.success(`Usuario ${u.nombre} desactivado`)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de acceso al sistema"
        icon={UserCog}
        actions={
          <button onClick={abrirNuevo}
            className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
            <UserPlus className="w-4 h-4" /> Nuevo Usuario
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['admin', 'operador', 'visor'] as const).map(rol => (
          <div key={rol} className="card p-4">
            <span className={`${rolColor[rol]} mb-2 inline-block`}>{rol}</span>
            <p className="text-xs text-gray-500">{rolDesc[rol]}</p>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header">Email</th>
              <th className="table-header text-center">Rol</th>
              <th className="table-header text-center">Estado</th>
              <th className="table-header">Último acceso</th>
              <th className="table-header text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className={`table-row ${!u.activo ? 'opacity-50' : ''}`}>
                <td className="table-cell font-medium">{u.nombre}</td>
                <td className="table-cell text-gray-500">{u.email}</td>
                <td className="table-cell text-center"><span className={rolColor[u.rol]}>{u.rol}</span></td>
                <td className="table-cell text-center">
                  <span className={u.activo ? 'badge-green' : 'badge-red'}>{u.activo ? 'activo' : 'inactivo'}</span>
                </td>
                <td className="table-cell text-gray-400 text-xs">
                  {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-CL') : 'Nunca'}
                </td>
                <td className="table-cell text-center">
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => abrirEditar(u)} className="text-gray-400 hover:text-primary-600 transition-colors" title="Editar usuario">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {u.activo ? (
                      <button onClick={() => handleDesactivar(u)} className="text-gray-400 hover:text-red-600 transition-colors" title="Desactivar">
                        <UserX className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay usuarios</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2>{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">{editando ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                <input type="password" className="input" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required={!editando} minLength={8} placeholder="Mínimo 8 caracteres" />
              </div>
              <div>
                <label className="label">Rol *</label>
                <select className="input" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value as any })}>
                  <option value="visor">Visor — solo lectura</option>
                  <option value="operador">Operador — registra activos y actas</option>
                  <option value="admin">Admin — acceso completo</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">{rolDesc[form.rol]}</p>
              </div>
              {editando && (
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
                  <label htmlFor="activo" className="text-sm text-gray-700">Usuario activo</label>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">{editando ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
