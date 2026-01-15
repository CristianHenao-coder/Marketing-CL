import { linksService } from '../../services/links.service.js';
import { normalizeHost, getRealIp } from '../../core/utils/http.js';

export const publicController = {
  // Maneja la entrada principal (/)
  async renderIndex(req, res) {
    const host = normalizeHost(req.headers.host);
    
    // 1. Buscamos si el dominio existe en nuestra DB
    const link = await linksService.getByDomain(host);

    if (!link) {
      // Si el dominio no está registrado, mostramos una página neutra
      return res.render('public/searchEngine', { id: 'unknown' });
    }

    // 2. Lógica de Cloaking para Bots 🛡️
    // req.isBot vendrá de un middleware que haremos luego
    if (req.isBot) {  
      return res.render('safe/yoga-blog'); 
    }

    // 3. Decidimos qué vista mostrar según el modo configurado
    if (link.link_mode === 'instructions') {
      return res.render('public/instructions', { 
        id: link.id, 
        isSocialApp: req.isSocialApp // Detectado por el middleware
      });
    }

    // Por defecto, lo enviamos al flujo de carga
    return res.render('public/loading', { id: link.id });
  },

  // Maneja la ruta /loading/:id
  async renderLoading(req, res) {
    const { id } = req.params;
    res.render('public/loading', { id });
  },

  // El "Gate" que entrega el link final cifrado (usado por el fetch de loading.ejs)
  async getGate(req, res) {
    const { id } = req.params;
    const link = await linksService.getById(id);

    if (!link) return res.status(404).json({ error: 'Not found' });

    // Ofuscamos el link final en Base64 como ya lo hacías
    const target = Buffer.from(link.onlyfans || link.instagram).toString('base64');
    res.json({ data: target });
  }
};