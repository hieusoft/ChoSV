import type { IFavoriteRepository } from '../Interfaces/IFavoriteRepository';
import type { IProductRepository } from '../Interfaces/IProductRepository';
import {
  toProductListItemDto,
  type ProductListItemDto,
} from '../DTOs/Product/ProductResponseDto';
import type { IProductImageRepository } from '../Interfaces/IProductImageRepository';
import { ProductNotFoundException } from '../Exceptions/ProductException';

export class FavoriteUseCases {
  constructor(
    private readonly favoriteRepository: IFavoriteRepository,
    private readonly productRepository: IProductRepository,
    private readonly imageRepository: IProductImageRepository,
  ) {}

  async addAsync(userId: string, productId: string): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }
    // Idempotent: đã yêu thích rồi thì bỏ qua (unique constraint bảo vệ ở DB).
    if (await this.favoriteRepository.exists(userId, productId)) {
      return;
    }
    await this.favoriteRepository.add(userId, productId);
  }

  async removeAsync(userId: string, productId: string): Promise<void> {
    if (!(await this.favoriteRepository.exists(userId, productId))) {
      return;
    }
    await this.favoriteRepository.remove(userId, productId);
  }

  async listMineAsync(userId: string): Promise<ProductListItemDto[]> {
    const products = await this.favoriteRepository.listProductsByUser(userId);
    const items = await Promise.all(
      products.map(async (p) => {
        const images = await this.imageRepository.listByProduct(p.id);
        const thumb = images.length > 0 ? images[0].imageUrl : null;
        return toProductListItemDto(p, thumb);
      }),
    );
    return items;
  }
}
