// Resuelve qué archivo del export estático (`npx expo export -p web`, carpeta dist/) corresponde
// a cada pedido. Con `web.output: "single"` (app.json) el export es una sola página (dist/index.html):
// los assets (JS, CSS, fuentes, favicon) se sirven tal cual, y cualquier otra ruta de pantalla
// (ej. /c/trabajo/tareas, /ajustes) la resuelve el router del lado del cliente, así que siempre
// cae a ese mismo index.html (como un servidor de SPA típico).

const fs = require('node:fs')
const path = require('node:path')

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile()
  } catch {
    return false
  }
}

function resolveFile(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0])
  const noSlash = clean.replace(/\/+$/, '')
  const target = noSlash ? path.join(root, noSlash) : path.join(root, 'index.html')

  // No dejar salir de la carpeta del export con rutas tipo /../../
  if (!path.resolve(target).startsWith(path.resolve(root))) return null

  if (isFile(target)) return target

  // Sin extensión: es una pantalla de la app, no un archivo. Las rutas con extensión que no
  // existen (ej. un chunk viejo) caen afuera y las resuelve el fallback de quien llama.
  if (!path.extname(noSlash)) return path.join(root, 'index.html')

  return null
}

module.exports = { resolveFile }
