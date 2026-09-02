import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const fmt = {
  fecha: (s?: string) => s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-CL') : '-'
}

export function whatsappUrl(telefono: string, mensaje: string) {
  const numero = telefono.replace(/\D/g, '')
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

// Fuerza la descarga del archivo en vez de abrirlo en una pestaña nueva (window.open con un blob:
// URL no funciona cuando el sistema está instalado como PWA en Android — no hay pestaña de
// navegador que lo renderice y el teléfono intenta (y falla) buscar una app externa para el blob).
export function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
