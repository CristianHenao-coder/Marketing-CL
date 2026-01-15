// src/modules/admin/auth.controller.js
import bcrypt from 'bcrypt';
import { supabase } from '../../config/supabase.js';

export const authController = {
  // ======================
  //  LOGIN (VISTA)
  // ======================
  renderLogin(req, res) {
    // Si ya está autenticado, lo mandamos directo al dashboard
    if (req.adminUser) {
      return res.redirect('/admin/dashboard');
    }

    // 👇 DESACTIVAMOS EL LAYOUT GLOBAL
    return res.render('admin/login', {
      layout: false,              // <--- clave para que NO use admin/layout.ejs
      title: 'Admin Access',
    });
  },

  // ======================
  //  LOGIN (POST)
  // ======================
  async login(req, res) {
    const { user, pass } = req.body;

    try {
      // 1. Buscar usuario en tabla admin_users
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', user)
        .single();

      if (error || !admin) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }

      // 2. Comparar contraseña con el hash
      const match = await bcrypt.compare(pass, admin.password_hash);

      if (!match) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }

      // 3. Crear cookie de sesión simple (puedes pasar luego a JWT)
      const token = Buffer.from(`${user}:${admin.password_hash}`).toString('base64');

      res.cookie('admin_auth', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 día
      });

      return res.json({ success: true });
    } catch (err) {
      console.error('[authController.login] Error:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
  },

  // ======================
  //  LOGOUT
  // ======================
  logout(req, res) {
    // 👇 Usa el MISMO nombre de cookie que pusimos en login
    res.clearCookie('admin_auth');
    return res.redirect('/admin/login');
  },
};
