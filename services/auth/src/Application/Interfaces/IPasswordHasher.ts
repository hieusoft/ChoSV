export interface IPasswordHasher {
  hashPassword(plain: string): Promise<string>;
  verifyPassword(hash: string, plain: string): Promise<boolean>;
}
