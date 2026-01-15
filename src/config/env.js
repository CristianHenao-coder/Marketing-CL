import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_KEY: process.env.SUPABASE_KEY, // si lo sigues usando para otra cosa

  BASE_PUBLIC_URL: process.env.BASE_PUBLIC_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
  ADMIN_USER: process.env.ADMIN_USER || 'tu_usuario',
  ADMIN_PASS: process.env.ADMIN_PASS || 'tu_password_secreto',
  BUCKET: 'public-fotos',
  COOKIE_SECRET: process.env.COOKIE_SECRET,
  CACHE_TTL_MS: 300000,
};

// Validación: ahora comprobamos SERVICE_ROLE_KEY
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ Error: Credenciales de Supabase no configuradas en .env');
}
