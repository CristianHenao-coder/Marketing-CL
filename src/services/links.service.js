import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';

// Memoria temporal para acelerar las respuestas del servidor
const linksCache = new Map();

export const linksService = {
  
  // 1. Obtiene todos los links para el listado del Admin
  async getAll() {
    return await supabase
      .from('smart_links')
      .select('*')
      .order('created_at', { ascending: false });
  },

  // 2. Busca por SLUG (ej: linkpro.com/mi-link)
  async getBySlug(slug) {
    const cached = this._cacheGet(slug);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('smart_links')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('❌ Error en getBySlug:', error.message);
      return null;
    }

    if (data) this._cacheSet(slug, data);
    return data;
  },

  // 3. Guarda o actualiza (Upsert) un Smart Link
  async saveLink(linkData) {
    try {
      // Intentamos insertar o actualizar basándonos en el slug
      const { data, error } = await supabase
        .from('smart_links')
        .upsert(linkData, { 
          onConflict: 'slug',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;

      // 🧹 Limpieza de caché: eliminamos el slug y el dominio para que se actualicen
      linksCache.delete(linkData.slug);
      if (linkData.custom_domain) {
        linksCache.delete(linkData.custom_domain);
      }

      return { success: true, data };
    } catch (error) {
      console.error('❌ Error en saveLink:', error.message);
      return { success: false, error: error.message };
    }
  },

  // 4. Busca por dominio personalizado (ej: mis-links.com)
  async getByDomain(host) {
    const cached = this._cacheGet(host);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('smart_links')
      .select('*')
      .eq('custom_domain', host)
      .maybeSingle();

    if (error) {
      console.error('❌ Error en getByDomain:', error.message);
      return null;
    }

    if (data) this._cacheSet(host, data);
    return data;
  },

  // --- Sistema de Caché Interno ---
  _cacheGet(key) {
    const hit = linksCache.get(key);
    if (!hit || hit.exp < Date.now()) return null;
    return hit.val;
  },

  _cacheSet(key, val) {
    linksCache.set(key, { 
      val, 
      exp: Date.now() + (env.CACHE_TTL_MS || 300000) // 5 minutos por defecto
    });
  }
};