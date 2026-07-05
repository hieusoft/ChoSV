import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './Infrastructure/Config/Config';
import { assertDbConnection } from './Infrastructure/Database/DbPool';
import { ProfileRepository } from './Infrastructure/Database/ProfileRepository';
import { RabbitMqConsumer } from './Infrastructure/Messaging/RabbitMqConsumer';
import { UserUseCases } from './Application/UseCases/UserUseCases';
import { UserController } from './Api/Controllers/UserController';
import { buildUserRouter } from './Api/Routes/UserRoutes';
import { openApiSpec } from './Api/Swagger/OpenApiSpec';

async function main() {
  await assertDbConnection();
  console.log('Connected to user_db');

  // DI wiring (kiểu Program.cs)
  const profileRepository = new ProfileRepository();
  const userUseCases = new UserUseCases(profileRepository);
  const userController = new UserController(userUseCases);

  // Consumer: nghe user.registered từ auth-service -> tạo profile
  const consumer = new RabbitMqConsumer(config.rabbitmqUrl, userUseCases);
  try {
    await consumer.start();
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.warn(`WARNING: RabbitMQ not available — profile provisioning disabled: ${(err as Error).message}`);
  }

  const app = express();
  app.use(express.json());

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

  app.use('/api/users', buildUserRouter(userController));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'user' });
  });

  app.listen(config.port, () => {
    console.log(`User Service starting on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start user service:', err);
  process.exit(1);
});
