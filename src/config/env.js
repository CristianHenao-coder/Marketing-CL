cat > src / config / env.js << 'EOF'
import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  BASE_PUBLIC_URL: process.env.BASE_PUBLIC_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',

  BUCKET: 'public-fotos',
  COOKIE_SECRET: process.env.COOKIE_SECRET,

  CACHE_TTL_MS: 300000,
};

// Validación mínima (Auth + Admin)
if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ Error: SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY son obligatorios en .env');
}
if (!env.COOKIE_SECRET) {
  throw new Error('❌ Error: COOKIE_SECRET es obligatorio para firmar cookies');
}
EOF