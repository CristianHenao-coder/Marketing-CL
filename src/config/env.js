import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY, // Usamos KEY como lo tienes tú
  BASE_PUBLIC_URL: process.env.BASE_PUBLIC_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
  ADMIN_USER: process.env.ADMIN_USER || 'tu_usuario',
  ADMIN_PASS: process.env.ADMIN_PASS || 'tu_password_secreto',
  // Agregamos estas que usabas en tu index.js original:
  BUCKET: 'public-fotos',
  COOKIE_SECRET: process.env.COOKIE_SECRET,
  CACHE_TTL_MS: 300000 
};

if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
  throw new Error("❌ Error: Credenciales de Supabase no configuradas en .env");
}