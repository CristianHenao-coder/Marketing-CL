const KNOWN_SEARCH_BOTS = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot', 'sogou', 'exabot', 'facebookexternalhit', 'facebot', 'facebookbot', 'tiktokbot', 'bytedance', 'byteamp', 'adsbot-google', 'twitterbot', 'linkedinbot', 'instagram', 'threads', 'pinterest', 'redditbot', 'discordbot', 'telegrambot', 'semrushbot', 'ahrefsbot', 'mj12bot', 'ccbot', 'dotbot', 'qwantify', 'screaming frog', 'petalbot'];
const GENERIC_BOT_TOKENS = ['crawler', 'spider', 'bot', 'fetch', 'httpclient', 'apache-httpclient', 'libwww', 'python-requests', 'axios/', 'curl/', 'wget', 'go-http', 'java/', 'scrapy', 'node-fetch', 'perl', 'php', 'httpx'];
const HEADLESS_HINTS = ['headlesschrome', 'puppeteer', 'playwright', 'phantomjs'];

const BOT_BLOCK_THRESHOLD = 10;
const BOT_CHALLENGE_THRESHOLD = 7;

const uaMatches = (list, ua) => {
    const s = String(ua || '').toLowerCase();
    return list.some(t => s.includes(t));
};

export const analyzeTraffic = (req, res) => {
    const { userAgent, headers = {} } = req.body;
    const ua = String(userAgent || '').toLowerCase();
    const h = headers;

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
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    const isCleanSafari = /version\/.*safari/.test(ua);
    const isExternalBrowser = /brave|chrome|crios|fxios|edgios|firefox|opera/.test(ua);

    // Lógica In-App
    const isIOSInApp = isIOS && !isCleanSafari && !isExternalBrowser;
    const isAndroidWebView = isAndroid && /wv/.test(ua);

    // Lista explícita de apps sociales
    const socialTokens = ['tiktok', 'instagram', 'fb_iab', 'fban', 'fbav', 'threads', 'musically', 'snapchat', 'line', 'whatsapp', 'telegram'];

    const isSocialApp = socialTokens.some(t => ua.includes(t)) ||
        String(h['x-requested-with'] || '').includes('musically') ||
        String(h['x-requested-with'] || '').includes('facebook') ||
        isIOSInApp ||
        isAndroidWebView;

    // --- 3. DECISION LOGIC ---

    // Bloqueo total si el score es muy alto
    if (score >= BOT_BLOCK_THRESHOLD) {
        return res.json({ action: 'block', score, debug: { isBot: true } });
    }

    // Si es una red social (o score de desafío), pedimos overlay/instrucciones
    if (isSocialApp || score >= BOT_CHALLENGE_THRESHOLD) {
        let socialType = 'generic';
        if (ua.includes('tiktok')) socialType = 'tiktok';
        if (ua.includes('instagram')) socialType = 'instagram';

        return res.json({
            action: 'show_overlay',
            type: socialType,
            score,
            debug: { isSocialApp, isIOSInApp, isAndroidWebView }
        });
    }

    // Tráfico limpio
    return res.json({ action: 'allow', score });
};
