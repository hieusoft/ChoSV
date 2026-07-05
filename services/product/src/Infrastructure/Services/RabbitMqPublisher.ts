import amqp, { type Channel, type ChannelModel } from 'amqplib';
import type {
  IEventPublisher,
  ProductCreatedEvent,
} from '../../Application/Interfaces/IEventPublisher';

const EXCHANGE = 'hieusoft.events';

// Declare sẵn queue + bind để message không bị drop khi consumer
// (moderation/search) chưa chạy. queue durable -> giữ message.
const QUEUE_BINDINGS: { queue: string; routingKey: string }[] = [
  { queue: 'moderation.product_created_q', routingKey: 'product.created' },
  { queue: 'search.product_created_q', routingKey: 'product.created' },
];

export class RabbitMqPublisher implements IEventPublisher {
  private channel: Channel | null = null;
  private connection: ChannelModel | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    for (const { queue, routingKey } of QUEUE_BINDINGS) {
      await this.channel.assertQueue(queue, { durable: true });
      await this.channel.bindQueue(queue, EXCHANGE, routingKey);
    }
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }

  private publish(routingKey: string, payload: Record<string, unknown>): void {
    if (!this.channel) {
      console.warn(`RabbitMQ not connected — dropping event ${routingKey}`);
      return;
    }
    this.channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      timestamp: Date.now(),
    });
  }

  publishProductCreated(event: ProductCreatedEvent): void {
    this.publish('product.created', {
      event: 'ProductCreated',
      product_id: event.productId,
      seller_id: event.sellerId,
      title: event.title,
      category_id: event.categoryId,
      price: event.price,
      status: event.status,
      timestamp: new Date().toISOString(),
    });
  }
}
