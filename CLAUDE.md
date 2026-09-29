@AGENTS.md

# Gestión Squali — app nativa (Expo / React Native)

## ⚠️ REGLA PRINCIPAL (heredada del proyecto web)

**NO TOMAR DECISIONES NI EJECUTAR NADA SIN CONSULTARLO Y TENER VALIDACIÓN PARA CONTINUAR**

Es la misma regla y el mismo usuario que en `D:\gestion-squali` (la app web). Antes de cambiar código, instalar paquetes, hacer commits, borrar algo o elegir una opción de diseño o tecnología: proponerlo, explicarlo y esperar el "sí" del usuario.

## Por qué existe este proyecto (y su relación con la web)

Este es un **proyecto nuevo y separado** de `D:\gestion-squali` (la app web/PWA), **no un reemplazo**. Se creó porque la app web no puede rastrear el GPS con la pantalla bloqueada (Apple no se lo permite a ninguna app web). El usuario tiene **Expo Go** instalado en su iPhone, lo que permite correr una app de verdad (React Native) sin necesitar una Mac para probarla.

El usuario después pidió **migrar TODA la app acá** (no solo el paseo), así que este proyecto va camino a reemplazar a la web como la app principal. La web (`D:\gestion-squali`) se deja tal cual, sin tocar, hasta que se decida qué hacer con ella.

**Nada de esto se migró todavía a un native build real** (EAS): todo corre hoy sobre **Expo Go** (celular) y sobre **el navegador** (PC), ver más abajo.

## Cómo verla y probarla

- **Celular (Expo Go), en la misma red que la PC:** `npx expo start --port 8081` y escanear el QR. Solo funciona si el iPhone está en el mismo Wi-Fi que la PC.
- **Celular (Expo Go), fuera de casa (datos móviles, otra red):** hace falta el **modo túnel** — `npx expo start --port 8081 --tunnel` (usa `@expo/ngrok`, ya instalado como devDependency). Esto expone el servidor con una dirección pública tipo `https://<random>-squali-8081.exp.direct`, así el celular conecta desde cualquier lado. **Ojo:** la PC y el servidor tienen que seguir prendidos igual — el túnel no reemplaza tener una app instalada de verdad, solo saca la limitación de "misma red" para poder seguir probando (por ejemplo, el paseo en vivo) estando afuera.
  - La URL del túnel cambia cada vez que se reinicia el servidor. Para conseguirla: `curl http://localhost:4040/api/tunnels` (API local de ngrok) y armar el link como `exp://<esa-url-sin-https>`.
- **PC (navegador):** abrir **http://localhost:8081** en Chrome/Edge mientras el servidor está corriendo (no hace falta túnel para esto, es la misma PC). Es el mismo código (gracias a `react-native-web`), no una copia aparte — así se cumple el pedido original de "una app para celular y PC".
- Mientras el server esté prendido, los cambios se ven en vivo en las dos plataformas (hot reload).
- **Todavía NO existe una build instalable** (ni con EAS ni de otra forma). Usar la app de verdad, sin la PC prendida (por ejemplo, para salir a pasear al perro sin depender de nada más), **requiere ese paso pendiente**: compilar con EAS e instalarla en el iPhone — eventualmente necesita una cuenta de Apple Developer paga (u$s99/año) para no depender de certificados de 7 días. El usuario decidió, por ahora, seguir con el túnel mientras se termina de construir el resto de la app, y dejar la compilación real para más adelante.

## Arquitectura

- **Expo SDK 57**, Expo Router (rutas por archivos, en `src/app`), TypeScript.
- **Estilos: NativeWind** (Tailwind para React Native) — permite reusar casi literalmente las mismas clases (`className`) que la app web. Paleta "Shu no Michi" (tinta/bermellón/dorado/musgo/carmesí) definida en `tailwind.config.js`, igual que `src/index.css` en la web.
- **Base de datos: Zustand + AsyncStorage** (`src/lib/db.ts`), en vez de Dexie/IndexedDB (no existe en React Native). Un solo store con `entries`, `checks`, `dailyGoals`, `longGoals`, `petProfile`, `petCommands`, `petWalks`, persistido como JSON. Misma forma de datos que la web (para poder migrar/exportar-importar entre las dos más adelante), mismos nombres de función (`saveEntry`, `toggleCheck`, etc.) para que el resto del código porte fácil.
- **Navegación:** `src/app/(tabs)/` con pestañas abajo (Hoy, Mes, Menú, Ajustes) + `src/app/c/[categoryId]/[subId].tsx`, una ruta dinámica que decide si mostrar la pantalla genérica (`SubView`) o una pantalla a medida (`sub.custom`, igual mecanismo que `App.tsx` en la web).
- **`src/config/categories.ts`**: copiado casi textual desde la web (es config pura, sin nada de navegador). Cualquier cambio de categorías/campos que se pida, conviene aplicarlo en los dos proyectos.
- **Lógica pura portada tal cual** desde la web (sin cambios, o casi): `src/lib/dates.ts`, `stats.ts`, `streak.ts`, `time.ts`, `prices.ts`, `savings.ts`. `geo.ts` es distinto al de la web (acá no hay chequeo de HTTPS, se usa `expo-location`).

## Lo que ya está migrado / construido

1. **Base de datos y configuración** (arriba).
2. **Pestaña Hoy** (`(tabs)/index.tsx`): cuadrados con tic, racha 🔥, tiempo dedicado y gráfico de reparto — puerto fiel de `TodayView.tsx` de la web.
3. **Menú** (`(tabs)/menu.tsx`): lista de categorías/subcategorías desplegable, navega a la pantalla genérica.
4. **Pantalla genérica de categoría** (`components/SubView.tsx` + `EntryForm.tsx`): estadísticas del mes, gráfico por día, desglose por campo de selección, aviso de "próxima fecha" (`reminderField`), formulario de carga con selector de fecha nativo. También soporta productos itemizados (`ItemsEditor.tsx`) cuando `sub.itemized`.
5. **Resumen del mes** (`(tabs)/mes.tsx`): puerto fiel de `MonthView.tsx` — KPIs, reparto del tiempo por categoría, gráfico de columnas por día (`MonthStack`, tocable) y calendario de constancia. Ya no es un stub.
6. **Finanzas completo**: `FinanceHomeView.tsx` (Balance: saldo acumulado de siempre, accesos rápidos, movimientos recientes, incluye los "gastos externos" de otras categorías vía `EXTERNAL_MONEY_FIELDS`), `ExpenseInsights.tsx` (Gastos: balance del mes, comparación con el mes anterior, por categoría, precio por producto), `SavingsInsights.tsx` (Ahorros: saldo separado en ARS/USD). Todo probado con datos reales — funciona igual que en la web.
7. **Metas**: `DailyGoalsView.tsx` (creás/borrás metas diarias desde la app, tic + racha 🔥, reusa `checks` con `categoryId = "goal:<id>"`, igual mecanismo que la web) y `LongGoalsView.tsx` + `LongGoalForm.tsx` (objetivo numérico, unidad libre, fecha límite, barra de progreso dorada que se pone verde al cumplirse). Probado con datos reales.
8. **Mascota → Paseo en vivo** (`components/PetWalkLiveView.tsx`): GPS en primer plano (`expo-location`) + mapa con Leaflet/OpenStreetMap embebido en un `WebView` (`react-native-webview`, `lib/mapHtml.ts`) + notificación nativa al terminar. **En la PC (web) esta pantalla se desactiva** y muestra un aviso ("Esta función es solo para el celular") — `react-native-webview` no soporta web, y de todas formas no tiene sentido pasear con la computadora.
9. **Mascota → Perfil/DNI, Modo perdido, Entrenamiento**: la web dibujaba la tarjeta/cartel con `<canvas>`, algo que no existe en React Native. Acá se resolvió armando la tarjeta como una pantalla normal, estilizada con las mismas vistas de la app (no un dibujo), y sacándole una captura con **`react-native-view-shot`** para compartir (`expo-sharing`) — se ve igual, con herramientas nativas. La foto se elige con **`expo-image-picker`** y se achica con **`expo-image-manipulator`** antes de guardarla como base64 en `petProfile.fotoUri` (mismo campo/formato que la web, para que export/import siga siendo compatible). `PetTrainingView.tsx` (niveles 0-5 + sesiones) no necesitó nada de esto, es una pantalla común. Todo probado (Entrenamiento completo; Perfil y Modo perdido sin la foto real, que solo se puede probar en el celular).
10. **Diferencias por plataforma (celular vs. PC/navegador):**
   - `components/DateField.tsx` (nativo, iOS) vs. `components/DateField.web.tsx` (usa `<input type="date">` del navegador) — Expo/Metro elige el archivo correcto solo, según la extensión `.web.tsx`.
   - `components/PetWalkLiveView.tsx` internamente chequea `Platform.OS === 'web'` para mostrar el aviso en vez del mapa.

## Arreglo pendiente de confirmar: calendario de `DateField.tsx` (nativo)

El usuario reportó que en Mascota → Perfil/DNI, el calendario de "Nacimiento" casi no se veía y quedaba corrido/recortado a la derecha. Causa: `DateTimePicker` con `display="inline"` se renderizaba **metido adentro de la columna angosta** del formulario (al lado del campo "Raza", en una fila de dos columnas) — el calendario no se achica para entrar ahí, así que se salía de la pantalla. Además no tenía `themeVariant="dark"`, por eso se veía apagado contra el fondo oscuro de la app.

**Arreglado:** `DateField.tsx` (solo la versión nativa/iOS; `DateField.web.tsx` no tenía este problema, usa el selector del navegador) ahora abre el calendario en una **hoja aparte a todo el ancho de pantalla** (mismo patrón que el resto de los formularios de la app), con `themeVariant="dark"` y `accentColor` del bermellón de la app, más un botón "Confirmar". Compila sin errores, pero **todavía no lo confirmó el usuario en el iPhone** — falta esa confirmación antes de darlo por cerrado.

## Cuidado al portar: `{stringState && <Text>...}` puede romper en nativo

Encontrado y corregido en `PetLostView.tsx`: escribir `{miTexto && <Componente/>}` cuando `miTexto` es un `string` (no un booleano) es un error clásico de React — si `miTexto` vale `''`, la expresión da `''` (no `false`), y React la renderiza como un nodo de texto suelto. En la web esto no rompe nada, pero en **React Native es un error real** ("Unexpected text node... cannot be a child of a `<View>`"), no solo un aviso. Regla al portar: usar `{!!miTexto && ...}` (o comparar contra `''`) en vez de `{miTexto && ...}` cuando la variable es un string de estado, no un booleano.

## Lo que falta migrar (en el orden acordado con el usuario)

- ~~Pantalla genérica + formulario~~ ✅ hecho (con las salvedades de itemizado/ahorros de arriba)
- ~~Resumen del mes~~ ✅ hecho
- ~~Finanzas (Balance / Gastos con productos / Ingresos / Ahorros ARS-USD)~~ ✅ hecho
- ~~Metas (diarias y largo plazo)~~ ✅ hecho
- ~~Mascota (Perfil/DNI, Modo perdido, Entrenamiento)~~ ✅ hecho
- **Ajustes** (exportar/importar) — hoy es un stub. Es lo próximo a construir. En RN no hay descarga de archivo como en el navegador; hay que usar `expo-file-system` + `expo-sharing` (ya instalados) para guardar/compartir el JSON, y `expo-document-picker` (ya instalado) para importar.
- **Rastreo en segundo plano de verdad** (pantalla bloqueada) + notificación en vivo: es el motivo original de este proyecto, y **todavía no está hecho**. Expo Go no alcanza para esto (ver abajo).

## Limitaciones conocidas / pendientes de decisión

- **El rastreo GPS hoy es solo en primer plano** (con la app abierta), igual que un `watchPosition` normal. El siguiente paso técnico para lograr el objetivo original (pantalla bloqueada + notificación en vivo) es generar una **"development build" con EAS** (reemplaza a Expo Go por una versión a medida de la app; sigue sin necesitar Mac, pero necesita una cuenta gratuita de Expo, y probablemente una cuenta de Apple Developer paga para instalarla fuera del modo desarrollo). **No se hizo todavía — hay que consultarlo antes de avanzar.**
- El mapa usa **OpenStreetMap estándar** (gratis, sin API key), cargado por CDN dentro de un WebView — necesita internet para cargar los tiles y las librerías de Leaflet (no funciona 100% offline).
- No hay build instalable (ni EAS ni TestFlight ni App Store) — depende de tener el servidor de desarrollo corriendo.
- Los datos de este proyecto y los de la app web **son bases separadas** (una en AsyncStorage del celular/navegador, otra en IndexedDB del navegador de la web) — no se sincronizan solas. Si se migra a esta app en serio, hay que decidir qué pasa con los datos ya cargados en la web.
