// Servidor de desarrollo sin HTTPS (solo para probar en el navegador del PC en localhost).
import { createServer } from 'vite';

process.env.SIN_HTTPS = '1';
const servidor = await createServer({ server: { host: 'localhost', port: 5174 } });
await servidor.listen();
servidor.printUrls();
