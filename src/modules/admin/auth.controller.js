import bcrypt from 'bcrypt';
import { supabase } from '../../config/supabase.js'; // Asegúrate de tener tu cliente de supabase aquí

export const authController = {
  // Renderiza la página de login
  renderLogin(req, res) {
    res.render('admin/login');
  },
  
  logout(req, res) {
    // Borramos la cookie de sesión
    res.clearCookie('admin_session');
    // Redirigimos al login
    res.redirect('/admin/login');
  },

  // Proceso de Login
  async login(req, res) {
    const { user, pass } = req.body;

    try {
      // 1. Buscamos al usuario en la tabla admin_users
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', user)
        .single();

      if (error || !admin) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }

      // 2. Comparamos la contraseña enviada con el hash de la DB 🔐
      const match = await bcrypt.compare(pass, admin.password_hash);

      if (match) {
        // 3. Si coincide, creamos la cookie de sesión
        // Usamos un token simple por ahora (puedes mejorar a JWT luego)
        const token = Buffer.from(`${user}:${admin.password_hash}`).toString('base64');
        
        res.cookie('admin_auth', token, { 
          httpOnly: true, 
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000 // 1 día
        });
        
        return res.json({ success: true });
      } else {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }
};