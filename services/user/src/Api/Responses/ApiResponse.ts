import type { Response } from 'express';
import { ProfileException } from '../../Application/Exceptions/ProfileException';

export function ok(res: Response, data: unknown, status = 200) {
  res.status(status).json({ success: true, data });
}

export function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

export function handleError(res: Response, err: unknown) {
  if (err instanceof ProfileException) {
    return fail(res, err.status, err.code, err.code);
  }
  console.error('Unexpected user-service error:', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}
