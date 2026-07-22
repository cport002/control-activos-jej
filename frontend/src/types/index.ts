export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: 'admin' | 'operador' | 'visor'
  activo?: boolean
  ultimo_acceso?: string
  created_at?: string
}

export interface AuthState {
  usuario: Usuario | null
  token: string | null
}

export interface Profesional {
  id: number
  nombre: string
  rut?: string | null
  cargo?: string | null
  cco?: string | null
  email?: string | null
  telefono?: string | null
  token?: string | null
  activo: boolean
  created_at?: string
  updated_at?: string
}

export interface Activo {
  id: number
  nombre: string
  tipo: string
  marca?: string | null
  modelo?: string | null
  numero_serie?: string | null
  rotulo_codelco?: string | null
  accesorios?: string | null
  estado: 'disponible' | 'asignado' | 'de_baja'
  profesional_actual_id?: number | null
  profesional_nombre?: string | null
  ubicacion: 'salvador' | 'santiago'
  notas?: string | null
  created_at?: string
  updated_at?: string
}

export interface ActivoMovimiento {
  id: number
  activo_id: number
  tipo: 'envio_santiago' | 'recepcion_salvador'
  fecha: string
  foto_url?: string | null
  observaciones?: string | null
  usuario_id?: number | null
  usuario_nombre?: string | null
  created_at: string
}

export interface Acta {
  id: number
  activo_id: number
  profesional_id: number
  tipo: 'entrega' | 'devolucion'
  fecha: string
  condicion_equipo: 'bueno' | 'con_observaciones' | 'dañado'
  observaciones?: string | null
  firma_url: string
  usuario_id?: number | null
  usuario_nombre?: string | null
  created_at: string
  activo_nombre?: string
  profesional_nombre?: string
  fotos?: string[]
}

export const TIPOS_ACTIVO = ['Notebook', 'Radio', 'Impresora', 'Celular', 'Otro']
