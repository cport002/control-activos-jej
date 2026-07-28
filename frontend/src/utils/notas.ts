// Las notas técnicas se guardan como texto plano "Label: valor · Label: valor" (mismo formato
// que ya usa la carga masiva por Excel — ver backend/scripts/importar_activos.js). Estas funciones
// separan los campos conocidos (Procesador, RAM, Disco, SO, Gama) para editarlos en inputs propios,
// sin perder ningún texto libre que ya existiera (queda en "resto").

export interface DetalleTecnico {
  procesador: string
  ram: string
  disco: string
  so: string
  gama: string
  resto: string
}

const ETIQUETAS: { clave: keyof Omit<DetalleTecnico, 'resto'>; etiqueta: string }[] = [
  { clave: 'procesador', etiqueta: 'Procesador' },
  { clave: 'ram', etiqueta: 'RAM' },
  { clave: 'disco', etiqueta: 'Disco' },
  { clave: 'so', etiqueta: 'SO' },
  { clave: 'gama', etiqueta: 'Gama' },
]

export function parseNotas(notas: string | null | undefined): DetalleTecnico {
  const detalle: DetalleTecnico = { procesador: '', ram: '', disco: '', so: '', gama: '', resto: '' }
  if (!notas) return detalle

  const restoSegmentos: string[] = []
  for (const segmento of notas.split(' · ')) {
    const idx = segmento.indexOf(':')
    const label = idx > -1 ? segmento.slice(0, idx).trim() : null
    const valor = idx > -1 ? segmento.slice(idx + 1).trim() : segmento.trim()
    const match = label && ETIQUETAS.find(e => e.etiqueta.toLowerCase() === label.toLowerCase())
    if (match) {
      detalle[match.clave] = valor
    } else if (segmento.trim()) {
      restoSegmentos.push(segmento.trim())
    }
  }
  detalle.resto = restoSegmentos.join(' · ')
  return detalle
}

export function composeNotas(detalle: DetalleTecnico): string {
  const partes: string[] = []
  for (const { clave, etiqueta } of ETIQUETAS) {
    if (detalle[clave]?.trim()) partes.push(`${etiqueta}: ${detalle[clave].trim()}`)
  }
  if (detalle.resto?.trim()) partes.push(detalle.resto.trim())
  return partes.join(' · ')
}
