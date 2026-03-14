const requestTimes = {};
const MAX_REQUESTS = 80;
const TIME_WINDOW = 60000;

const getRealIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.ip;
};

export const rateLimiter = (req, res, next) => {
  const ip = getRealIp(req);
  const sessionId = req.cookies.sessionId || 'anon';
  const key = `${ip}_${sessionId}`;
  const now = Date.now();

  if (!requestTimes[key]) requestTimes[key] = [];
  requestTimes[key] = requestTimes[key].filter(t => now - t < TIME_WINDOW);

  if (requestTimes[key].length >= MAX_REQUESTS) {
    return res.status(429).send('Too Many Requests');
  }
  requestTimes[key].push(now);
  next();
};

// Simple login limiter for now, reusing the same logic or stricter if needed
export const loginLimiter = (req, res, next) => {
    // For login, maybe we want stricter limits?
    // For now, let's just reuse the basic logic but with a different key prefix or just alias it if simple.
    // Or implement a specific one. Let's implement a specific stricter one for login.

    const ip = getRealIp(req);
    const key = `login_${ip}`;
    const now = Date.now();
    const LOGIN_MAX = 5; // 5 attempts
    const LOGIN_WINDOW = 60000; // per minute

    if (!requestTimes[key]) requestTimes[key] = [];
    requestTimes[key] = requestTimes[key].filter(t => now - t < LOGIN_WINDOW);

    if (requestTimes[key].length >= LOGIN_MAX) {
        return res.status(429).json({ success: false, error: 'Demasiados intentos de login. Intenta de nuevo en un minuto.' });
    }
    requestTimes[key].push(now);
    next();
};