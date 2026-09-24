import webpush from 'npm:web-push@3.6.7'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Contacto que ven los servicios de push (Google, Apple) si algo anda mal.
export const VAPID_SUBJECT = 'mailto:matiiasalberto.22@gmail.com'

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

// Par de claves VAPID. La primera vez se genera acá y se guarda en Vault;
// la privada nunca sale de Supabase.
export async function ensureVapid(db: SupabaseClient) {
  let { data: privateKey } = await db.rpc('vapid_private_key')
  if (!privateKey) {
    const keys = webpush.generateVAPIDKeys()
    const { error } = await db.rpc('store_vapid_keys', {
      pub: keys.publicKey,
      priv: keys.privateKey,
    })
    if (error) throw error
    privateKey = keys.privateKey
  }
  const { data: publicKey } = await db.rpc('vapid_public_key')
  return { publicKey: publicKey as string, privateKey: privateKey as string }
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
