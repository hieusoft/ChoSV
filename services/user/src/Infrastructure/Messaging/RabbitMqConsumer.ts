import amqp, { type Channel, type ChannelModel } from 'amqplib';
import type { UserUseCases } from '../../Application/UseCases/UserUseCases';

const EXCHANGE = 'hieusoft.events';
const QUEUE = 'user.user_registered_q';
const ROUTING_KEY = 'user.registered';

interface UserRegisteredEvent {
  event: string;
  user_id: string;
  email: string;
  full_name: string;
}

export class RabbitMqConsumer {
  private channel: Channel | null = null;
  private connection: ChannelModel | null = null;

  constructor(
    private readonly url: string,
    private readonly userUseCases: UserUseCases,
  ) {}

  async start(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    await this.channel.assertQueue(QUEUE, { durable: true });
    await this.channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

    await this.channel.consume(QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as UserRegisteredEvent;
        await this.userUseCases.provisionProfileAsync(payload.user_id, payload.full_name);
        this.channel!.ack(msg);
      } catch (err) {
        console.error('Failed to handle user.registered event:', err);
        // Không requeue để tránh loop vô hạn khi payload lỗi.
        this.channel!.nack(msg, false, false);
      }
    });

    console.log(`Consuming ${QUEUE} (binding: ${ROUTING_KEY})`);
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }
}
