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

      // 4. Configuración de Rotación
      const maxCapacity = link.telegram_max_capacity || 200;
      const limit = link.telegram_rotation_limit || 20;
      let currentIndex = link.current_bot_index || 0;

      // Seguridad: validar índice
      if (currentIndex >= bots.length) currentIndex = 0;

      // 5. Buscar bot disponible (que no esté lleno)
      let attempts = 0;
      while (bots[currentIndex].clicks_current >= maxCapacity && attempts < bots.length) {
        currentIndex = (currentIndex + 1) % bots.length;
        attempts++;
      }

      // ✅ ESTE es el bot que recibirá al usuario AHORA
      const currentBot = bots[currentIndex];

      // Si todos los bots están llenos, redirigir de todos modos al actual
      if (currentBot.clicks_current >= maxCapacity) {
        console.warn(`⚠️ Todos los bots de ${slug} están llenos (>= ${maxCapacity})`);
        return res.redirect(currentBot.url);
      }

      // 6. Lógica de Conteo (solo si no tiene cookie anti-duplicado)
      const cookieName = `tg_lock_${slug}`;
      if (!req.cookies[cookieName]) {

        const newClicks = (currentBot.clicks_current || 0) + 1;

        // Actualizar contador del bot ACTUAL
        await supabase
          .from('telegram_bots')
          .update({ clicks_current: newClicks })
          .eq('id', currentBot.id);

        // 7. Evaluar si con ESTE click debemos rotar PARA EL PRÓXIMO usuario
        let shouldRotate = false;

        // A. Si con este click se llenó por completo → ROTAR PARA EL PRÓXIMO
        if (newClicks >= maxCapacity) {
          shouldRotate = true;
          console.log(`🔄 Bot ${currentBot.id} alcanzó capacidad máxima (${newClicks}/${maxCapacity})`);
        }
        // B. Si se cumplió el ciclo de rotación (Batch) → ROTAR PARA EL PRÓXIMO
        else if (newClicks > 0 && newClicks % limit === 0) {
          shouldRotate = true;
          console.log(`🔄 Bot ${currentBot.id} alcanzó límite de batch (${newClicks}/${limit})`);
        }

        // 8. Si debe rotar, actualizar índice PARA EL SIGUIENTE usuario
        if (shouldRotate) {
          let nextIndex = (currentIndex + 1) % bots.length;

          // Buscar siguiente que no esté lleno (si es posible)
          let searchAttempts = 0;
          while (
            bots[nextIndex] &&
            bots[nextIndex].clicks_current >= maxCapacity &&
            searchAttempts < bots.length
          ) {
            nextIndex = (nextIndex + 1) % bots.length;
            searchAttempts++;
          }

          // Actualizar índice para el SIGUIENTE usuario
          await supabase
            .from('smart_links')
            .update({ current_bot_index: nextIndex })
            .eq('id', link.id);

          console.log(`✅ Rotado: próximo índice será ${nextIndex} (Bot ID: ${bots[nextIndex]?.id})`);
        }

        // Marcar cookie para evitar doble conteo (1 hora)
        res.cookie(cookieName, '1', { maxAge: 3600000, httpOnly: true });
      }

      // 9. ✅ Redirigir al bot que SÍ recibe este click
      return res.redirect(currentBot.url);

    } catch (err) {
      console.error("❌ Rotation Error:", err);
      res.status(500).send('Error interno');
    }
  }
};