import { linksService } from '../../services/links.service.js';
import { normalizeHost, delay } from '../../core/utils/http.js';
import crypto from 'crypto';

export const publicController = {

  // Lógica unificada para / y /:slug
  async handleRequest(req, res) {
    // Simulamos carga natural para despistar análisis automatizados rápidos
    await delay(Math.floor(Math.random() * 500) + 300);

    try {
      const { slug } = req.params;
      const host = normalizeHost(req.headers.host);

      // 1. Buscamos el link (ya sea por slug o por dominio propio)
      const link = slug
        ? await linksService.getBySlug(slug)
        : await linksService.getByDomain(host);

      if (!link) return res.status(404).send('Not Found');

      // 🛡️ CAPA 1: CLOAKING (Bots y PC)
      // Usamos las flags que vendrán de nuestro BotShield Middleware
      if (req.isBot || !req.isMobile) {
        return res.render('public/searchEngine', {
          id: link.slug,
          model: link,
          isBotRequest: true,
          isSocialApp: false
        });
      }

      // 🛡️ CAPA 2: ESCUDO SOCIAL (TikTok / Instagram / iOS In-App)
      if (req.isSocialApp) {
        return res.render('public/searchEngine', {
          id: link.slug,
          model: link,
          isBotRequest: false,
          isSocialApp: true
        });
      }

      // 🛡️ CAPA 3: DESTINO REAL (Mobile + Navegador Externo)
      if (link.link_mode === 'instructions') {
        return res.render('public/instructions', { id: link.slug, model: link });
      }

      return res.render('public/loading', { id: link.slug, model: link });

    } catch (e) {
      console.error("[PublicController Error]", e);
      res.status(500).send('Maintenance');
    }
  },

  // GATEWAY DE SALIDA (Tu API Cifrada)
  async getGate(req, res) {
    try {
      // Bloqueo preventivo si un bot llega aquí directamente
      if (req.isBot) return res.status(404).json({ s: 'fail' });

      const { id } = req.params; // Aquí 'id' es el slug
      const link = await linksService.getBySlug(id);

      if (!link || !link.onlyfans) {
        return res.status(404).json({ error: 'Node Offline' });
      }

      // 🛡️ Lógica de Deep Link Inteligente
      const targetUrl = link.onlyfans;
      const username = targetUrl.split('onlyfans.com/')[1]?.split('?')[0];
      const ua = String(req.headers['user-agent'] || '').toLowerCase();
      const isIos = /iphone|ipad|ipod/.test(ua);

      const deepLink = isIos
          ? `onlyfans://user/${username}`
          : `intent://onlyfans.com/${username}#Intent;package=com.onlyfans;scheme=https;end`;

      // Payload cifrado (Base64)
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
          res.render('public/loading', { id: link.slug, model: link });
      } catch (e) {
          console.error("[PublicController Error]", e);
          res.status(500).send('Maintenance');
      }
  }
};