import express, { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './Infrastructure/Config/Config';
import { assertDbConnection } from './Infrastructure/Database/DbPool';
import { ProductRepository } from './Infrastructure/Database/ProductRepository';
import { ProductImageRepository } from './Infrastructure/Database/ProductImageRepository';
import { CategoryRepository } from './Infrastructure/Database/CategoryRepository';
import { FavoriteRepository } from './Infrastructure/Database/FavoriteRepository';
import { UploadClient } from './Infrastructure/Services/UploadClient';
import { RabbitMqPublisher } from './Infrastructure/Services/RabbitMqPublisher';
import { ModerationConsumer } from './Infrastructure/Services/ModerationConsumer';
import { ProductUseCases } from './Application/UseCases/ProductUseCases';
import { CategoryUseCases } from './Application/UseCases/CategoryUseCases';
import { FavoriteUseCases } from './Application/UseCases/FavoriteUseCases';
import { ProductController } from './Api/Controllers/ProductController';
import { CategoryController } from './Api/Controllers/CategoryController';
import { FavoriteController } from './Api/Controllers/FavoriteController';
import { buildProductRouter, buildMeRouter } from './Api/Routes/ProductRoutes';
import { openApiSpec } from './Api/Swagger/OpenApiSpec';

async function main() {
  await assertDbConnection();
  console.log('Connected to product_db');

  // Infrastructure
  const productRepository = new ProductRepository();
  const imageRepository = new ProductImageRepository();
  const categoryRepository = new CategoryRepository();
  const favoriteRepository = new FavoriteRepository();
  const uploadClient = new UploadClient(config.uploadServiceUrl);
  const eventPublisher = new RabbitMqPublisher(config.rabbitmqUrl);

  try {
    await eventPublisher.connect();
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.warn('RabbitMQ connect failed — events will be dropped:', (err as Error).message);
  }

  // Application
  const productUseCases = new ProductUseCases(
    productRepository,
    imageRepository,
    categoryRepository,
    uploadClient,
    eventPublisher,
  );
  const categoryUseCases = new CategoryUseCases(categoryRepository);
  const favoriteUseCases = new FavoriteUseCases(
    favoriteRepository,
    productRepository,
    imageRepository,
  );

  // Nghe kết quả kiểm duyệt (product.moderated) -> tự update status. Lỗi RabbitMQ
  // không chặn service khởi động; consumer sẽ thiếu nhưng API vẫn chạy.
  const moderationConsumer = new ModerationConsumer(config.rabbitmqUrl, productUseCases);
  try {
    await moderationConsumer.start();
  } catch (err) {
    console.warn('ModerationConsumer start failed:', (err as Error).message);
  }

  // Api
  const productController = new ProductController(productUseCases);
  const categoryController = new CategoryController(categoryUseCases);
  const favoriteController = new FavoriteController(favoriteUseCases);

  const app = express();
  app.use(express.json());

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

  app.use('/api/products', buildProductRouter(productController, favoriteController));
  app.use('/api/me', buildMeRouter(favoriteController));

  const categoryRouter = Router();
  categoryRouter.get('/', categoryController.list);
  app.use('/api/categories', categoryRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'product' });
  });

  app.listen(config.port, () => {
    console.log(`Product Service starting on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start product service:', err);
  process.exit(1);
});
