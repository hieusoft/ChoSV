import type { Product, ProductStatus } from '../../Domain/Entities/Product';
import type { IFavoriteRepository } from '../../Application/Interfaces/IFavoriteRepository';
import { pool } from './DbPool';

interface ProductRow {
  id: string;
  seller_id: string;
  category_id: string | null;
  title: string;
  description: string;
  price: string;
  condition: string;
  status: string;
  location: string | null;
  campus: string | null;
  risk_score: number;
  view_count: number;
  favorite_count: number;
  sold_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sellerId: row.seller_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    condition: row.condition,
    status: row.status as ProductStatus,
    location: row.location,
    campus: row.campus,
    riskScore: row.risk_score,
    viewCount: row.view_count,
    favoriteCount: row.favorite_count,
    soldAt: row.sold_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class FavoriteRepository implements IFavoriteRepository {
  async add(userId: string, productId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // ON CONFLICT: nếu đã tồn tại thì không tăng count (giữ count đúng khi gọi trùng).
      const res = await client.query(
        `INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, productId],
      );
      if ((res.rowCount ?? 0) > 0) {
        await client.query(
          `UPDATE products SET favorite_count = favorite_count + 1 WHERE id = $1`,
          [productId],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async remove(userId: string, productId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `DELETE FROM favorites WHERE user_id = $1 AND product_id = $2`,
        [userId, productId],
      );
      if ((res.rowCount ?? 0) > 0) {
        // GREATEST tránh count âm.
        await client.query(
          `UPDATE products SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = $1`,
          [productId],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async exists(userId: string, productId: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM favorites WHERE user_id = $1 AND product_id = $2`,
      [userId, productId],
    );
    return rows.length > 0;
  }

  async listProductsByUser(userId: string): Promise<Product[]> {
    // Chỉ product còn hiển thị (chưa xóa mềm).
    const { rows } = await pool.query<ProductRow>(
      `SELECT p.id, p.seller_id, p.category_id, p.title, p.description, p.price, p.condition,
              p.status, p.location, p.campus, p.risk_score, p.view_count, p.favorite_count,
              p.sold_at, p.created_at, p.updated_at, p.deleted_at
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       WHERE f.user_id = $1 AND p.deleted_at IS NULL
       ORDER BY f.created_at DESC`,
      [userId],
    );
    return rows.map(toProduct);
  }
}
