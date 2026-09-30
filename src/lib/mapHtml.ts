/**
 * Página que corre DENTRO del WebView para mostrar el mapa. Usa Leaflet + OpenStreetMap
 * (los mismos que la app web), cargados desde un CDN. React Native le manda los puntos
 * del recorrido con postMessage; esta página los recibe y va dibujando la línea.
 */
export const MAP_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #16120f; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { attributionControl: false, zoomControl: false }).setView([-34.6037, -58.3816], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    var line = L.polyline([], { color: '#bf3b2e', weight: 5 }).addTo(map);
    var startMarker = null;

    function handleMessage(raw) {
      try {
        var msg = JSON.parse(raw);
        if (msg.type === 'point') {
          var ll = [msg.lat, msg.lng];
          if (!startMarker) {
            startMarker = L.circleMarker(ll, { radius: 7, color: '#b8934b', weight: 3, fillColor: '#16120f', fillOpacity: 1 }).addTo(map);
          }
          line.addLatLng(ll);
          map.panTo(ll);
        } else if (msg.type === 'reset') {
          line.setLatLngs([]);
          if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
        } else if (msg.type === 'path') {
          // Recorrido completo (al volver a la pantalla): reemplaza lo dibujado, con su punto de inicio.
          var latlngs = msg.points.map(function (p) { return [p.lat, p.lng]; });
          line.setLatLngs(latlngs);
          if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
          if (latlngs.length) {
            startMarker = L.circleMarker(latlngs[0], { radius: 7, color: '#b8934b', weight: 3, fillColor: '#16120f', fillOpacity: 1 }).addTo(map);
            map.fitBounds(line.getBounds(), { padding: [30, 30], maxZoom: 17 });
          }
        }
      } catch (e) {}
    }
    document.addEventListener('message', function (e) { handleMessage(e.data); });
    window.addEventListener('message', function (e) { handleMessage(e.data); });
  </script>
</body>
</html>`;
