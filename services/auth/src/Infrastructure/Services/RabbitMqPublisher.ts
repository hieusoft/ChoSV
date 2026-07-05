import amqp, { type Channel, type ChannelModel } from 'amqplib';
import type { IEventPublisher } from '../../Application/Interfaces/IEventPublisher';

const EXCHANGE = 'hieusoft.events';

// Declare sẵn queue + bind lúc khởi động để message không bị drop khi
// consumer (notification-service) chưa chạy. queue durable -> giữ message.
const QUEUE_BINDINGS: { queue: string; routingKey: string }[] = [
  { queue: 'notification.user_registered_q', routingKey: 'user.registered' },
  { queue: 'notification.email_verification_requested_q', routingKey: 'email.verification_requested' },
  { queue: 'notification.email_verified_q', routingKey: 'email.verified' },
  { queue: 'notification.password_reset_requested_q', routingKey: 'password.reset_requested' },
  { queue: 'notification.password_reset_completed_q', routingKey: 'password.reset_completed' },
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

  publishUserRegistered(userId: string, email: string, fullName: string): void {
    this.publish('user.registered', {
      event: 'UserRegistered',
      user_id: userId,
      email,
      full_name: fullName,
      timestamp: new Date().toISOString(),
    });
  }

  publishEmailVerificationRequested(userId: string, email: string, token: string): void {
    this.publish('email.verification_requested', {
      event: 'EmailVerificationRequested',
      user_id: userId,
      email,
      token,
      timestamp: new Date().toISOString(),
    });
  }

  publishEmailVerified(userId: string, email: string): void {
    this.publish('email.verified', {
      event: 'EmailVerified',
      user_id: userId,
      email,
      timestamp: new Date().toISOString(),
    });
  }

  publishPasswordResetRequested(userId: string, email: string, token: string): void {
    this.publish('password.reset_requested', {
      event: 'PasswordResetRequested',
      user_id: userId,
      email,
      token,
      timestamp: new Date().toISOString(),
    });
  }

  publishPasswordResetCompleted(userId: string, email: string): void {
    this.publish('password.reset_completed', {
      event: 'PasswordResetCompleted',
      user_id: userId,
      email,
      timestamp: new Date().toISOString(),
    });
  }
}
