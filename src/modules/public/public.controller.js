import { linksService } from '../../services/links.service.js';
import { normalizeHost, delay } from '../../core/utils/http.js';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { supabase } from '../../config/supabase.js';

export const publicController = {

  // Lógica unificada para / y /:slug
  async handleRequest(req, res) {
    // 0. Seguridad: Forzar HTTPS (TikTok es sumamente estricto con esto)
    if (!req.headers['x-forwarded-proto'] || req.headers['x-forwarded-proto'] === 'http') {
      if (req.headers.host && !req.headers.host.includes('localhost') && !req.headers.host.includes('127.0.0.1')) {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
    }

    // Stealth: Usar cabeceras normales para evitar parecer un puente
    res.setHeader('Cache-Control', 'public, max-age=600'); 
    res.removeHeader('X-Powered-By');

    // Simulamos carga natural para despistar análisis automatizados rápidos (solo en GET y texto/html)
    const isHtml = (req.headers['accept'] || '').includes('text/html');
    if (req.method === 'GET' && isHtml) {
      await delay(Math.floor(Math.random() * 400) + 200);
    }

    try {
      const params = req.params || {};
      const { slug } = params;
      const host = normalizeHost(req.headers.host);
      const isPreview = req.query.preview === 'true';
      const forceGate = req.query.gate === 'true';

      let link = null;

      if (!slug) {
        link = await linksService.getByDomain(host);
        if (!link) {
          // Stealth: Si no hay link vinculado al dominio, mostramos un portal de seguridad "LinkPro"
          // genérico. Esto hace que el dominio parezca una web de servicios reales ante TikTok.
          return res.render('public/instructions', {
            id: 'generic',
            model: { name: 'Secure Protocol', display_name: 'LinkPro Secure' },
            layout: false
          });
        }
      } else {
        link = await linksService.getBySlug(slug);
      }

      if (!link) {
        // Si no hay slug, pero el robot prueba rutas aleatorias, mostramos el Cloaking (searchEngine)
        return res.render('public/searchEngine', {
          id: 'error',
          model: { name: 'Support', photo: '/images/gitonly.png' },
          isBotRequest: true,
          isSocialApp: false,
          layout: false
        });
      }

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
          isBotRequest: req.isBot, // Ahora solo es VERDADERO 'isBotRequest' si el score del middleware es alto
          isSocialApp: false,
          layout: false
        });
      }

      // 🔒 CAPA 2A: BYPASS INSTAGRAM / THREADS (Meta Source Code Scanning)
      const isMetaShieldActive = link.advanced_config?.meta_shield !== false;
      if (isMetaShieldActive && req.isInstagramThreads) {
        return res.render('public/igBypass', {
          id: link.slug,
          layout: false
        });
      }

      // 🛡️ CAPA 2B: ESCUDO SOCIAL (Triple-Jump Flow)
      // Siempre usamos instructions.ejs para el flujo de TikTok/Social, 
      // EXCEPTO si el usuario ya viene del salto (?jump=true)
      const isJump = req.query.jump === 'true';

      if ((req.isSocialApp || req.isMobile) && !isJump) {
        const isTikTokShieldActive = link.advanced_config?.tiktok_shield !== false;
        const isMetaShieldActiveForSocial = link.advanced_config?.meta_shield !== false;

        // Validación de escudos activos
        let shieldRequired = false;
        if (req.isInstagramThreads && isMetaShieldActiveForSocial) shieldRequired = true;
        if (!req.isInstagramThreads && isTikTokShieldActive) shieldRequired = true;

        if (shieldRequired || link.link_mode === 'instructions') {
          return res.render('public/instructions', {
            id: link.slug,
            model: link,
            layout: false
          });
        }
      }

      // 🛡️ CAPA 3: DESTINO REAL (Para PC o casos sin escudo)
      // Si el modo es 'loading' o venimos de un salto, mostramos la visualización correspondiente
      if (link.link_mode === 'loading') {
        return res.render('public/loading', {
          id: link.slug,
          model: link,
          supabaseStorageUrl: env.SUPABASE_STORAGE_URL,
          layout: false
        });
      }

      // Si es un Salto (Triple-Jump) o modo landing, mostramos la landing page real (con botones)
      if (isJump || link.link_mode === 'landing') {
        return res.render('public/searchEngine', {
          id: link.slug,
          model: link,
          isBotRequest: false,
          isSocialApp: false,
          layout: false
        });
      }

      if (link.onlyfans) {
        return res.redirect(302, link.onlyfans);
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
        return res.status(500).send('Maintenance');
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
        const codes = Array.from(targetUrl).map(c => c.charCodeAt(0));
        const sig = crypto.createHash('md5').update(id + (process.env.COOKIE_SECRET || 'gate')).digest('hex').slice(0, 8);
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
      console.error("[PublicController Error]", e);
      if (!res.headersSent) {
        return res.status(500).json({ s: 'error' });
      }
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
      if (!res.headersSent) {
        return res.status(500).send('Maintenance');
      }
    }
  },

  async renderChallenge(req, res) {
    const back = req.query.back || '/';
    res.cookie('js_challenge', '1', { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'Lax' });
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>Verifying...</title></head>
      <body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <div style="text-align:center;">
          <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top:3px solid #ff006e;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 20px;"></div>
          <p>Verifying access...</p>
        </div>
        <style>@keyframes s { to { transform:rotate(360deg); } }</style>
        <script>setTimeout(() => { window.location.href = "${decodeURIComponent(back)}"; }, 1000);</script>
      </body>
      </html>
    `);
  },

  async renderRobots(req, res) {
    res.type('text/plain');
    res.render('public/robots.txt.ejs', { layout: false });
  }
};