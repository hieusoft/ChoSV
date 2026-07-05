export interface IEventPublisher {
  publishUserRegistered(userId: string, email: string, fullName: string): void;
  publishEmailVerificationRequested(userId: string, email: string, token: string): void;
  publishEmailVerified(userId: string, email: string): void;
  publishPasswordResetRequested(userId: string, email: string, token: string): void;
  publishPasswordResetCompleted(userId: string, email: string): void;
}
