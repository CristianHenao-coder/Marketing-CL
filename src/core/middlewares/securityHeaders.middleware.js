
export const securityHeaders = (req, res, next) => {
  // Evita que otros sitios pongan tu web en un <iframe> (protección contra Clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');
  // Protege contra ataques de inyección de contenido
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Habilita el filtro de XSS del navegador
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};