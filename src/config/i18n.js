import i18n from 'i18n';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

i18n.configure({
  // Idiomas soportados (puedes agregar 'fr', 'pt', etc.)
  locales: ['en', 'es'],

  // Idioma por defecto si el navegador del usuario tiene un idioma raro
  defaultLocale: 'en',

  // Dónde guardar los archivos JSON de traducción
  directory: path.join(__dirname, '../locales'),

  // Cookie para guardar preferencia (opcional, pero útil si alguna vez quieres forzarlo)
  cookie: 'lang',

  // Detectar automáticamente según headers del navegador
  autoReload: true,
  updateFiles: false, // En producción poner false
  objectNotation: true // Permite usar 'gate.title'
});

export default i18n;