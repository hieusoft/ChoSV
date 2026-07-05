export type ProductStatus =
  | 'pending_check'
  | 'active'
  | 'sold'
  | 'hidden'
  | 'blocked';

export interface Product {
  id: string;
  sellerId: string;
  categoryId: string | null;
  title: string;
  description: string;
  price: number;
  condition: string;
  status: ProductStatus;
  location: string | null;
  campus: string | null;
  riskScore: number;
  viewCount: number;
  favoriteCount: number;
  soldAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
