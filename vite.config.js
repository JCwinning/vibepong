import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'save-game-data',
      configureServer(server) {
        server.middlewares.use('/api/save-csv', async (req, res, next) => {
          if (req.method === 'POST') {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const data = JSON.parse(Buffer.concat(buffers).toString());
            const { filename, content } = data;

            // Ensure directory exists
            const fs = await import('fs');
            const path = await import('path');
            const dir = path.resolve('game_data');
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            // Write file
            const filePath = path.join(dir, filename);
            fs.writeFileSync(filePath, content);

            console.log(`Saved file: ${filePath}`);

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } else {
            next();
          }
        });
      },
    },
  ],
})
