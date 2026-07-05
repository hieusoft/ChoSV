import type {
  CreateProductInput,
  IProductRepository,
  ProductListFilter,
  UpdateProductFields,
} from '../Interfaces/IProductRepository';
import type { ProductStatus } from '../../Domain/Entities/Product';
import type { IProductImageRepository } from '../Interfaces/IProductImageRepository';
import type { ICategoryRepository } from '../Interfaces/ICategoryRepository';
import type { IUploadClient } from '../Interfaces/IUploadClient';
import type { IEventPublisher } from '../Interfaces/IEventPublisher';
import {
  toProductDto,
  toProductListItemDto,
  type ProductDto,
  type ProductListItemDto,
} from '../DTOs/Product/ProductResponseDto';
import {
  AlreadySoldException,
  CategoryNotFoundException,
  ProductForbiddenException,
  ProductNotFoundException,
} from '../Exceptions/ProductException';

// Ảnh client gửi khi tạo/sửa product.
export interface ImageInput {
  upload_id: string;
  sort_order?: number;
}

export interface CreateProductCommand {
  categoryId: string | null;
  title: string;
  description: string;
  price: number;
  condition: string;
  location: string | null;
  campus: string | null;
  images: ImageInput[];
}

export interface UpdateProductCommand extends UpdateProductFields {
  images?: ImageInput[];
}

export interface ListResult {
  items: ProductListItemDto[];
  page: number;
  limit: number;
  total: number;
}

export class ProductUseCases {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly imageRepository: IProductImageRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly uploadClient: IUploadClient,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  private assertOwner(sellerId: string, userId: string, role: string | null): void {
    if (sellerId !== userId && role !== 'admin') {
      throw new ProductForbiddenException();
    }
  }

  async createAsync(
    sellerId: string,
    cmd: CreateProductCommand,
  ): Promise<ProductDto> {
    if (cmd.categoryId) {
      const category = await this.categoryRepository.findById(cmd.categoryId);
      if (!category) throw new CategoryNotFoundException();
    }

    // 1. Tạo product trước để có product_id (cần cho save ảnh).
    const input: CreateProductInput = {
      sellerId,
      categoryId: cmd.categoryId,
      title: cmd.title,
      description: cmd.description,
      price: cmd.price,
      condition: cmd.condition,
      location: cmd.location,
      campus: cmd.campus,
    };
    const product = await this.productRepository.create(input);

    // 2. Với mỗi ảnh: save(upload_id) ở upload-service (draft->saved) rồi copy metadata.
    //    save() ném nếu ảnh chưa upload / không thuộc user -> bỏ qua ảnh lỗi, không chặn tạo product.
    let sortOrder = 0;
    for (const img of cmd.images) {
      try {
        const meta = await this.uploadClient.save(img.upload_id, sellerId, product.id);
        await this.imageRepository.create({
          productId: product.id,
          uploadId: meta.id,
          objectKey: meta.object_key,
          imageUrl: meta.public_url,
          fileSize: meta.file_size,
          contentType: meta.content_type,
          sortOrder: img.sort_order ?? sortOrder,
        });
        sortOrder++;
      } catch (err) {
        console.warn(`create: skip image ${img.upload_id}: ${(err as Error).message}`);
      }
    }

    // 3. Publish event cho các service khác (moderation/search/notification).
    this.eventPublisher.publishProductCreated({
      productId: product.id,
      sellerId: product.sellerId,
      title: product.title,
      categoryId: product.categoryId,
      price: product.price,
      status: product.status,
    });

    const images = await this.imageRepository.listByProduct(product.id);
    return toProductDto(product, images);
  }

  async getByIdAsync(id: string, incrementView = true): Promise<ProductDto> {
    const product = await this.productRepository.findById(id);
    if (!product) throw new ProductNotFoundException();
    if (incrementView) {
      await this.productRepository.incrementViewCount(id);
    }
    const images = await this.imageRepository.listByProduct(id);
    return toProductDto(product, images);
  }

  async listAsync(filter: ProductListFilter): Promise<ListResult> {
    const { items, total } = await this.productRepository.listActive(filter);
    const listItems = await Promise.all(
      items.map(async (p) => {
        const images = await this.imageRepository.listByProduct(p.id);
        const thumb = images.length > 0 ? images[0].imageUrl : null;
        return toProductListItemDto(p, thumb);
      }),
    );
    return { items: listItems, page: filter.page, limit: filter.limit, total };
  }

  async updateAsync(
    id: string,
    userId: string,
    role: string | null,
    cmd: UpdateProductCommand,
  ): Promise<ProductDto> {
    const product = await this.productRepository.findById(id);
    if (!product) throw new ProductNotFoundException();
    this.assertOwner(product.sellerId, userId, role);

    if (cmd.categoryId) {
      const category = await this.categoryRepository.findById(cmd.categoryId);
      if (!category) throw new CategoryNotFoundException();
    }

    // Cập nhật field text (nếu có).
    const { images, ...fields } = cmd;
    if (Object.keys(fields).length > 0) {
      await this.productRepository.update(id, fields);
    }

    // Diff ảnh nếu client gửi danh sách mới.
    if (images) {
      await this.reconcileImages(id, product.sellerId, images);
    }

    const updated = await this.productRepository.findById(id);
    const imgs = await this.imageRepository.listByProduct(id);
    return toProductDto(updated!, imgs);
  }

  // Đồng bộ ảnh: ảnh mới -> save + insert; ảnh bị bỏ -> unsave + delete.
  private async reconcileImages(
    productId: string,
    sellerId: string,
    desired: ImageInput[],
  ): Promise<void> {
    const current = await this.imageRepository.listByProduct(productId);
    const currentByUpload = new Map(
      current.filter((i) => i.uploadId).map((i) => [i.uploadId as string, i]),
    );
    const desiredUploadIds = new Set(desired.map((d) => d.upload_id));

    // Ảnh bị bỏ: có trong current, không có trong desired -> unsave + delete.
    for (const img of current) {
      if (img.uploadId && !desiredUploadIds.has(img.uploadId)) {
        await this.uploadClient.unsave(img.uploadId, sellerId).catch((err) => {
          console.warn(`unsave ${img.uploadId} failed: ${(err as Error).message}`);
        });
        await this.imageRepository.deleteById(img.id);
      }
    }

    // Ảnh mới: có trong desired, chưa có trong current -> save + insert.
    let sortOrder = 0;
    for (const d of desired) {
      if (!currentByUpload.has(d.upload_id)) {
        try {
          const meta = await this.uploadClient.save(d.upload_id, sellerId, productId);
          await this.imageRepository.create({
            productId,
            uploadId: meta.id,
            objectKey: meta.object_key,
            imageUrl: meta.public_url,
            fileSize: meta.file_size,
            contentType: meta.content_type,
            sortOrder: d.sort_order ?? sortOrder,
          });
        } catch (err) {
          console.warn(`update: skip image ${d.upload_id}: ${(err as Error).message}`);
        }
      }
      sortOrder++;
    }
  }

  async markSoldAsync(id: string, userId: string, role: string | null): Promise<ProductDto> {
    const product = await this.productRepository.findById(id);
    if (!product) throw new ProductNotFoundException();
    this.assertOwner(product.sellerId, userId, role);
    if (product.status === 'sold') throw new AlreadySoldException();

    const updated = await this.productRepository.markSold(id);
    const images = await this.imageRepository.listByProduct(id);
    return toProductDto(updated, images);
  }

  async deleteAsync(id: string, userId: string, role: string | null): Promise<void> {
    const product = await this.productRepository.findById(id);
    if (!product) throw new ProductNotFoundException();
    this.assertOwner(product.sellerId, userId, role);

    // Un-save toàn bộ ảnh -> cron upload-service dọn khỏi R2.
    const images = await this.imageRepository.listByProduct(id);
    for (const img of images) {
      if (img.uploadId) {
        await this.uploadClient.unsave(img.uploadId, product.sellerId).catch((err) => {
          console.warn(`delete: unsave ${img.uploadId} failed: ${(err as Error).message}`);
        });
      }
    }
    await this.productRepository.softDelete(id);
  }

  // ---- Hành động HỆ THỐNG (từ moderation qua queue) ----
  // KHÔNG assertOwner: đây là quyết định kiểm duyệt của hệ thống, không phải user.
  // Idempotent: set status hai lần vẫn cùng kết quả -> queue giao trùng vô hại.
  async applyModerationAsync(productId: string, action: string): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      // Product có thể đã bị xóa mềm trước khi kết quả kiểm duyệt về -> bỏ qua, không lỗi.
      console.warn(`applyModeration: product ${productId} không tồn tại, bỏ qua`);
      return;
    }

    // product-service là chủ sở hữu status -> tự map action của moderation sang status nội bộ.
    const status = ProductUseCases.mapModerationAction(action);
    if (!status) {
      console.warn(`applyModeration: action '${action}' không hợp lệ, bỏ qua`);
      return;
    }

    // Không đụng product đã bán -> tránh moderation trễ ghi đè trạng thái 'sold'.
    if (product.status === 'sold') {
      console.warn(`applyModeration: product ${productId} đã sold, bỏ qua`);
      return;
    }

    await this.productRepository.setStatus(productId, status);
  }

  private static mapModerationAction(action: string): ProductStatus | null {
    switch (action) {
      case 'allow':
      case 'warn':
        return 'active';
      case 'review':
        return 'pending_check';
      case 'hide':
        return 'hidden';
      case 'block':
        return 'blocked';
      default:
        return null;
    }
  }
}
