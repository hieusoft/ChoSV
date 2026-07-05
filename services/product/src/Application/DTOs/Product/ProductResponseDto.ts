import type { Product } from '../../../Domain/Entities/Product';
import type { ProductImage } from '../../../Domain/Entities/ProductImage';

export interface ProductImageDto {
  id: string;
  image_url: string;
  object_key: string;
  sort_order: number;
}

export interface ProductDto {
  id: string;
  seller_id: string;
  category_id: string | null;
  title: string;
  description: string;
  price: number;
  condition: string;
  status: string;
  location: string | null;
  campus: string | null;
  view_count: number;
  favorite_count: number;
  images: ProductImageDto[];
  sold_at: string | null;
  created_at: string;
  updated_at: string;
}

// Item rút gọn cho danh sách (chỉ ảnh đầu làm thumbnail).
export interface ProductListItemDto {
  id: string;
  seller_id: string;
  category_id: string | null;
  title: string;
  price: number;
  condition: string;
  status: string;
  campus: string | null;
  thumbnail_url: string | null;
  favorite_count: number;
  created_at: string;
}

function toImageDto(img: ProductImage): ProductImageDto {
  return {
    id: img.id,
    image_url: img.imageUrl,
    object_key: img.objectKey,
    sort_order: img.sortOrder,
  };
}

export function toProductDto(p: Product, images: ProductImage[]): ProductDto {
  return {
    id: p.id,
    seller_id: p.sellerId,
    category_id: p.categoryId,
    title: p.title,
    description: p.description,
    price: p.price,
    condition: p.condition,
    status: p.status,
    location: p.location,
    campus: p.campus,
    view_count: p.viewCount,
    favorite_count: p.favoriteCount,
    images: images.map(toImageDto),
    sold_at: p.soldAt ? p.soldAt.toISOString() : null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export function toProductListItemDto(p: Product, thumbnailUrl: string | null): ProductListItemDto {
  return {
    id: p.id,
    seller_id: p.sellerId,
    category_id: p.categoryId,
    title: p.title,
    price: p.price,
    condition: p.condition,
    status: p.status,
    campus: p.campus,
    thumbnail_url: thumbnailUrl,
    favorite_count: p.favoriteCount,
    created_at: p.createdAt.toISOString(),
  };
}
