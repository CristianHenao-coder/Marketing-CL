export const normalizeHost = (rawHostHeader = '') => {
  let host = String(rawHostHeader || '').toLowerCase().split(':')[0].trim();
  if (host.startsWith('www.')) host = host.slice(4);
  return host;
};

export const getRealIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  return fwd ? fwd.split(',')[0].trim() : req.ip;
};

// Añadimos esta utilidad que usaba tu index.js original:
export const isSafeHttpUrl = (u) => {
  try { 
    const url = new URL(u); 
    return url.protocol === 'http:' || url.protocol === 'https:'; 
  } catch { 
    return false; 
  }
};