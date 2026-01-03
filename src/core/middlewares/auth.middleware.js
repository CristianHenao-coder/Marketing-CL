export const authGuard = (req, res, next) => {
  const session = req.cookies?.admin_auth;

  // 1. Verificamos simplemente si la cookie existe
  if (session) {
    return next();
  }

  // 2. Protección para la API
  if (req.path.startsWith('/api')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // 3. Si no hay sesión, al login
  res.redirect('/admin/list');
};