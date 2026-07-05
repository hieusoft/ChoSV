import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './Infrastructure/Config/Config';
import { assertDbConnection } from './Infrastructure/Database/DbPool';
import { UserRepository } from './Infrastructure/Database/UserRepository';
import { SessionRepository } from './Infrastructure/Database/SessionRepository';
import { EmailVerificationRepository } from './Infrastructure/Database/EmailVerificationRepository';
import { PasswordResetRepository } from './Infrastructure/Database/PasswordResetRepository';
import { PasswordHasher } from './Infrastructure/Security/PasswordHasher';
import { JwtService } from './Infrastructure/Security/JwtService';
import { TotpService } from './Infrastructure/Security/TotpService';
import { RabbitMqPublisher } from './Infrastructure/Services/RabbitMqPublisher';
import { AuthUseCases } from './Application/UseCases/AuthUseCases';
import { AuthController } from './Api/Controllers/AuthController';
import { buildAuthRouter } from './Api/Routes/AuthRoutes';
import { openApiSpec } from './Api/Swagger/OpenApiSpec';

async function main() {
  await assertDbConnection();
  console.log('Connected to auth_db');

  // DI wiring (kiểu Program.cs)
  const userRepository = new UserRepository();
  const sessionRepository = new SessionRepository();
  const emailVerificationRepository = new EmailVerificationRepository();
  const passwordResetRepository = new PasswordResetRepository();
  const passwordHasher = new PasswordHasher();
  const jwtService = new JwtService({
    secret: config.jwt.secret,
    issuer: config.jwt.issuer,
    accessExpiry: config.jwt.accessExpiry,
  });
  const totpService = new TotpService(config.totpIssuer);
  const eventPublisher = new RabbitMqPublisher(config.rabbitmqUrl);

  try {
    await eventPublisher.connect();
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.warn(`WARNING: RabbitMQ not available — events disabled: ${(err as Error).message}`);
  }

  const authUseCases = new AuthUseCases(
    userRepository,
    sessionRepository,
    passwordHasher,
    jwtService,
    totpService,
    emailVerificationRepository,
    passwordResetRepository,
    eventPublisher,
    {
      refreshExpiryDays: config.jwt.refreshExpiryDays,
      emailVerificationExpiryHours: config.emailVerificationExpiryHours,
      passwordResetExpiryHours: config.passwordResetExpiryHours,
    },
  );
  const authController = new AuthController(authUseCases);

  const app = express();
  app.use(express.json());

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

  app.use('/api/auth', buildAuthRouter(authController));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'auth' });
  });

  app.listen(config.port, () => {
    console.log(`Auth Service starting on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start auth service:', err);
  process.exit(1);
});
