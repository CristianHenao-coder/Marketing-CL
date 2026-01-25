import { supabase } from "../../config/supabase.js";

export const telegramController = {

  // --- API INTERNA PARA EL ROTADOR ---

  // 1. Obtener estado de los bots de un link
  async getBotsStatus(req, res) {
    try {
      const { linkId } = req.params;

      // Obtener configuración del link
      const { data: link, error: lErr } = await supabase
        .from('smart_links')
        .select('telegram_rotation_limit, current_bot_index')
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
      // En la lógica de Redis, 'active' era solo el bot del índice actual.
      // Aquí haremos lo mismo.
      const stats = bots.map((bot, index) => ({
        id: bot.id,
        url: bot.url,
        clicks: bot.clicks_current,
        active: index === link.current_bot_index
      }));

      res.json({
        stats,
        limit: link.telegram_rotation_limit || 200
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

  // 5. Cambiar límite de rotación
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
      const userIP = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      // 1. Obtener Link y Configuración
      const { data: link, error } = await supabase
        .from('smart_links')
        .select('id, is_active, status, telegram_rotation_limit, current_bot_index')
        .eq('slug', slug)
        .single();

      if (error || !link) return res.status(404).send('Link not found');

      // 2. Verificación de Pago / Estado
      // Si status es 'pending_payment' o is_active es false
      if (!link.is_active || link.status === 'pending_payment') {
         return res.status(403).send(`
            <body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                <div style="text-align:center; border:1px solid #334155; padding:40px; border-radius:20px; background:#1e293b;">
                    <h1 style="color:#f43f5e;">⚠️ SERVICIO SUSPENDIDO</h1>
                    <p>Este enlace ha sido desactivado temporalmente.</p>
                </div>
            </body>
         `);
      }

      // 3. Obtener Bots
      const { data: bots } = await supabase
        .from('telegram_bots')
        .select('*')
        .eq('smart_link_id', link.id)
        .order('id', { ascending: true });

      if (!bots || bots.length === 0) {
          // Fallback: Si no hay bots configurados, intentar usar el campo 'telegram' antiguo del smart_link si existe, o error.
          // Para este ejemplo, asumimos que deben configurar bots.
          return res.redirect('https://t.me/SoporteAgencia');
      }

      let currentIndex = link.current_bot_index || 0;
      if (currentIndex >= bots.length) currentIndex = 0; // Seguridad

      const currentBot = bots[currentIndex];

      // 4. Lógica de Conteo (Simple, sin Redis IP Lock por ahora para no complicar, o usando cookies)
      // Usaremos una cookie simple para evitar contar el mismo usuario dos veces en corto tiempo
      const cookieName = `tg_lock_${slug}`;
      if (!req.cookies[cookieName]) {

          // Incrementamos contador
          const newClicks = (currentBot.clicks_current || 0) + 1;

          // Actualizamos el bot actual
          await supabase
            .from('telegram_bots')
            .update({ clicks_current: newClicks })
            .eq('id', currentBot.id);

          // Verificamos límite
          const limit = link.telegram_rotation_limit || 200;

          if (newClicks >= limit) {
              // ROTACIÓN
              const nextIndex = (currentIndex + 1) % bots.length;

              // Actualizamos el índice en el link
              await supabase
                .from('smart_links')
                .update({ current_bot_index: nextIndex })
                .eq('id', link.id);

              // Opcional: Resetear el siguiente bot si queremos ciclos limpios,
              // pero tu lógica original reseteaba. Haremos lo mismo.
              const nextBot = bots[nextIndex];
              if (nextBot) {
                  await supabase
                    .from('telegram_bots')
                    .update({ clicks_current: 0 })
                    .eq('id', nextBot.id);
              }
          }

          // Marcar cookie por 1 hora
          res.cookie(cookieName, '1', { maxAge: 3600000, httpOnly: true });
      }

      // 5. Redirección Final
      return res.redirect(currentBot.url);

    } catch (err) {
      console.error("Rotation Error:", err);
      res.status(500).send('Error interno');
    }
  }
};