import type { Category } from '../../Domain/Entities/Category';
import type { ICategoryRepository } from '../../Application/Interfaces/ICategoryRepository';
import { pool } from './DbPool';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS =
  'id, name, slug, description, parent_id, icon_url, sort_order, is_active, created_at, updated_at';

function toEntity(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parent_id,
    iconUrl: row.icon_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CategoryRepository implements ICategoryRepository {
  async listActive(): Promise<Category[]> {
    const { rows } = await pool.query<CategoryRow>(
      `SELECT ${COLUMNS} FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`,
    );
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<Category | null> {
    const { rows } = await pool.query<CategoryRow>(
      `SELECT ${COLUMNS} FROM categories WHERE id = $1`,
      [id],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }
}
