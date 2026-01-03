import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';

const linksCache = new Map();

export const linksService = {
  
  // 1. Obtiene todos usando la nueva tabla
  async getAll() {
    return await supabase
      .from('smart_links') // 👈 Tabla nueva
      .select('*')
      .order('created_at', { ascending: false }); // Ordenamos por los más nuevos
  },

  // 2. Busca por SLUG (el texto del link)
  async getBySlug(slug) {
    const cached = this._cacheGet(slug);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('smart_links')
      .select('*')
      .eq('slug', slug) // 👈 Buscamos por la columna slug
      .maybeSingle();

    if (error) {
      console.error('❌ Error:', error.message);
      return null;
    }

    if (data) this._cacheSet(slug, data);
    return data;
  },

  // 3. Guarda o actualiza (Upsert)
  async saveLink(linkData) {
    // Nota: linkData debe tener una propiedad 'slug'
    const { data, error } = await supabase
      .from('smart_links')
      .upsert(linkData, { onConflict: 'slug' }) // 👈 El conflicto se resuelve por slug
      .select()
      .maybeSingle();

    if (error) throw error;

    linksCache.delete(linkData.slug); // Limpiamos caché
    return data;
  },

  //4. Buscar por dominio (host header)
  async getByDomain(host) {
    // Intentamos obtenerlo de la caché primero
    const cached = this._cacheGet(host);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('smart_links')
      .select('*')
      .eq('custom_domain', host) // Asegúrate que esta columna exista en Supabase
      .maybeSingle();

    if (error) {
      console.error('❌ Error en getByDomain:', error.message);
      return null;
    }

    if (data) this._cacheSet(host, data);
    return data;
  },

  // --- Funciones de Caché (se mantienen igual) ---
  _cacheGet(key) {
    const hit = linksCache.get(key);
    if (!hit || hit.exp < Date.now()) return null;
    return hit.val;
  },

  _cacheSet(key, val) {
    linksCache.set(key, { 
      val, 
      exp: Date.now() + (env.CACHE_TTL_MS || 300000) 
    });
  }
};