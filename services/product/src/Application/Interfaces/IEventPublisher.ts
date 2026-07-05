export interface ProductCreatedEvent {
  productId: string;
  sellerId: string;
  title: string;
  categoryId: string | null;
  price: number;
  status: string;
}

export interface IEventPublisher {
  publishProductCreated(event: ProductCreatedEvent): void;
}
