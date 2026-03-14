export const botShield = (req, res, next) => {
  const ua = req.headers['user-agent']?.toLowerCase() || '';

  // 1. Lista de Bots conocidos (Crawlers)
  const botList = [
    'bot', 'crawl', 'spider', 'slurp', 'facebookexternalhit', 
    'googlebot', 'bingbot', 'adsbot', 'twitterbot'
  ];

  // 2. Lista de Aplicaciones Sociales (WebView)
  const socialApps = [
    'tiktok', 'musical.ly', 'instagram', 'fban', 'fbav', 
    'snapchat', 'whatsapp', 'linkedin', 'pinterest', 'telegram'
  ];

  // Asignamos las propiedades al objeto 'req' para usarlas en el controlador
  req.isBot = botList.some(bot => ua.includes(bot));
  req.isSocialApp = socialApps.some(app => ua.includes(app));

  // Detectar específicamente WebView (común en TikTok iOS/Android y otros)
  // 1. iPhone/iPad sin Safari = WebView
  if ((ua.includes('iphone') || ua.includes('ipad')) && !ua.includes('safari')) {
    req.isSocialApp = true;
  }

  // 2. Android con versiones específicas de WebView o indicativos comunes
  if (ua.includes('android') && (ua.includes('wv') || ua.includes('version/'))) {
    // Muchos in-app browsers en Android incluyen "Version/X.X" o "; wv)"
    req.isSocialApp = true;
  }

  next(); // Continuamos al siguiente paso (el controlador)
};