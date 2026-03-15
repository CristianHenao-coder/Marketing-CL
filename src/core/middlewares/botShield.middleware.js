const KNOWN_SEARCH_BOTS = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot', 'sogou', 'exabot', 'facebookexternalhit', 'facebot', 'facebookbot', 'bytedance', 'byteamp', 'adsbot-google', 'twitterbot', 'linkedinbot', 'instagram', 'threads', 'pinterest', 'redditbot', 'discordbot', 'telegrambot', 'semrushbot', 'ahrefsbot', 'mj12bot', 'ccbot', 'dotbot', 'qwantify', 'screaming frog', 'petalbot'];
const GENERIC_BOT_TOKENS = ['crawler', 'spider', 'bot', 'fetch', 'httpclient', 'apache-httpclient', 'libwww', 'python-requests', 'axios/', 'curl/', 'wget', 'go-http', 'java/', 'scrapy', 'node-fetch', 'perl', 'php', 'httpx'];
const HEADLESS_HINTS = ['headlesschrome', 'puppeteer', 'playwright', 'phantomjs'];

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
  if (uaMatches(GENERIC_BOT_TOKENS, ua)) score += 5; // Scrapers (httpx, requests, etc) now score higher

  // Anomalías de Headers
  if (!ua || ua.length < 10) score += 2;
  if (!String(h['accept'] || '').includes('text/html')) score += 1;
  if (!h['accept-language']) score += 0.5;
  if (HEADLESS_HINTS.some(t => ua.includes(t))) score += 2;

  // --- 2. DETECCIÓN DE DISPOSITIVO Y APPS SOCIALES ---
  const isMobile = /iphone|ipad|ipod|android|blackberry|mobile|samsung|htc|nokia|opera mini/i.test(ua);

  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  const isCleanSafari = /version\/.*safari/.test(ua);
  const isExternalBrowser = /brave|chrome|crios|fxios|edgios|firefox|opera/.test(ua);

  // Lógica In-App (TikTok, IG, FB, Telegram, WhatsApp, etc.)

  // iOS: Si no es Safari limpio ni Chrome/Firefox externo -> Es In-App
  const isIOSInApp = isIOS && !isCleanSafari && !isExternalBrowser;

  // Android: Si contiene 'wv' (WebView) suele ser una app interna
  const isAndroidWebView = isAndroid && /wv/.test(ua);

  // Lista explícita de apps sociales - TikTok usa musical_ly (con guion bajo)
  const socialTokens = ['tiktok', 'instagram', 'fb_iab', 'fban', 'fbav', 'threads', 'musical.ly', 'musical_ly', 'musically', 'snapchat', 'line', 'whatsapp', 'telegram', 'linkedin', 'pinterest'];

  const isSocialApp = socialTokens.some(t => ua.includes(t)) ||
    String(h['x-requested-with'] || '').includes('musically') ||
    String(h['x-requested-with'] || '').includes('musical_ly') ||
    String(h['x-requested-with'] || '').includes('facebook') ||
    isIOSInApp ||
    isAndroidWebView;

  // 🔒 Detección específica de Instagram/Threads (Meta)
  // Separada porque tienen escaneo de source code — requieren bypass especial
  const metaTokens = ['instagram', 'threads'];
  const isInstagramThreads = metaTokens.some(t => ua.includes(t)) ||
    String(h['x-ig-app-id'] || '').length > 0 ||
    String(h['x-ig-device-id'] || '').length > 0;

  // --- 3. INYECCIÓN DE FLAGS (Para uso en Controllers) ---
  req.isBot = score >= BOT_CHALLENGE_THRESHOLD;
  req.isMobile = isMobile;
  req.isSocialApp = isSocialApp;
  req.isInstagramThreads = isInstagramThreads; // 🔒 Flag Meta para bypass especial

  // --- 4. ACCIÓN DE BLOQUEO / DESAFÍO (Desactivado para Ultra-Stealth) ---
  // En lugar de bloquear con 403 (que es una firma de bridge), 
  // simplemente marcamos como bot y dejamos que el controller muestre el cloaking (searchEngine).
  const pathOkForBots = /^\/(instructions|clook|public|assets|images|favicon\.ico|robots\.txt|ping|private-link|admin|api|challenge)/i.test(req.path);

  const hasJS = Boolean(req.cookies[JS_CHALLENGE_COOKIE]);
  
  // Solo desafiamos a bots obvios que NO son apps sociales y van a rutas críticas
  if (score >= BOT_CHALLENGE_THRESHOLD && !hasJS && !pathOkForBots && !isSocialApp && !isMobile) {
    const back = encodeURIComponent(req.originalUrl || req.url || '/');
    return res.redirect(302, `/challenge?back=${back}`);
  }

  // --- 5. REFINAMIENTO DE DETECCIÓN (WebView) ---
  // Detectar específicamente WebView (común en TikTok iOS/Android y otros)
  // 1. iPhone/iPad sin Safari = WebView
  if ((ua.includes('iphone') || ua.includes('ipad')) && !ua.includes('safari')) {
    req.isSocialApp = true;
  }

  // 2. Android con versiones específicas de WebView o indicativos comunes
  if (ua.includes('android') && (ua.includes('wv') || ua.includes('version/'))) {
    req.isSocialApp = true;
  }

  return next();
};