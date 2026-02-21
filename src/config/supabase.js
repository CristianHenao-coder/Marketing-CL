import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Cliente ADMIN (service role): para leer/escribir tablas sin depender de RLS
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Cliente AUTH (anon): para login email/password y validar tokens
export const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});


