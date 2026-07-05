import { type Request, type Response } from 'express';
import type { CategoryUseCases } from '../../Application/UseCases/CategoryUseCases';
import { handleError, ok } from '../Responses/ApiResponse';

export class CategoryController {
  constructor(private readonly categoryUseCases: CategoryUseCases) {}

  // GET /api/categories — public
  list = async (_req: Request, res: Response) => {
    try {
      const categories = await this.categoryUseCases.listActiveAsync();
      ok(res, { categories });
    } catch (err) {
      handleError(res, err);
    }
  };
}
