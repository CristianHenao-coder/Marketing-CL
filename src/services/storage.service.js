import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';

export const storageService = {
  /**
   * Sube una imagen al bucket de Supabase
   * @param {Buffer} fileBuffer - El contenido del archivo
   * @param {string} fileName - Nombre original del archivo
   * @param {string} mimeType - Tipo de archivo (image/jpeg, etc)
   * @param {string} slug - El identificador para crear la carpeta
   */
  async uploadPhoto(fileBuffer, fileName, mimeType, slug) {
    // 1. Limpiamos el nombre del archivo para evitar caracteres raros
    const safeName = fileName.replace(/[^\w.\-]+/g, '_');
    const timestamp = Date.now();
    
    // 2. Creamos la ruta: carpeta/archivo (ej: maria/17000000-foto.jpg)
    const objectPath = `${slug}/${timestamp}-${safeName}`;

    // 3. Subida física a Supabase Storage
    const { data, error: upErr } = await supabase.storage
      .from(env.BUCKET)
      .upload(objectPath, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (upErr) {
      console.error('❌ Error subiendo a Storage:', upErr.message);
      throw upErr;
    }

    // 4. Obtenemos la URL pública para guardarla luego en la DB
    const { data: pubData } = supabase.storage
      .from(env.BUCKET)
      .getPublicUrl(objectPath);

    return {
      publicUrl: pubData.publicUrl,
      path: objectPath
    };
  }
};