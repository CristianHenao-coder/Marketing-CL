import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Admin (service role): operaciones internas/admin
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Auth (anon): login email/password, refresh tokens, getUser
export const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// ✅ Backward compatible export (para no tocar todos los imports existentes)
export const supabase = supabaseAdmin;