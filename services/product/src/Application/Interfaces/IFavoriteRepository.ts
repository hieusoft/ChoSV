import type { Product } from '../../Domain/Entities/Product';

export interface IFavoriteRepository {
  add(userId: string, productId: string): Promise<void>;
  remove(userId: string, productId: string): Promise<void>;
  exists(userId: string, productId: string): Promise<boolean>;
  // Danh sách product user đã yêu thích (chỉ product còn active/chưa xóa).
  listProductsByUser(userId: string): Promise<Product[]>;
}
