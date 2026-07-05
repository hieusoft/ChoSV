import bcrypt from 'bcrypt';
import type { IPasswordHasher } from '../../Application/Interfaces/IPasswordHasher';

export class PasswordHasher implements IPasswordHasher {
  constructor(private readonly rounds = 10) {}

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  verifyPassword(hash: string, plain: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
