export const authGuard = (req, res, next) => {
  const session = req.cookies?.admin_auth;

  // 1. Verificamos si la cookie existe
  if (session) {
    // Opcional: Aquí podrías decodificar la cookie para meter el user en req.adminUser
    // por ahora, si existe, lo dejamos pasar.
    return next();
  }

  // 2. Protección para la API o peticiones AJAX
  // Si la ruta empieza por /api o es un POST (como los de guardar/borrar)
  if (req.path.startsWith('/api') || req.xhr || req.headers['accept']?.includes('json')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // 3. Redirección correcta
  // IMPORTANTE: Redirigir al LOGIN, no a una ruta protegida.
  return res.redirect('/admin/login');
};