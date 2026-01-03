import { linksService } from '../../services/links.service.js';
import { storageService } from '../../services/storage.service.js';
import { env } from '../../config/env.js';

export const adminController = {
  // Muestra el listado de links (reemplaza tu app.get('/admin/list'))
  async listLinks(req, res) {
    try {
      const { data: links, error } = await linksService.getAll(); // Necesitaremos añadir getAll al servicio
      if (error) throw error;
      res.render('admin/list', { links : []});
    } catch (error) {
      res.status(500).send('Error cargando la lista');
    }
  },

  // Procesa la creación de un nuevo link con foto
  async createLink(req, res) {
    try {
      const { slug, display_name, subtitle, instagram, onlyfans, tiktok, link_mode } = req.body;
      const file = req.file; // Multer nos da el archivo aquí
      
      let photoUrl = req.body.photo || null;

      // 1. Si hay una nueva foto, la subimos primero
      if (file) {
        const upload = await storageService.uploadPhoto(
          file.buffer, 
          file.originalname, 
          file.mimetype, 
          slug
        );
        photoUrl = upload.publicUrl;
      }

      // 2. Preparamos el objeto para la DB
      const newLink = {
        id: slug.trim(),
        name: display_name,
        subtitle,
        instagram,
        onlyfans,
        tiktok,
        photo: photoUrl,
        link_mode: link_mode || 'landing'
      };

      // 3. Guardamos usando el servicio que ya creamos
      await linksService.saveLink(newLink);

      res.json({ success: true, message: 'Link creado con éxito', photoUrl });
    } catch (error) {
      console.error('Error en createLink:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
};