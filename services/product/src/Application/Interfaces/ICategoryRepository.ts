import type { Category } from '../../Domain/Entities/Category';

export interface ICategoryRepository {
  listActive(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
}
