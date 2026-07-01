import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export const config = {
  port: parseInt(process.env.CHAT_PORT || '3005', 10),
  databaseUrl: process.env.CHAT_DATABASE_URL || 'postgresql://hieusoft:hieusoft123@localhost:5432/chat_db',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://hieusoft:hieusoft123@localhost:5672',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003',
};
