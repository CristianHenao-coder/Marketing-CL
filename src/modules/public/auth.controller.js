import { env } from '../../config/env.js';

export const authController = {
  // Muestra la página de login
  renderLogin(req, res) {
    res.render('admin/login');
  },

  // Procesa las credenciales
  login(req, res) {
    const { user, pass } = req.body;

    if (user === env.ADMIN_USER && pass === env.ADMIN_PASS) {
      // Creamos un token básico en Base64 (puedes mejorar a JWT luego)
      const token = Buffer.from(`${user}:${pass}`).toString('base64');
      
      // Guardamos la cookie de forma segura (httpOnly evita robos por JS)
      res.cookie('admin_auth', token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 día de duración
      });
      
      return res.json({ success: true });
    }

    res.status(401).json({ error: 'Unauthorized' });
  },

  // Cerrar sesión
  logout(req, res) {
    res.clearCookie('admin_auth');
    res.redirect('/admin/login');
  }
};