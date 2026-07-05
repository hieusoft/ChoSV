import type { Category } from '../../../Domain/Entities/Category';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  icon_url: string | null;
  sort_order: number;
}

export function toCategoryDto(c: Category): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    parent_id: c.parentId,
    icon_url: c.iconUrl,
    sort_order: c.sortOrder,
  };
}
