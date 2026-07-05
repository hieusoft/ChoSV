import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  device_name: z.string().optional(),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(6),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(6),
});

export const totpEnableSchema = z.object({
  code: z.string().min(6).max(6),
});

export const totpDisableSchema = z.object({
  code: z.string().min(6).max(6),
});

export const totpVerifySchema = z.object({
  challenge_token: z.string().min(1),
  code: z.string().min(6).max(6),
});
