import { createClient } from '@supabase/supabase-js';
import { env } from './env.js'; // Importamos nuestra config centralizada


export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);