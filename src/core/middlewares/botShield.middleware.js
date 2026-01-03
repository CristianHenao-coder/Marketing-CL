export const botShield = (req, res, next) => {
  const ua = req.headers['user-agent']?.toLowerCase() || '';

  // 1. Lista de Bots conocidos (Crawlers)
  const botList = [
    'bot', 'crawl', 'spider', 'slurp', 'facebookexternalhit', 
    'googlebot', 'bingbot', 'adsbot', 'twitterbot'
  ];

  // 2. Lista de Aplicaciones Sociales (WebView)
  const socialApps = ['tiktok', 'instagram', 'fban', 'fbav'];

  // Asignamos las propiedades al objeto 'req' para usarlas en el controlador
  req.isBot = botList.some(bot => ua.includes(bot));
  req.isSocialApp = socialApps.some(app => ua.includes(app));

  // Detectar específicamente iPhone WebView (común en TikTok iOS)
  if ((ua.includes('iphone') || ua.includes('ipad')) && !ua.includes('safari')) {
    req.isSocialApp = true;
  }

  next(); // Continuamos al siguiente paso (el controlador)
};