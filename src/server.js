import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});