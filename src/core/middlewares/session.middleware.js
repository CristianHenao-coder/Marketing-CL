import crypto from 'crypto';

export const sessionMiddleware = (req, res, next) => {
  if (!req.cookies.sessionId) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    // Configuración basada en tu código: httpOnly y Lax
    res.cookie('sessionId', sessionId, { httpOnly: true, sameSite: 'Lax' });
    req.sessionId = sessionId;
  } else {
    req.sessionId = req.cookies.sessionId;
  }
  next();
};