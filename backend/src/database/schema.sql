CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'operador' CHECK(rol IN ('admin','operador','visor')),
  activo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profesionales (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  rut TEXT,
  cargo TEXT,
  cco TEXT,
  email TEXT,
  telefono TEXT,
  numero_ods TEXT,
  token TEXT UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Otro',
  marca TEXT,
  modelo TEXT,
  numero_serie TEXT UNIQUE,
  rotulo_codelco TEXT,
  foto_url TEXT,
  accesorios TEXT,
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK(estado IN ('disponible','asignado','de_baja')),
  profesional_actual_id INTEGER REFERENCES profesionales(id) ON DELETE SET NULL,
  ubicacion TEXT NOT NULL DEFAULT 'salvador' CHECK(ubicacion IN ('salvador','santiago')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actas (
  id SERIAL PRIMARY KEY,
  activo_id INTEGER NOT NULL REFERENCES activos(id) ON DELETE CASCADE,
  profesional_id INTEGER NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('entrega','devolucion')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  condicion_equipo TEXT NOT NULL DEFAULT 'bueno' CHECK(condicion_equipo IN ('bueno','con_observaciones','dañado')),
  observaciones TEXT,
  firma_url TEXT NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acta_fotos (
  id SERIAL PRIMARY KEY,
  acta_id INTEGER NOT NULL REFERENCES actas(id) ON DELETE CASCADE,
  foto_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activo_movimientos (
  id SERIAL PRIMARY KEY,
  activo_id INTEGER NOT NULL REFERENCES activos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('envio_santiago','recepcion_salvador')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  foto_url TEXT,
  observaciones TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id INTEGER,
  accion TEXT NOT NULL,
  datos_anteriores TEXT,
  datos_nuevos TEXT,
  descripcion TEXT,
  usuario_id INTEGER,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activos_estado ON activos(estado);
CREATE INDEX IF NOT EXISTS idx_activos_profesional ON activos(profesional_actual_id);
CREATE INDEX IF NOT EXISTS idx_actas_activo ON actas(activo_id);
CREATE INDEX IF NOT EXISTS idx_actas_profesional ON actas(profesional_id);
CREATE INDEX IF NOT EXISTS idx_acta_fotos_acta ON acta_fotos(acta_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_activo_movimientos_activo ON activo_movimientos(activo_id);
