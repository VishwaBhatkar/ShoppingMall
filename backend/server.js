const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const app = require('./src/app');
const db = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('  SHOPPING MALL - BACKEND REST API SERVER');
  console.log('----------------------------------------------------');

  // Verify database connection
  await db.testConnection();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Shopping Mall REST API is running on port ${PORT}`);
    console.log(`[Server] Local URL:   http://localhost:${PORT}`);
    console.log(`[Server] Healthcheck: http://localhost:${PORT}/`);
    console.log('----------------------------------------------------');
  });

  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] Process terminated.');
    });
  });
}

bootstrap();
