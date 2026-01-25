const KNOWN_SEARCH_BOTS = ['googlebot','bingbot','slurp','duckduckbot','baiduspider','yandexbot','sogou','exabot','facebookexternalhit','facebot','facebookbot','tiktokbot','bytedance','byteamp','adsbot-google','twitterbot','linkedinbot','instagram','threads','pinterest','redditbot','discordbot','telegrambot','semrushbot','ahrefsbot','mj12bot','ccbot','dotbot','qwantify','screaming frog','petalbot'];
const GENERIC_BOT_TOKENS = ['crawler','spider','bot','fetch','httpclient','apache-httpclient','libwww','python-requests','axios/','curl/','wget','go-http','java/','scrapy','node-fetch','perl','php','httpx'];
const HEADLESS_HINTS = ['headlesschrome','puppeteer','playwright','phantomjs'];

const BOT_BLOCK_THRESHOLD = 10;
const BOT_CHALLENGE_THRESHOLD = 7;
const JS_CHALLENGE_COOKIE = 'js_challenge';

const uaMatches = (list, ua) => {
  const s = String(ua || '').toLowerCase();
  return list.some(t => s.includes(t));
};

export const botShield = (req, res, next) => {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  const h = req.headers;

  // --- 1. CÁLCULO DE SCORE DE BOT ---
  let score = 0;
  if (uaMatches(KNOWN_SEARCH_BOTS, ua)) score += 5;
  if (uaMatches(GENERIC_BOT_TOKENS, ua)) score += 3;

  // Anomalías de Headers
  if (!ua || ua.length < 10) score += 2;
  if (!String(h['accept'] || '').includes('text/html')) score += 1;
  if (!h['accept-language']) score += 0.5;
  if (HEADLESS_HINTS.some(t => ua.includes(t))) score += 2;

  // --- 2. DETECCIÓN DE DISPOSITIVO Y APPS SOCIALES ---
  // Mejorada para Android y más apps
  const isMobile = /iphone|ipad|ipod|android|blackberry|mobile|samsung|htc|nokia|opera mini/i.test(ua);

  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isCleanSafari = /version\/.*safari/.test(ua);
  const isExternalBrowser = /brave|chrome|crios|fxios|edgios|firefox|opera/.test(ua);

  // Lógica In-App (TikTok, IG, FB, Telegram, WhatsApp, etc.)
  // Si es iOS y NO es Safari limpio ni Chrome/Firefox externo -> Es In-App
  const isIOSInApp = isIOS && !isCleanSafari && !isExternalBrowser;

  // Lista explícita de apps sociales
  const socialTokens = ['tiktok', 'instagram', 'fb_iab', 'fban', 'fbav', 'threads', 'musically', 'snapchat', 'line', 'whatsapp', 'telegram'];

  const isSocialApp = socialTokens.some(t => ua.includes(t)) ||
                      String(h['x-requested-with'] || '').includes('musically') ||
                      String(h['x-requested-with'] || '').includes('facebook') ||
                      isIOSInApp;

  // --- 3. INYECCIÓN DE FLAGS (Para uso en Controllers) ---
  req.isBot = score >= BOT_CHALLENGE_THRESHOLD;
  req.isMobile = isMobile;
  req.isSocialApp = isSocialApp;

  // LOG DE DEPURACIÓN (Ver en Render)
  // console.log(`🛡️ Shield: IP=${req.ip} Mobile=${isMobile} Social=${isSocialApp} Bot=${req.isBot} UA=${ua.substring(0, 50)}...`);

  // --- 4. ACCIÓN DE BLOQUEO / DESAFÍO ---
  const pathOkForBots = /^\/(instructions|clook|public|assets|images|favicon\.ico|robots\.txt|ping|private-link|admin|api|challenge)/i.test(req.path);

  if (score >= BOT_BLOCK_THRESHOLD && !pathOkForBots) {
    return res.status(403).send('Forbidden');
  }

  const hasJS = Boolean(req.cookies[JS_CHALLENGE_COOKIE]);
  if (score >= BOT_CHALLENGE_THRESHOLD && !hasJS && !pathOkForBots) {
    const back = encodeURIComponent(req.originalUrl || req.url || '/');
    return res.redirect(302, `/challenge?back=${back}`);
  }

  next();
};