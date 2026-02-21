import { supabaseAdmin, supabaseAuth } from '../../config/supabase.js';

async function ensureAdminFromToken(accessToken) {
  // valida token contra Supabase Auth
  const { data, error } = await supabaseAuth.auth.getUser(accessToken);
  if (error || !data?.user) return { ok: false };

  // verifica whitelist admin_users
  const { data: adminRow, error: adminErr } = await supabaseAdmin
    .from('admin_users')
    .select('id, user_id, username')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (adminErr || !adminRow) return { ok: false };

  return { ok: true, user: data.user, admin: adminRow };
}

export const authGuard = async (req, res, next) => {
  try {
    const accessToken = req.signedCookies?.admin_at;
    const refreshToken = req.signedCookies?.admin_rt;

    // 1) Si hay access token, valida
    if (accessToken) {
      const check = await ensureAdminFromToken(accessToken);
      if (check.ok) {
        req.adminUser = check.user;
        req.adminRow = check.admin;
        return next();
      }
    }

    // 2) Si access token expiró, intenta refresh
    if (refreshToken) {
      const { data: refreshed, error: refreshErr } = await supabaseAuth.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!refreshErr && refreshed?.session?.access_token && refreshed?.session?.refresh_token) {
        // valida que siga siendo admin
        const check = await ensureAdminFromToken(refreshed.session.access_token);
        if (check.ok) {
          const isProd = process.env.NODE_ENV === 'production';
          res.cookie('admin_at', refreshed.session.access_token, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            signed: true,
            maxAge: 60 * 60 * 1000,
          });
          res.cookie('admin_rt', refreshed.session.refresh_token, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            signed: true,
            maxAge: 30 * 24 * 60 * 60 * 1000,
          });

          req.adminUser = check.user;
          req.adminRow = check.admin;
          return next();
        }
      }
    }

    // 3) Protección API
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // 4) Si no hay sesión válida, al login
    return res.redirect('/admin/login');
  } catch (err) {
    console.error('[authGuard] Error:', err);
    return res.redirect('/admin/login');
  }
};