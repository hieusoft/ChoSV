import { type Request, type Response } from 'express';
import type { ProductUseCases } from '../../Application/UseCases/ProductUseCases';
import {
  createProductSchema,
  listProductSchema,
  updateProductSchema,
} from '../../Application/Validators/ProductValidators';
import { fail, handleError, ok } from '../Responses/ApiResponse';

export class ProductController {
  constructor(private readonly productUseCases: ProductUseCases) {}

  // GET /api/products — public, có phân trang + filter
  list = async (req: Request, res: Response) => {
    const parsed = listProductSchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const q = parsed.data;
    try {
      const result = await this.productUseCases.listAsync({
        page: q.page,
        limit: q.limit,
        categoryId: q.category_id,
        minPrice: q.min_price,
        maxPrice: q.max_price,
        condition: q.condition,
        campus: q.campus,
        sort: q.sort,
      });
      ok(res, result);
    } catch (err) {
      handleError(res, err);
    }
  };

  // GET /api/products/:id — public
  getById = async (req: Request, res: Response) => {
    try {
      const product = await this.productUseCases.getByIdAsync(req.params.id);
      ok(res, { product });
    } catch (err) {
      handleError(res, err);
    }
  };

  // POST /api/products — cần JWT
  create = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');

    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const b = parsed.data;
    try {
      const product = await this.productUseCases.createAsync(userId, {
        categoryId: b.category_id ?? null,
        title: b.title,
        description: b.description,
        price: b.price,
        condition: b.condition,
        location: b.location ?? null,
        campus: b.campus ?? null,
        images: b.images ?? [],
      });
      ok(res, { product }, 201);
    } catch (err) {
      handleError(res, err);
    }
  };

  // PATCH /api/products/:id — chỉ seller/admin
  update = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    const role = req.header('X-User-Role') ?? null;

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const b = parsed.data;
    try {
      const product = await this.productUseCases.updateAsync(req.params.id, userId, role, {
        categoryId: b.category_id,
        title: b.title,
        description: b.description,
        price: b.price,
        condition: b.condition,
        location: b.location,
        campus: b.campus,
        images: b.images,
      });
      ok(res, { product });
    } catch (err) {
      handleError(res, err);
    }
  };

  // POST /api/products/:id/mark-sold — chỉ seller
  markSold = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    const role = req.header('X-User-Role') ?? null;
    try {
      const product = await this.productUseCases.markSoldAsync(req.params.id, userId, role);
      ok(res, { product });
    } catch (err) {
      handleError(res, err);
    }
  };

  // DELETE /api/products/:id — chỉ seller/admin (xóa mềm)
  remove = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    const role = req.header('X-User-Role') ?? null;
    try {
      await this.productUseCases.deleteAsync(req.params.id, userId, role);
      ok(res, { deleted: true });
    } catch (err) {
      handleError(res, err);
    }
  };
}
