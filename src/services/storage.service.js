import { supabase } from '../config/supabase.js';

const BUCKET = 'public-fotos';

export const StorageService = {
  async uploadPhoto(slug, file) {
    const stamp = Date.now();
    const safeName = (file.originalname || 'file').replace(/[^\w.\-]+/g, '_');
    const objectKey = `${slug}/${stamp}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectKey, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (upErr) throw new Error(`Error en Storage: ${upErr.message}`);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);
    return {
      publicUrl: pub.publicUrl,
      path: objectKey
    };
  }
};