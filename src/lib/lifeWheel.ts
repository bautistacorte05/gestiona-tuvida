import { LIFE_SCORE_MAX, LIFE_SCORE_MIN } from '../config/lifeWheel'
import type { LifeWheelMonth } from './db'

// Cuentas de la Rueda de la vida (promedios, cambios), los colores y la geometría del gráfico.
// Sin React: el gráfico se dibuja con Views (rayas rotadas y triángulos hechos con bordes),
// porque la app no tiene una librería de SVG.

export interface Point {
  x: number
  y: number
}

/** Puntaje válido (1 a 10, entero) o undefined. */
export function cleanScore(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  const r = Math.round(v)
  return r >= LIFE_SCORE_MIN && r <= LIFE_SCORE_MAX ? r : undefined
}

/** Puntajes de un mes por área (solo las áreas puntuadas). */
export function scoresOf(month: LifeWheelMonth | undefined, areaIds: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of areaIds) {
    const s = cleanScore(month?.scores?.[id])
    if (s !== undefined) out[id] = s
  }
  return out
}

/** Promedio de las áreas puntuadas (undefined si no hay ninguna). */
export function average(scores: Record<string, number>, areaIds: string[]): number | undefined {
  const vals = areaIds.map((id) => scores[id]).filter((v): v is number => v !== undefined)
  if (!vals.length) return undefined
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/** Redondeado a un decimal (para comparar lo mismo que se muestra). */
export const round1 = (x: number) => Math.round(x * 10) / 10

/** 6.4 → "6,4" */
export const decimal = (x: number) => round1(x).toFixed(1).replace('.', ',')

/** Diferencia entre dos valores (undefined si falta alguno). */
export function delta(cur: number | undefined, prev: number | undefined): number | undefined {
  if (cur === undefined || prev === undefined) return undefined
  return round1(cur - prev)
}

/** +0,5 / −0,5 / = (con el signo menos tipográfico). */
export function signedDecimal(d: number) {
  if (d === 0) return '='
  return `${d > 0 ? '+' : '−'}${decimal(Math.abs(d))}`
}

// ——— Colores del gráfico ———
// El relleno se arma con varios triángulos: si fuera transparente, en la PC se verían rayitas
// donde se tocan. Por eso es opaco (el color de la app mezclado con el fondo de la tarjeta, como
// se vería al 28%) y la grilla se dibuja encima con un tono semitransparente.

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')

/** `top` encima de `base` con opacidad `alpha`, como color opaco ('#rrggbb'). */
export function mixHex(base: string, top: string, alpha: number) {
  const b = rgbOf(base)
  const t = rgbOf(top)
  return `#${b.map((v, i) => hex2(v * (1 - alpha) + t[i] * alpha)).join('')}`
}

/**
 * Blanco (o negro) semitransparente que, encima de `bg`, se ve como `target` (grises). Encima del
 * relleno aclara (u oscurece) igual, como si la grilla estuviera debajo de un relleno transparente.
 */
export function overlayFor(bg: string, target: string) {
  const avg = (hex: string) => rgbOf(hex).reduce((a, v) => a + v, 0) / 3
  const b = avg(bg)
  const t = avg(target)
  if (t >= b) return `#ffffff${hex2(((t - b) / Math.max(255 - b, 1)) * 255)}`
  return `#000000${hex2(((b - t) / Math.max(b, 1)) * 255)}`
}

// ——— Geometría del gráfico ———

/** Ángulo del eje `i` de `n` (el primero arriba, sigue como las agujas del reloj). */
export const axisAngle = (i: number, n: number) => (Math.PI * 2 * i) / n - Math.PI / 2

/** Punto del eje `i` a `value` (0 = centro, LIFE_SCORE_MAX = borde de la rueda de radio `radius`). */
export function radarPoint(i: number, n: number, value: number, cx: number, cy: number, radius: number): Point {
  const ang = axisAngle(i, n)
  const r = (radius * value) / LIFE_SCORE_MAX
  return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r }
}

/** Polígono de un mes: un punto por área (las que no tienen puntaje quedan en el centro). */
export function radarPolygon(values: (number | undefined)[], cx: number, cy: number, radius: number): Point[] {
  return values.map((v, i) => radarPoint(i, values.length, v ?? 0, cx, cy, radius))
}

/** Medidas del gráfico para un ancho disponible: radio, centro y alto (deja lugar a los nombres). */
export function chartLayout(width: number) {
  const radius = Math.max(56, Math.min(width * 0.28, 112))
  const height = Math.round(radius * 2 + 64)
  return { radius, cx: width / 2, cy: height / 2, height, labelRadius: radius + 14 }
}

/** Dónde va el nombre de cada área: alineado hacia afuera para que no tape la rueda. */
export function labelPlacement(i: number, n: number, cx: number, cy: number, labelRadius: number) {
  const ang = axisAngle(i, n)
  const x = cx + Math.cos(ang) * labelRadius
  const y = cy + Math.sin(ang) * labelRadius
  const c = Math.cos(ang)
  const align: 'left' | 'right' | 'center' = c > 0.35 ? 'left' : c < -0.35 ? 'right' : 'center'
  return { x, y, align }
}

/** Raya de `a` a `b` como una View: posición sin rotar, largo y ángulo (radianes) para `rotate`. */
export function segmentBox(a: Point, b: Point, thickness: number) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 0.01) return null
  return {
    left: (a.x + b.x) / 2 - length / 2,
    top: (a.y + b.y) / 2 - thickness / 2,
    width: length,
    angle: Math.atan2(dy, dx),
  }
}

/** Pedacitos de una línea punteada que recorre el polígono cerrado (el ritmo sigue en las esquinas). */
export function dashPolygon(points: Point[], dash: number, gap: number): [Point, Point][] {
  const out: [Point, Point][] = []
  const period = dash + gap
  let phase = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < 0.01) continue
    let pos = 0
    while (len - pos > 1e-6) {
      const inDash = phase < dash - 1e-6
      const left = inDash ? dash - phase : period - phase
      const step = Math.min(left, len - pos)
      if (inDash && step > 0.05) {
        const t0 = pos / len
        const t1 = (pos + step) / len
        out.push([
          { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 },
          { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 },
        ])
      }
      pos += step
      phase += step
      if (phase >= period - 1e-6) phase = 0
    }
  }
  return out
}

/**
 * Triángulo relleno como una View sin tamaño con bordes (el borde de abajo pintado y los de los
 * costados transparentes), rotada. Se apoya sobre el lado más largo para que la punta caiga
 * dentro de la base. `leftPart` = ancho del borde izquierdo (dónde cae la punta sobre la base).
 */
export function triangleBox(p1: Point, p2: Point, p3: Point) {
  const sides: [Point, Point, Point][] = [
    [p1, p2, p3],
    [p2, p3, p1],
    [p3, p1, p2],
  ]
  const sideLength = (s: [Point, Point, Point]) => Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y)
  const longest = sides.reduce((best, s) => (sideLength(s) > sideLength(best) ? s : best))
  const apex = longest[2]
  let [b1, b2] = longest
  const length = sideLength(longest)
  if (length < 0.01) return null
  let ux = (b2.x - b1.x) / length
  let uy = (b2.y - b1.y) / length
  // La punta tiene que quedar "arriba" de la base una vez rotada: si no, se da vuelta la base.
  if (ux * (apex.y - b1.y) - uy * (apex.x - b1.x) > 0) {
    ;[b1, b2] = [b2, b1]
    ux = -ux
    uy = -uy
  }
  const height = -(ux * (apex.y - b1.y) - uy * (apex.x - b1.x))
  if (height < 0.01) return null
  const leftPart = Math.min(Math.max((apex.x - b1.x) * ux + (apex.y - b1.y) * uy, 0), length)
  const angle = Math.atan2(uy, ux)
  // La rotación es alrededor del centro de la caja: se ubica el centro donde corresponde.
  const centerX = b1.x + (length / 2) * ux + (height / 2) * uy
  const centerY = b1.y + (length / 2) * uy - (height / 2) * ux
  return { left: centerX - length / 2, top: centerY - height / 2, width: length, height, leftPart, angle }
}
