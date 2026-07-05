import type { Response } from 'express';
import { ProductException } from '../../Application/Exceptions/ProductException';

export function ok(res: Response, data: unknown, status = 200) {
  res.status(status).json({ success: true, data });
}

export function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

export function handleError(res: Response, err: unknown) {
  if (err instanceof ProductException) {
    return fail(res, err.status, err.code, err.code);
  }
  console.error('Unexpected product-service error:', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}
