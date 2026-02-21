import { supabaseAdmin, supabaseAuth } from '../../config/supabase.js';

const COOKIE_OPTIONS = (isProd) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  signed: true,
});

export const authController = {
  // ======================
  //  LOGIN (VISTA)
  // ======================
  renderLogin(req, res) {
    if (req.adminUser) {
      return res.redirect('/admin/dashboard');
    }

    return res.render('admin/login', {
      layout: false,
      title: 'Admin Access',
    });
  },

  // ======================
  //  LOGIN (POST) - Email/Password (Supabase Auth)
  // ======================
  async login(req, res) {
    const { email, password } = req.body;
    const isProd = process.env.NODE_ENV === 'production';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    try {
      // 1) Login con Supabase Auth
      const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
      if (error || !data?.session || !data?.user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const userId = data.user.id;

      // 2) Verificar que sea admin (whitelist admin_users)
      const { data: adminRow, error: adminErr } = await supabaseAdmin
        .from('admin_users')
        .select('id, user_id, username, created_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (adminErr || !adminRow) {
        // No es admin: no permitimos acceso
        return res.status(403).json({ error: 'No autorizado (no es admin)' });
      }

      // 3) Guardar tokens en cookies firmadas
      res.cookie('admin_at', data.session.access_token, { ...COOKIE_OPTIONS(isProd), maxAge: 60 * 60 * 1000 }); // 1h
      res.cookie('admin_rt', data.session.refresh_token, { ...COOKIE_OPTIONS(isProd), maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30d

      // 4) OK
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
    res.clearCookie('admin_at');
    res.clearCookie('admin_rt');
    return res.redirect('/admin/login');
  },
};