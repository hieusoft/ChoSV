import { Router } from 'express';
import type { ProductController } from '../Controllers/ProductController';
import type { FavoriteController } from '../Controllers/FavoriteController';

export function buildProductRouter(
  product: ProductController,
  favorite: FavoriteController,
): Router {
  const router = Router();

  // public
  router.get('/', product.list);
  router.get('/:id', product.getById);

  // protected (Kong gắn X-User-Id)
  router.post('/', product.create);
  router.patch('/:id', product.update);
  router.delete('/:id', product.remove);
  router.post('/:id/mark-sold', product.markSold);
  router.post('/:id/favorite', favorite.add);
  router.delete('/:id/favorite', favorite.remove);

  return router;
}

// GET /api/me/favorites mount riêng (khác prefix /api/products)
export function buildMeRouter(favorite: FavoriteController): Router {
  const router = Router();
  router.get('/favorites', favorite.listMine);
  return router;
}
