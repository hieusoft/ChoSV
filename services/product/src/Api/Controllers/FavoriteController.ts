import { type Request, type Response } from 'express';
import type { FavoriteUseCases } from '../../Application/UseCases/FavoriteUseCases';
import { fail, handleError, ok } from '../Responses/ApiResponse';

export class FavoriteController {
  constructor(private readonly favoriteUseCases: FavoriteUseCases) {}

  // POST /api/products/:id/favorite — cần JWT
  add = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    try {
      await this.favoriteUseCases.addAsync(userId, req.params.id);
      ok(res, { favorited: true });
    } catch (err) {
      handleError(res, err);
    }
  };

  // DELETE /api/products/:id/favorite — cần JWT
  remove = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    try {
      await this.favoriteUseCases.removeAsync(userId, req.params.id);
      ok(res, { favorited: false });
    } catch (err) {
      handleError(res, err);
    }
  };

  // GET /api/me/favorites — cần JWT
  listMine = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    try {
      const items = await this.favoriteUseCases.listMineAsync(userId);
      ok(res, { items });
    } catch (err) {
      handleError(res, err);
    }
  };
}
