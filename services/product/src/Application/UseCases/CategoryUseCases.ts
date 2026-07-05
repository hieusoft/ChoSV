import type { ICategoryRepository } from '../Interfaces/ICategoryRepository';
import { toCategoryDto, type CategoryDto } from '../DTOs/Category/CategoryResponseDto';

export class CategoryUseCases {
  private readonly _categoryRepository: ICategoryRepository;

  constructor(categoryRepository: ICategoryRepository) {
    this._categoryRepository = categoryRepository;
  }

  async listActiveAsync(): Promise<CategoryDto[]> {
    const categories = await this._categoryRepository.listActive();
    return categories.map(toCategoryDto);
  }
}
