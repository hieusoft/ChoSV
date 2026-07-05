import amqp, { type Channel, type ChannelModel } from 'amqplib';
import type { ProductUseCases } from '../../Application/UseCases/ProductUseCases';

const EXCHANGE = 'hieusoft.events';
const QUEUE = 'product.product_moderated_q';
const ROUTING_KEY = 'product.moderated';

// Nghe kết quả kiểm duyệt từ moderation-service rồi tự cập nhật status product.
// Gọi THẲNG use case (function call nội bộ) — không HTTP, không JWT, là hành động hệ thống.
export class ModerationConsumer {
  private channel: Channel | null = null;
  private connection: ChannelModel | null = null;

  constructor(
    private readonly url: string,
    private readonly productUseCases: ProductUseCases,
  ) {}

  async start(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    // Queue durable -> message không mất khi consumer offline.
    await this.channel.assertQueue(QUEUE, { durable: true });
    await this.channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    // Xử lý tuần tự, chỉ nhận message mới sau khi ack cái trước.
    await this.channel.prefetch(1);

    await this.channel.consume(QUEUE, (msg) => {
      if (!msg) return;
      void this.handle(msg.content)
        .then(() => this.channel?.ack(msg))
        .catch((err) => {
          // Lỗi không mong đợi (vd DB down): nack, KHÔNG requeue để tránh loop vô hạn.
          // Message rớt vào dead-letter/log; kiểm duyệt có thể phát lại sau.
          console.error(`ModerationConsumer: xử lý thất bại: ${(err as Error).message}`);
          this.channel?.nack(msg, false, false);
        });
    });

    console.log(`ModerationConsumer listening on ${QUEUE}`);
  }

  private async handle(content: Buffer): Promise<void> {
    let payload: { product_id?: string; action?: string };
    try {
      payload = JSON.parse(content.toString());
    } catch {
      console.warn('ModerationConsumer: message không phải JSON hợp lệ, bỏ qua');
      return; // ack để loại message hỏng, không requeue
    }

    const { product_id: productId, action } = payload;
    if (!productId || !action) {
      console.warn('ModerationConsumer: thiếu product_id/action, bỏ qua');
      return;
    }

    await this.productUseCases.applyModerationAsync(productId, action);
    console.log(`ModerationConsumer: product ${productId} -> action '${action}' applied`);
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }
}
