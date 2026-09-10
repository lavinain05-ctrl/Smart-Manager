import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { deleteAuthUserByIdentifiers } from './scripts/delete-auth-user.mjs'

function adminAuthPlugin() {
  return {
    name: 'admin-auth-dev-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url?.startsWith('/api/admin/delete-auth-user')) {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const result = await deleteAuthUserByIdentifiers(data);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err) {
              console.error('[AdminAuth Bridge Error]:', err.message);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), adminAuthPlugin()],
})