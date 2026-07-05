import { type Request, type Response } from 'express';
import type { AuthUseCases } from '../../Application/UseCases/AuthUseCases';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  totpDisableSchema,
  totpEnableSchema,
  totpVerifySchema,
  verifyEmailSchema,
} from '../../Application/Validators/AuthValidators';
import { fail, handleError, ok } from '../Responses/ApiResponse';

export class AuthController {
  constructor(private readonly authUseCases: AuthUseCases) {}

  register = async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      const user = await this.authUseCases.registerAsync(parsed.data);
      ok(res, { user, message: 'Please verify your email to activate your account' }, 201);
    } catch (err) {
      handleError(res, err);
    }
  };

  login = async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      const result = await this.authUseCases.loginAsync(parsed.data);
      ok(res, result);
    } catch (err) {
      handleError(res, err);
    }
  };

  refreshToken = async (req: Request, res: Response) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      const tokens = await this.authUseCases.refreshTokenAsync(parsed.data.refresh_token);
      ok(res, tokens);
    } catch (err) {
      handleError(res, err);
    }
  };

  logout = async (req: Request, res: Response) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      await this.authUseCases.logoutAsync(parsed.data.refresh_token);
      ok(res, { message: 'Logged out' });
    } catch (err) {
      handleError(res, err);
    }
  };

  // Kong đã validate JWT và forward X-User-Id xuống đây.
  getMe = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    }
    try {
      const user = await this.authUseCases.getMeAsync(userId);
      ok(res, { user });
    } catch (err) {
      handleError(res, err);
    }
  };

  // ---------- Email verification ----------

  verifyEmail = async (req: Request, res: Response) => {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      await this.authUseCases.verifyEmailAsync(parsed.data.token);
      ok(res, { message: 'Email verified' });
    } catch (err) {
      handleError(res, err);
    }
  };

  resendVerification = async (req: Request, res: Response) => {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      await this.authUseCases.resendVerificationAsync(parsed.data.email);
      ok(res, { message: 'If the email exists and is unverified, a verification link has been sent' });
    } catch (err) {
      handleError(res, err);
    }
  };

  // ---------- Password reset ----------

  forgotPassword = async (req: Request, res: Response) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      await this.authUseCases.forgotPasswordAsync(parsed.data.email);
      ok(res, { message: 'If the email exists, a password reset link has been sent' });
    } catch (err) {
      handleError(res, err);
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      await this.authUseCases.resetPasswordAsync(parsed.data.token, parsed.data.new_password);
      ok(res, { message: 'Password reset successful' });
    } catch (err) {
      handleError(res, err);
    }
  };

  // Kong đã validate JWT + forward X-User-Id.
  changePassword = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    }
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      await this.authUseCases.changePasswordAsync(
        userId,
        parsed.data.old_password,
        parsed.data.new_password,
      );
      ok(res, { message: 'Password changed' });
    } catch (err) {
      handleError(res, err);
    }
  };

  // ---------- TOTP 2FA ----------

  // Protected — cần X-User-Id (qua Kong)
  setupTotp = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    }
    try {
      const result = await this.authUseCases.setupTotpAsync(userId);
      ok(res, result);
    } catch (err) {
      handleError(res, err);
    }
  };

  enableTotp = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    }
    const parsed = totpEnableSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      await this.authUseCases.enableTotpAsync(userId, parsed.data.code);
      ok(res, { message: '2FA enabled' });
    } catch (err) {
      handleError(res, err);
    }
  };

  disableTotp = async (req: Request, res: Response) => {
    const userId = req.header('X-User-Id');
    if (!userId) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing user identity');
    }
    const parsed = totpDisableSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      await this.authUseCases.disableTotpAsync(userId, parsed.data.code);
      ok(res, { message: '2FA disabled' });
    } catch (err) {
      handleError(res, err);
    }
  };

  // Public — bước 2 của login khi bật 2FA (challenge_token thay cho JWT)
  verifyTotp = async (req: Request, res: Response) => {
    const parsed = totpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    try {
      const result = await this.authUseCases.verifyTotpAsync(
        parsed.data.challenge_token,
        parsed.data.code,
      );
      ok(res, result);
    } catch (err) {
      handleError(res, err);
    }
  };
}
