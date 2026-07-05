import type { Product, ProductStatus } from '../../Domain/Entities/Product';
import type {
  CreateProductInput,
  IProductRepository,
  ProductListFilter,
  UpdateProductFields,
} from '../../Application/Interfaces/IProductRepository';
import { pool } from './DbPool';

interface ProductRow {
  id: string;
  seller_id: string;
  category_id: string | null;
  title: string;
  description: string;
  price: string; // NUMERIC trả về string trong pg
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

const COLUMNS =
  'id, seller_id, category_id, title, description, price, condition, status, location, campus, risk_score, view_count, favorite_count, sold_at, created_at, updated_at, deleted_at';

function toEntity(row: ProductRow): Product {
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

export class ProductRepository implements IProductRepository {
  async findById(id: string): Promise<Product | null> {
    const { rows } = await pool.query<ProductRow>(
      `SELECT ${COLUMNS} FROM products WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async listActive(
    filter: ProductListFilter,
  ): Promise<{ items: Product[]; total: number }> {
    // Build WHERE động, chỉ trả sản phẩm active + chưa xóa.
    const conds: string[] = [`status = 'active'`, `deleted_at IS NULL`];
    const values: unknown[] = [];
    let i = 1;
    if (filter.categoryId) {
      conds.push(`category_id = $${i++}`);
      values.push(filter.categoryId);
    }
    if (filter.minPrice !== undefined) {
      conds.push(`price >= $${i++}`);
      values.push(filter.minPrice);
    }
    if (filter.maxPrice !== undefined) {
      conds.push(`price <= $${i++}`);
      values.push(filter.maxPrice);
    }
    if (filter.condition) {
      conds.push(`condition = $${i++}`);
      values.push(filter.condition);
    }
    if (filter.campus) {
      conds.push(`campus = $${i++}`);
      values.push(filter.campus);
    }
    const where = conds.join(' AND ');

    const orderBy =
      filter.sort === 'price_asc'
        ? 'price ASC'
        : filter.sort === 'price_desc'
          ? 'price DESC'
          : 'created_at DESC';

    // Tổng số cho phân trang.
    const countRes = await pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM products WHERE ${where}`,
      values,
    );
    const total = Number(countRes.rows[0].count);

    const offset = (filter.page - 1) * filter.limit;
    const { rows } = await pool.query<ProductRow>(
      `SELECT ${COLUMNS} FROM products WHERE ${where}
       ORDER BY ${orderBy} LIMIT $${i++} OFFSET $${i++}`,
      [...values, filter.limit, offset],
    );
    return { items: rows.map(toEntity), total };
  }

  async create(input: CreateProductInput): Promise<Product> {
    const { rows } = await pool.query<ProductRow>(
      `INSERT INTO products
         (seller_id, category_id, title, description, price, condition, location, campus)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUMNS}`,
      [
        input.sellerId,
        input.categoryId,
        input.title,
        input.description,
        input.price,
        input.condition,
        input.location,
        input.campus,
      ],
    );
    return toEntity(rows[0]);
  }

  async update(id: string, fields: UpdateProductFields): Promise<Product> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const map: Record<keyof UpdateProductFields, string> = {
      categoryId: 'category_id',
      title: 'title',
      description: 'description',
      price: 'price',
      condition: 'condition',
      location: 'location',
      campus: 'campus',
    };
    for (const key of Object.keys(map) as (keyof UpdateProductFields)[]) {
      if (fields[key] !== undefined) {
        sets.push(`${map[key]} = $${i++}`);
        values.push(fields[key]);
      }
    }
    if (sets.length === 0) {
      return (await this.findById(id))!;
    }
    sets.push(`updated_at = now()`);
    values.push(id);
    const { rows } = await pool.query<ProductRow>(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${COLUMNS}`,
      values,
    );
    return toEntity(rows[0]);
  }

  async setStatus(id: string, status: ProductStatus): Promise<Product> {
    const { rows } = await pool.query<ProductRow>(
      `UPDATE products SET status = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, status],
    );
    return toEntity(rows[0]);
  }

  async markSold(id: string): Promise<Product> {
    const { rows } = await pool.query<ProductRow>(
      `UPDATE products SET status = 'sold', sold_at = now(), updated_at = now()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id],
    );
    return toEntity(rows[0]);
  }

  async softDelete(id: string): Promise<void> {
    await pool.query(`UPDATE products SET deleted_at = now() WHERE id = $1`, [id]);
  }

  async incrementViewCount(id: string): Promise<void> {
    await pool.query(`UPDATE products SET view_count = view_count + 1 WHERE id = $1`, [id]);
  }
}
