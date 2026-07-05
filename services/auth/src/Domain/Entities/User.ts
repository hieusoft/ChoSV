export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  status: string;
  emailVerified: boolean;
  totpSecret: string | null;
  totpEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
