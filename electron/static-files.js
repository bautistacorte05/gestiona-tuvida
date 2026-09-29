// Resuelve qué archivo del export estático (`npx expo export -p web`, carpeta dist/)
// corresponde a cada ruta. Las rutas dinámicas de Expo Router se exportan con el nombre
// literal (dist/c/[categoryId]/[subId].html), así que /c/mascota/perfil se reescribe a ese archivo.

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

  if (clean.startsWith('/c/')) {
    const dynamic = path.join(root, 'c', '[categoryId]', '[subId].html')
    if (isFile(dynamic)) return dynamic
  }

  if (clean === '/' || clean === '') return path.join(root, 'index.html')

  const noSlash = clean.replace(/\/+$/, '')
  const candidates = [path.join(root, noSlash), path.join(root, `${noSlash}.html`), path.join(root, noSlash, 'index.html')]
  const found = candidates.find(isFile)
  // No dejar salir de la carpeta del export con rutas tipo /../../
  return found && path.resolve(found).startsWith(path.resolve(root)) ? found : null
}

module.exports = { resolveFile }
