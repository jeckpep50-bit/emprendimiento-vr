import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS es obligatorio para WebXR fuera de localhost: las gafas abren
// https://<IP-del-PC>:5173 y aceptan el certificado de desarrollo.
// Para probar solo en el PC (http://localhost) usa `npm run dev:local`.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'serve' && process.env.SIN_HTTPS !== '1' ? [basicSsl()] : [],
  server: { host: true, port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
}));
