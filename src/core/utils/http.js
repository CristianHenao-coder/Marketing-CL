export const normalizeHost = (rawHostHeader = '') => {
  let host = String(rawHostHeader || '').toLowerCase().split(':')[0].trim();
  if (host.startsWith('www.')) host = host.slice(4);
  return host;
};

export const getRealIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  return fwd ? fwd.split(',')[0].trim() : req.ip;
};

export const isSafeHttpUrl = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Necesaria para validar dominios personalizados en el admin y en el ruteo
export const isValidDomain = (host) => {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(host || '').trim());
};

// Genera la URL pública dependiendo del modo (Landing o Instrucciones)
export const computePublicUrl = (slug, mode, customDomain, baseUrl) => {
  if (customDomain && isValidDomain(customDomain)) {
    return `https://${customDomain}`;
  }
  const base = baseUrl.replace(/\/+$/, '');
  if (mode === 'instructions') return `${base}/instructions/${slug}`;
  return `${base}/searchEngine/${slug}`;
};

// Pequeño delay para simular carga natural y despistar bots
export const delay = (ms) => new Promise(res => setTimeout(res, ms));