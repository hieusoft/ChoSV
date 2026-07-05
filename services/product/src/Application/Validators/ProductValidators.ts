import { z } from 'zod';

const conditionEnum = z.enum(['new', 'like_new', 'good', 'fair', 'poor']);

const imageInputSchema = z.object({
  upload_id: z.string().uuid(),
  sort_order: z.number().int().min(0).optional(),
});

export const createProductSchema = z.object({
  category_id: z.string().uuid().optional(),
  title: z.string().min(3).max(255),
  description: z.string().min(1),
  price: z.number().nonnegative(),
  condition: conditionEnum,
  location: z.string().max(255).optional(),
  campus: z.string().max(255).optional(),
  images: z.array(imageInputSchema).max(10).optional(),
});

export const updateProductSchema = z
  .object({
    category_id: z.string().uuid().nullable().optional(),
    title: z.string().min(3).max(255).optional(),
    description: z.string().min(1).optional(),
    price: z.number().nonnegative().optional(),
    condition: conditionEnum.optional(),
    location: z.string().max(255).nullable().optional(),
    campus: z.string().max(255).nullable().optional(),
    // Danh sách ảnh mong muốn sau khi sửa; nếu có -> service diff với ảnh hiện tại.
    images: z.array(imageInputSchema).max(10).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Empty update' });

// query params cho GET /products
export const listProductSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category_id: z.string().uuid().optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  condition: conditionEnum.optional(),
  campus: z.string().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
});
