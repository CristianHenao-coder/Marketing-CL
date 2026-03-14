import { linksService } from '../../services/links.service.js';
import { normalizeHost, delay } from '../../core/utils/http.js';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { supabase } from '../../config/supabase.js';

export const publicController = {

  // Lógica unificada para / y /:slug
  async handleRequest(req, res) {
    // Simulamos carga natural para despistar análisis automatizados rápidos
    await delay(Math.floor(Math.random() * 500) + 300);

    try {
      const { slug } = req.params || {};
      const host = normalizeHost(req.headers.host);
      const isPreview = req.query.preview === 'true';
      const forceGate = req.query.gate === 'true';

      let link = null;

      if (!slug) {
        link = await linksService.getByDomain(host);
        if (!link) return res.redirect('/admin/login');
      } else {
        link = await linksService.getBySlug(slug);
      }

      if (!link) return res.status(404).send('Not Found');

      // 🤖 VERIFICACIÓN TELEGRAM (Rotador o Fijo)
      const { count: botsCount } = await supabase
        .from('telegram_bots')
        .select('*', { count: 'exact', head: true })
        .eq('smart_link_id', link.id);

      link.hasTelegramBots = botsCount > 0;

      // 🛡️ MODO DEBUG VISUAL
      if (forceGate) {
        return res.render('public/searchEngine', {
          id: link.slug,
          model: link,
          isBotRequest: false,
          isSocialApp: true,
          layout: false
        });
      }

      // 🛡️ CAPA 1: CLOAKING (Bots y PC)
      if (!isPreview && (req.isBot || !req.isMobile)) {
        return res.render('public/searchEngine', {
          id: link.slug,
          model: link,
          isBotRequest: true,
          isSocialApp: false,
          layout: false
        });
      }

      // 🔒 CAPA 2A: BYPASS INSTAGRAM / THREADS (Meta Source Code Scanning)
      // Por defecto activo si no se indica lo contrario
      const isMetaShieldActive = link.advanced_config?.meta_shield !== false;
      if (isMetaShieldActive && req.isInstagramThreads) {
        return res.render('public/igBypass', {
          id: link.slug,
          layout: false
        });
      }

      // 🛡️ CAPA 2B: ESCUDO SOCIAL (TikTok / otras social apps / iOS In-App / Android WebView)
      const isTikTokShieldActive = link.advanced_config?.tiktok_shield !== false;
      // isMetaShieldActive ya está declarado arriba, pero se re-declara aquí para el contexto de la capa 2B y 3
      const isMetaShieldActiveForSocial = link.advanced_config?.meta_shield !== false;

      if (req.isSocialApp) {
        // 🔒 Validación: Si es Meta pero no tiene Meta Shield, o si es otra social y no tiene TikTok Shield
        let blockDueToMissingShield = false;

        if (req.isInstagramThreads && !isMetaShieldActiveForSocial) {
          blockDueToMissingShield = true;
        } else if (!req.isInstagramThreads && !isTikTokShieldActive) {
          blockDueToMissingShield = true;
        }

        if (blockDueToMissingShield) {
          return res.render('public/upgradeRequired', { id: link.slug, layout: false });
        }

        return res.render('public/searchEngine', {
          id: link.slug,
          model: link,
          isBotRequest: false,
          isSocialApp: true,
          layout: false
        });
      }

      // 🛡️ CAPA 3: DESTINO REAL
      if (link.link_mode === 'instructions') {
        // 🔒 VALIDACIÓN COMERCIAL: ¿Está usando instrucciones como "escudo gratis"?
        let blockInstructions = false;

        // Si viene de Meta y NO pagó Meta Shield -> Bloqueo
        if (req.isInstagramThreads && !isMetaShieldActiveForSocial) blockInstructions = true;

        // Si viene de TikTok/otras y NO pagó TikTok Shield -> Bloqueo
        if (req.isSocialApp && !blockInstructions && !isTikTokShieldActive) blockInstructions = true;

        if (blockInstructions) {
          return res.render('public/upgradeRequired', {
            id: link.slug,
            layout: false
          });
        }

        return res.render('public/instructions', {
          id: link.slug,
          model: link,
          layout: false
        });
      }

      return res.render('public/searchEngine', {
        id: link.slug,
        model: link,
        isBotRequest: false,
        isSocialApp: false,
        layout: false
      });

    } catch (e) {
      console.error("[PublicController Error]", e);
      if (!res.headersSent) {
        res.status(500).send('Maintenance');
      }
    }
  },

  // GATEWAY DE SALIDA (Tu API Cifrada)
  async getGate(req, res) {
    try {
      if (req.isBot) return res.status(404).json({ s: 'fail' });

      const { id } = req.params;
      const link = await linksService.getBySlug(id);

      if (!link || !link.onlyfans) {
        return res.status(404).json({ error: 'Node Offline' });
      }

      const targetUrl = link.onlyfans;
      const ua = String(req.headers['user-agent'] || '').toLowerCase();
      const isIos = /iphone|ipad|ipod/.test(ua);

      // 🔒 MODO ANTI-SCAN META (Instagram / Threads)
      const isMetaShieldActive = link.advanced_config?.meta_shield === true;
      const isMetaRequest = req.isInstagramThreads || ['instagram', 'threads'].some(t => ua.includes(t));

      if (isMetaShieldActive && isMetaRequest) {
        // Convertimos la URL a array de char codes (no hay string "onlyfans.com" en la respuesta)
        const codes = Array.from(targetUrl).map(c => c.charCodeAt(0));
        const sig = crypto.createHash('md5').update(id + (process.env.COOKIE_SECRET || 'gate')).digest('hex').slice(0, 8);
        // Mezclamos la firma dentro del array para dificultar análisis
        return res.json({ c: codes, s: sig, t: Date.now() });
      }

      // Flujo normal (no Meta)
      const username = targetUrl.split('onlyfans.com/')[1]?.split('?')[0];
      const deepLink = isIos
        ? `onlyfans://user/${username}`
        : `intent://onlyfans.com/${username}#Intent;package=com.onlyfans;scheme=https;end`;

      const payload = {
        u: targetUrl,
        d: deepLink,
        ts: Date.now(),
        v: crypto.createHash('md5').update(id + (process.env.COOKIE_SECRET || 'gate')).digest('hex')
      };

      const secureData = Buffer.from(JSON.stringify(payload)).toString('base64');
      res.json({ data: secureData });

    } catch (e) {
      res.status(500).json({ s: 'error' });
    }
  },

  async renderLoading(req, res) {
    try {
      const { id } = req.params;
      const link = await linksService.getBySlug(id);
      if (!link) return res.status(404).send('Not Found');
      res.render('public/loading', {
        id: link.slug,
        model: link,
        supabaseStorageUrl: env.SUPABASE_STORAGE_URL,
        layout: false
      });
    } catch (e) {
      console.error("[PublicController Error]", e);
      res.status(500).send('Maintenance');
    }
  }
};