import type { ProductImage } from '../../Domain/Entities/ProductImage';

export interface CreateProductImageInput {
  productId: string;
  uploadId: string | null;
  objectKey: string;
  imageUrl: string;
  fileSize: number | null;
  contentType: string | null;
  sortOrder: number;
}

export interface IProductImageRepository {
  listByProduct(productId: string): Promise<ProductImage[]>;
  create(input: CreateProductImageInput): Promise<ProductImage>;
  findById(id: string): Promise<ProductImage | null>;
  deleteById(id: string): Promise<void>;
}
