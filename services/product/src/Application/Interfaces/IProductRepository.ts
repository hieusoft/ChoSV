import type { Product, ProductStatus } from '../../Domain/Entities/Product';

export interface ProductListFilter {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  campus?: string;
  sort: 'newest' | 'price_asc' | 'price_desc';
  page: number;
  limit: number;
}

export interface CreateProductInput {
  sellerId: string;
  categoryId: string | null;
  title: string;
  description: string;
  price: number;
  condition: string;
  location: string | null;
  campus: string | null;
}

export interface UpdateProductFields {
  categoryId?: string | null;
  title?: string;
  description?: string;
  price?: number;
  condition?: string;
  location?: string | null;
  campus?: string | null;
}

export interface IProductRepository {
  // Chỉ trả sản phẩm chưa xóa mềm.
  findById(id: string): Promise<Product | null>;
  // Danh sách public: chỉ status='active', chưa xóa. Trả kèm tổng số để phân trang.
  listActive(filter: ProductListFilter): Promise<{ items: Product[]; total: number }>;
  create(input: CreateProductInput): Promise<Product>;
  update(id: string, fields: UpdateProductFields): Promise<Product>;
  setStatus(id: string, status: ProductStatus): Promise<Product>;
  markSold(id: string): Promise<Product>;
  softDelete(id: string): Promise<void>;
  incrementViewCount(id: string): Promise<void>;
}
