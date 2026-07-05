import type { ProductImage } from '../../Domain/Entities/ProductImage';
import type {
  CreateProductImageInput,
  IProductImageRepository,
} from '../../Application/Interfaces/IProductImageRepository';
import { pool } from './DbPool';

interface ImageRow {
  id: string;
  product_id: string;
  upload_id: string | null;
  object_key: string;
  image_url: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  content_type: string | null;
  sort_order: number;
  created_at: Date;
}

const COLUMNS =
  'id, product_id, upload_id, object_key, image_url, width, height, file_size, content_type, sort_order, created_at';

function toEntity(row: ImageRow): ProductImage {
  return {
    id: row.id,
    productId: row.product_id,
    uploadId: row.upload_id,
    objectKey: row.object_key,
    imageUrl: row.image_url,
    width: row.width,
    height: row.height,
    fileSize: row.file_size,
    contentType: row.content_type,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export class ProductImageRepository implements IProductImageRepository {
  async listByProduct(productId: string): Promise<ProductImage[]> {
    const { rows } = await pool.query<ImageRow>(
      `SELECT ${COLUMNS} FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [productId],
    );
    return rows.map(toEntity);
  }

  async create(input: CreateProductImageInput): Promise<ProductImage> {
    const { rows } = await pool.query<ImageRow>(
      `INSERT INTO product_images
         (product_id, upload_id, object_key, image_url, file_size, content_type, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [
        input.productId,
        input.uploadId,
        input.objectKey,
        input.imageUrl,
        input.fileSize,
        input.contentType,
        input.sortOrder,
      ],
    );
    return toEntity(rows[0]);
  }

  async findById(id: string): Promise<ProductImage | null> {
    const { rows } = await pool.query<ImageRow>(
      `SELECT ${COLUMNS} FROM product_images WHERE id = $1`,
      [id],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async deleteById(id: string): Promise<void> {
    await pool.query(`DELETE FROM product_images WHERE id = $1`, [id]);
  }
}
