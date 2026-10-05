# Nova

PWA para llevar la cuenta de las cosas que no son del día a día: cuándo cambiaste
las sábanas, el cepillo de dientes, el filtro del agua.

Stack: Vite + React (JavaScript), `vite-plugin-pwa`. Cuentas y sincronización con
PocketBase; `localStorage` como copia local para usarla sin red.

## Desarrollo

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ con service worker y manifest
npm run preview    # sirve dist/ para probar la instalación como PWA
```

## Ver el dev server desde afuera (túnel)

Publica `localhost:5173` en una URL `https://*.trycloudflare.com` pública, con
hot-reload. Necesita `cloudflared.exe` en `%LOCALAPPDATA%\cloudflared\`
(portable, descargado de https://github.com/cloudflare/cloudflared/releases).

En dos terminales:

```sh
npm run dev:tunnel   # Vite en modo túnel (allowedHosts + HMR por 443)
npm run tunnel       # imprime la URL pública
```

La URL cambia en cada arranque. Cualquiera que la tenga ve la app y el código
fuente del dev server: usala para mostrar, no la publiques.

## Cuentas y sincronización (PocketBase)

Login con email y contraseña (colección `users`). El registro está cerrado: las
cuentas se crean desde el panel de PocketBase (`/_/` → `users` → New record). Los ítems viven en la colección
`nova_items`, uno por registro, y cada usuario ve solo los suyos (reglas de la API).

- La app trabaja sobre `localStorage` y sincroniza: al abrir, al volver a la app, al
  recuperar red, un segundo después de cada cambio y cada 30 s con la app visible.
- Ante dos versiones del mismo ítem gana la de `clientUpdatedAt` más nuevo. Los
  borrados quedan en el servidor como `deleted: true` para llegar a los otros dispositivos.
- Lo que había en el dispositivo antes de iniciar sesión se sube a la cuenta. Al
  cerrar sesión el dispositivo se olvida de todo (sigue en el servidor).
- Sin realtime: ngrok gratis responde su página de advertencia a `EventSource`, que no
  puede mandar el header `ngrok-skip-browser-warning`.

Configuración:

- `.env`: `VITE_PB_URL` (URL pública del servidor).
- `.env.local`: `PB_ADMIN_EMAIL` y `PB_ADMIN_PASSWORD` (superusuario). Solo los usa el
  script de setup; Vite no los expone a la app y git los ignora.
- `npm run pb:setup` crea o actualiza la colección `nova_items` (campos, reglas, índice).

## Regenerar iconos

Editá `public/nova-mark.svg` y corré `npx pwa-assets-generator`.

## Avisos (Web Push)

Los manda el mismo PocketBase: es un binario propio (`server/`) que agrega los avisos
al PocketBase oficial. Como el servidor ya tiene los ítems de cada cuenta, el
dispositivo solo se anota; no manda agenda.

- `server/` = `examples/base` de PocketBase v0.40.4 (mismos flags, `pb_hooks` y
  `pb_migrations` en JS, automigrate) + `push.go`. Sin el comando `update`: bajaría el
  binario oficial y se perderían los avisos.
- Rutas: `GET /api/nova/push/key` (clave pública), `POST`/`DELETE
  /api/nova/push/subscription` (con sesión; anota o borra este dispositivo) y
  `POST /api/nova/push/run` (solo superusuario: corre el envío sin esperar al cron).
- Cron a los :07 de cada hora: por usuario, lo vencido de `nova_items` (última vez +
  intervalo + pospuesto), solo entre 9 y 21 hora local del dispositivo. Un aviso por
  vencimiento: `notifiedDue` guarda la fecha avisada; hecho o posponer la cambian.
- Dispositivos en `nova_push_subs` (sin reglas de API: solo el servidor la toca).
- Las claves VAPID se generan la primera vez en `<dir de datos>/nova_vapid.json`. Si
  cambian, la app nota la clave nueva y se vuelve a suscribir sola.
- En iPhone los avisos requieren la app instalada en pantalla de inicio (iOS 16.4+).

Compilar y correr en Termux (necesita Go 1.27+, `pkg install golang`):

```sh
cd ~/nova && git pull
cd server && CGO_ENABLED=0 go build -o ~/pb/pocketbase-proyects .
cd ~/pb && ./pocketbase-proyects serve --dir=$HOME/pb/pelisMarvel --http=0.0.0.0:8090
```

`server/dns.go` usa DNS públicos cuando no hay `/etc/resolv.conf` (Android), y las
zonas horarias van dentro del binario.

Antes los avisos iban por Supabase (proyecto `pyfnlemilbbuzlcuabuw`). El cron
`nova-send-due` quedó desactivado (`cron.alter_job(1, active := false)`); el código de
las Edge Functions está en el historial de git (antes de este cambio).
