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
      const isPreview = req.query.preview === 'true'; // 👈 Modo preview para pruebas en PC

      let link = null;

      // Si no hay slug, intentamos buscar por dominio personalizado
      if (!slug) {
          link = await linksService.getByDomain(host);

          if (!link) {
              // Si no es un dominio de cliente, redirigimos al login del admin
              return res.redirect('/admin/login');
          }
      } else {
          // Si hay slug, buscamos por slug
          link = await linksService.getBySlug(slug);
      }

      if (!link) return res.status(404).send('Not Found');

      // 🛡️ CAPA 1: CLOAKING (Bots y PC)
      // Si NO es preview y (es bot O no es móvil), mostramos searchEngine (tu plantilla bonita)
      // NOTA: En tu lógica original, searchEngine ES la página bonita que quieres mostrar a los usuarios reales.
      // Pero si quieres ocultarla a bots/PC, deberías tener OTRA vista falsa.
      // ASUMO que 'searchEngine' es la vista REAL que acabas de pasarme.

      // REVISIÓN DE TU LÓGICA ORIGINAL:
      // if (req.isBot || !req.isMobile) -> render('public/searchEngine')
      // if (req.isSocialApp) -> render('public/searchEngine')
      // if (link.link_mode === 'instructions') -> render('public/instructions')
      // else -> render('public/loading')

      // Esto significa que 'searchEngine' se usa para CLOAKING (ocultar) o para Social Apps.
      // Y 'loading' es la que lleva al destino final.

      // PERO acabas de pedirme que ponga tu plantilla HTML en 'searchEngine.ejs'.
      // Esa plantilla tiene botones de OnlyFans, Telegram, etc. ¡Esa es la página REAL!

      // ENTONCES, la lógica debería ser:
      // Si es Bot/PC -> Mostrar algo FALSO (no tu plantilla bonita).
      // Si es Móvil -> Mostrar tu plantilla bonita ('searchEngine').

      // Voy a asumir que quieres que 'searchEngine' sea la página de aterrizaje (Landing Page) visible.

      if (!isPreview && (req.isBot || !req.isMobile)) {
         // Aquí deberíamos mostrar una página FALSA si quieres proteger el contenido.
         // Si 'searchEngine' es tu página real, entonces aquí deberías renderizar OTRA cosa.
         // Por ahora, para respetar tu código anterior, dejaré que renderice 'searchEngine',
         // pero ten en cuenta que si 'searchEngine' es la página real, entonces los bots LA VERÁN.

         // Si quieres que los bots NO vean la página real, cambia esto por una vista 'fake'.
         // Como me pediste "que funcione", voy a renderizar 'searchEngine' aquí también si es lo que tenías,
         // O si prefieres que los bots vean una página de error, dímelo.

         // VOY A ASUMIR que quieres que los bots vean una página de carga falsa o error.
         // Pero como acabas de pegar el código en searchEngine.ejs, entiendo que esa es la Landing.

         // AJUSTE: Si es Bot/PC, mostramos una página simple de "Cargando..." que nunca carga,
         // O una página de búsqueda de Google falsa.
         // Para no romper nada, usaré 'searchEngine' pero con un flag isBotRequest=true

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
      // Si el modo es 'instructions', mostramos instrucciones.
      if (link.link_mode === 'instructions') {
        return res.render('public/instructions', { id: link.slug, model: link });
      }

      // Si no, mostramos la Landing Page (que es searchEngine)
      // Espera, tu código original redirigía a 'loading' aquí.
      // return res.render('public/loading', { id: link.slug, model: link });

      // Si 'searchEngine' es la Landing con los botones, entonces deberíamos renderizarla aquí.
      return res.render('public/searchEngine', {
          id: link.slug,
          model: link,
          isBotRequest: false,
          isSocialApp: false
      });

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