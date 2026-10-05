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

El servidor no conoce los ítems: cada dispositivo suscripto le manda su agenda
(nombre + fecha de vencimiento) cada vez que algo cambia. Un cron revisa cada hora
qué venció y manda un push. Sin cuentas ni sincronización.

- Supabase, proyecto **Nova** (`pyfnlemilbbuzlcuabuw`): tablas `subscriptions` y
  `schedules` (RLS, sin acceso público), Edge Functions `push` (la llama la app) y
  `send-due` (la llama `pg_cron` a los :07 de cada hora, solo entre 9 y 21 hora local).
- Las claves VAPID se generaron dentro de la función `push` y viven en Vault; la
  privada nunca salió de Supabase.
- El código de las funciones está en `supabase/functions/`. Para redesplegar, subir
  `index.ts` y `vapid.ts` de cada una.
- `.env` tiene solo la URL del proyecto y la clave anónima (públicas por diseño).
- En iPhone los avisos requieren la app instalada en pantalla de inicio (iOS 16.4+).
