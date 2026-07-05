import { Router } from 'express';
import type { UserController } from '../Controllers/UserController';

export function buildUserRouter(controller: UserController): Router {
  const router = Router();

  // Protected — Kong đã validate JWT + forward X-User-Id
  router.get('/me', controller.getMe);
  router.patch('/me', controller.updateMe);

  // Public — xem profile của user khác
  router.get('/:userId', controller.getPublicProfile);

  return router;
}
