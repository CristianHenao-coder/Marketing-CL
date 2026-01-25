import { supabase } from "../../config/supabase.js";

export const telegramController = {

  // --- API INTERNA PARA EL ROTADOR ---

  // 1. Obtener estado de los bots de un link
  async getBotsStatus(req, res) {
    try {
      const { linkId } = req.params;

      // Obtener configuración del link
      // CAMBIO: Usamos select('*') para evitar errores si falta alguna columna nueva
      const { data: link, error: lErr } = await supabase
        .from('smart_links')
        .select('*')
        .eq('id', linkId)
        .single();

      if (lErr) throw lErr;

      // Obtener bots
      const { data: bots, error: bErr } = await supabase
        .from('telegram_bots')
        .select('*')
        .eq('smart_link_id', linkId)
        .order('id', { ascending: true });

      if (bErr) throw bErr;

      // Calcular estadísticas para el frontend
      const maxCapacity = link.telegram_max_capacity || 2000;

      const stats = bots.map((bot, index) => ({
        id: bot.id,
        url: bot.url,
        clicks: bot.clicks_current,
        active: index === link.current_bot_index,
        is_full: bot.clicks_current >= maxCapacity // Flag para el frontend
      }));

      res.json({
        stats,
        limit: link.telegram_rotation_limit || 200,
        max_capacity: maxCapacity
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 2. Añadir nuevo bot
  async addBot(req, res) {
    try {
      const { linkId } = req.params;
      const { url } = req.body;

      const { error } = await supabase
        .from('telegram_bots')
        .insert({ smart_link_id: linkId, url, clicks_current: 0 });

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 3. Editar bot
  async editBot(req, res) {
    try {
      const { botId } = req.params;
      const { url } = req.body;

      const { error } = await supabase
        .from('telegram_bots')
        .update({ url })
        .eq('id', botId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 4. Eliminar bot
  async deleteBot(req, res) {
    try {
      const { botId } = req.params;
      const { error } = await supabase
        .from('telegram_bots')
        .delete()
        .eq('id', botId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 5. Cambiar límite de rotación (Batch)
  async updateLimit(req, res) {
    try {
      const { linkId } = req.params;
      const { limit } = req.body;

      const { error } = await supabase
        .from('smart_links')
        .update({ telegram_rotation_limit: limit })
        .eq('id', linkId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 5.5 Cambiar capacidad máxima (Vida Útil)
  async updateMaxCapacity(req, res) {
    try {
      const { linkId } = req.params;
      const { max_capacity } = req.body;

      const { error } = await supabase
        .from('smart_links')
        .update({ telegram_max_capacity: max_capacity })
        .eq('id', linkId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 6. Resetear estadísticas
  async resetStats(req, res) {
    try {
      const { linkId } = req.params;

      // Resetear contadores de bots
      await supabase
        .from('telegram_bots')
        .update({ clicks_current: 0 })
        .eq('smart_link_id', linkId);

      // Resetear índice del link
      await supabase
        .from('smart_links')
        .update({ current_bot_index: 0 })
        .eq('id', linkId);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // --- LÓGICA PÚBLICA DE ROTACIÓN (El corazón del sistema) ---

  async handleRotation(req, res) {
    try {
      const { slug } = req.params;

      // 1. Obtener Link y Configuración
      // CAMBIO: Usamos select('*') aquí también por seguridad
      const { data: link, error } = await supabase
        .from('smart_links')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error || !link) return res.status(404).send('Link not found');

      // 2. Verificación de Pago / Estado
      if (!link.is_active || link.status === 'pending_payment') {
         return res.status(403).send('Servicio Suspendido');
      }

      // 3. Obtener Bots
      const { data: bots } = await supabase
        .from('telegram_bots')
        .select('*')
        .eq('smart_link_id', link.id)
        .order('id', { ascending: true });

      if (!bots || bots.length === 0) {
          return res.redirect('https://t.me/SoporteAgencia');
      }

      // Lógica de Selección Inteligente (Saltar bots llenos)
      const maxCapacity = link.telegram_max_capacity || 2000;
      let currentIndex = link.current_bot_index || 0;

      // Seguridad inicial
      if (currentIndex >= bots.length) currentIndex = 0;

      // Buscar el siguiente bot disponible si el actual está lleno
      let attempts = 0;
      while (bots[currentIndex].clicks_current >= maxCapacity && attempts < bots.length) {
          currentIndex = (currentIndex + 1) % bots.length;
          attempts++;
      }

      const currentBot = bots[currentIndex];

      // 4. Lógica de Conteo
      const cookieName = `tg_lock_${slug}`;
      if (!req.cookies[cookieName]) {

          const newClicks = (currentBot.clicks_current || 0) + 1;

          // Actualizar bot
          await supabase
            .from('telegram_bots')
            .update({ clicks_current: newClicks })
            .eq('id', currentBot.id);

          // Lógica de Rotación (Batch o Llenado)
          const limit = link.telegram_rotation_limit || 200;
          let shouldRotate = false;

          // A. Si se llenó por completo -> ROTAR YA
          if (newClicks >= maxCapacity) {
              shouldRotate = true;
          }
          // B. Si se cumplió el ciclo de rotación (Batch) -> ROTAR
          else if (newClicks > 0 && newClicks % limit === 0) {
              shouldRotate = true;
          }

          if (shouldRotate) {
              let nextIndex = (currentIndex + 1) % bots.length;

              // Buscar siguiente que no esté lleno (si es posible)
              let searchAttempts = 0;
              while (bots[nextIndex].clicks_current >= maxCapacity && searchAttempts < bots.length) {
                  nextIndex = (nextIndex + 1) % bots.length;
                  searchAttempts++;
              }

              await supabase
                .from('smart_links')
                .update({ current_bot_index: nextIndex })
                .eq('id', link.id);
          }

          res.cookie(cookieName, '1', { maxAge: 3600000, httpOnly: true });
      }

      return res.redirect(currentBot.url);

    } catch (err) {
      console.error("Rotation Error:", err);
      res.status(500).send('Error interno');
    }
  }
};