import { Router } from 'express';
import type { AuthController } from '../Controllers/AuthController';

export function buildAuthRouter(controller: AuthController): Router {
  const router = Router();

  // Public — Kong không yêu cầu JWT
  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.post('/refresh-token', controller.refreshToken);
  router.post('/verify-email', controller.verifyEmail);
  router.post('/resend-verification', controller.resendVerification);
  router.post('/forgot-password', controller.forgotPassword);
  router.post('/reset-password', controller.resetPassword);
  // Bước 2 của login khi bật 2FA (dùng challenge_token, không phải JWT)
  router.post('/2fa/verify', controller.verifyTotp);

  // Protected — Kong đã validate JWT + forward X-User-Id
  router.post('/logout', controller.logout);
  router.get('/me', controller.getMe);
  router.post('/change-password', controller.changePassword);
  router.post('/2fa/setup', controller.setupTotp);
  router.post('/2fa/enable', controller.enableTotp);
  router.post('/2fa/disable', controller.disableTotp);

  return router;
}
