const { app, BrowserWindow, dialog, net, protocol, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { resolveFile } = require('./static-files')

// `electron:dev` pasa --dev para apuntar al servidor de Expo (localhost:8081)
// en vez al export estático, para poder iterar con hot reload.
const isDev = process.argv.includes('--dev')
const DEV_URL = 'http://localhost:8081'
// Empaquetado, el export web viaja como recurso aparte (extraResources → web/).
const WEB_DIR = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'dist')

// Dirección propia y fija para la app. El navegador guarda sesión y datos locales por
// dirección: con un servidor en un puerto al azar, cada apertura arrancaba vacía.
const APP_URL = 'app://gestiona/'
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

let mainWindow

function serveExport() {
  protocol.handle('app', (request) => {
    const file = resolveFile(WEB_DIR, new URL(request.url).pathname) ?? path.join(WEB_DIR, '+not-found.html')
    return net.fetch(pathToFileURL(file).toString())
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0b0f',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // La ventana solo muestra la app. Cualquier link a otro sitio se abre en el navegador del
  // sistema (nunca dentro de la ventana), y solo si es https.
  // (No se usa URL.origin: para esquemas propios como app:// Node devuelve "null", igual que para file://.)
  const originOf = (url) => {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  }
  const ownOrigin = originOf(isDev ? DEV_URL : APP_URL)
  const openOutside = (url) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (originOf(url) === ownOrigin) return
    event.preventDefault()
    openOutside(url)
  })

  await mainWindow.loadURL(isDev ? DEV_URL : APP_URL)
  mainWindow.setTitle('Gestiona tu vida')
}

function setupAutoUpdate() {
  // Solo en la app instalada: en desarrollo no hay versión publicada contra la cual comparar.
  if (!app.isPackaged) return

  let promptedVersion = null
  autoUpdater.on('update-downloaded', async (info) => {
    // Con "Más tarde" se instala al cerrar: no volver a preguntar en cada chequeo.
    if (promptedVersion === info.version) return
    promptedVersion = info.version
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualización lista',
      message: `Hay una versión nueva de Gestiona tu vida (${info.version}).`,
      detail: 'Si elegís "Más tarde", se instala sola la próxima vez que cierres la app.',
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })

  // Sin internet o sin releases publicados simplemente no hay actualización: no molestar al usuario.
  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  check()
  // La app puede quedar abierta días: sin esto solo se enteraría de versiones nuevas al reabrirla.
  setInterval(check, 60 * 60 * 1000)
}

app.whenReady().then(async () => {
  if (!isDev) serveExport()
  await createWindow()
  setupAutoUpdate()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
