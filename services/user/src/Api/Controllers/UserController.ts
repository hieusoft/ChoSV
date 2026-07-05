import { type Request, type Response } from 'express';
import type { UserUseCases } from '../../Application/UseCases/UserUseCases';
import { updateProfileSchema } from '../../Application/Validators/ProfileValidators';
import { fail, handleError, ok } from '../Responses/ApiResponse';

export class UserController {
  constructor(private readonly userUseCases: UserUseCases) {}

  // Kong đã validate JWT + forward X-User-Id.
  getMe = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    }
    try {
      const profile = await this.userUseCases.getMeAsync(userId);
      ok(res, { profile });
    } catch (err) {
      handleError(res, err);
    }
  };

  updateMe = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    }
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      const profile = await this.userUseCases.updateMeAsync(userId, {
        fullName: parsed.data.full_name,
        university: parsed.data.university,
        campus: parsed.data.campus,
        phone: parsed.data.phone,
        bio: parsed.data.bio,
      });
      ok(res, { profile });
    } catch (err) {
      handleError(res, err);
    }
  };

  // Public — xem profile của user khác
  getPublicProfile = async (req: Request, res: Response) => {
    const userId = req.params.userId;
    try {
      const profile = await this.userUseCases.getPublicProfileAsync(userId);
      ok(res, { profile });
    } catch (err) {
      handleError(res, err);
    }
  };
}
