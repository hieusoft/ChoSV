import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { assertDbConnection } from './db';
import { buildRouter } from './routes';
import { startCleanupCron } from './cleanup';
import { openApiSpec } from './swagger';

async function main() {
  await assertDbConnection();
  console.log('Connected to upload_db');

  const app = express();
  app.use(express.json());

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

  app.use('/api/uploads', buildRouter());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'upload' });
  });

  // Cron dọn draft quá hạn (xóa R2 object + row).
  startCleanupCron();

  app.listen(config.port, () => {
    console.log(`Upload Service starting on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start upload service:', err);
  process.exit(1);
});
