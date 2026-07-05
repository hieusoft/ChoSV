import type { TokenPair } from '../../Domain/Entities/Token';
import type { User } from '../../Domain/Entities/User';
import type { IUserRepository } from '../Interfaces/IUserRepository';
import type { ISessionRepository } from '../Interfaces/ISessionRepository';
import type { IPasswordHasher } from '../Interfaces/IPasswordHasher';
import type { IJwtService } from '../Interfaces/IJwtService';
import type { IEventPublisher } from '../Interfaces/IEventPublisher';
import type { ITotpService } from '../Interfaces/ITotpService';
import type { IEmailVerificationRepository } from '../Interfaces/IEmailVerificationRepository';
import type { IPasswordResetRepository } from '../Interfaces/IPasswordResetRepository';
import type { LoginRequestDto } from '../DTOs/Auth/LoginRequestDto';
import type { RegisterRequestDto } from '../DTOs/Auth/RegisterRequestDto';
import {
  toTokensDto,
  toUserBrief,
  type AuthResponseDto,
  type LoginResultDto,
  type TokensDto,
  type TotpSetupDto,
  type UserBriefDto,
} from '../DTOs/Auth/AuthResponseDto';
import {
  EmailAlreadyExistsException,
  EmailNotVerifiedException,
  InvalidChallengeException,
  InvalidCredentialsException,
  InvalidRefreshTokenException,
  InvalidTokenException,
  InvalidTotpCodeException,
  OldPasswordIncorrectException,
  TotpAlreadyEnabledException,
  TotpNotEnabledException,
  TotpNotSetupException,
  UserBannedException,
  UserInactiveException,
  UserNotFoundException,
} from '../Exceptions/AuthException';

export interface AuthUseCasesConfig {
  refreshExpiryDays: number;
  emailVerificationExpiryHours: number;
  passwordResetExpiryHours: number;
}

export class AuthUseCases {
  private readonly _userRepository: IUserRepository;
  private readonly _sessionRepository: ISessionRepository;
  private readonly _passwordHasher: IPasswordHasher;
  private readonly _jwtService: IJwtService;
  private readonly _totpService: ITotpService;
  private readonly _emailVerificationRepository: IEmailVerificationRepository;
  private readonly _passwordResetRepository: IPasswordResetRepository;
  private readonly _eventPublisher: IEventPublisher;
  private readonly _config: AuthUseCasesConfig;

  constructor(
    userRepository: IUserRepository,
    sessionRepository: ISessionRepository,
    passwordHasher: IPasswordHasher,
    jwtService: IJwtService,
    totpService: ITotpService,
    emailVerificationRepository: IEmailVerificationRepository,
    passwordResetRepository: IPasswordResetRepository,
    eventPublisher: IEventPublisher,
    config: AuthUseCasesConfig,
  ) {
    this._userRepository = userRepository;
    this._sessionRepository = sessionRepository;
    this._passwordHasher = passwordHasher;
    this._jwtService = jwtService;
    this._totpService = totpService;
    this._emailVerificationRepository = emailVerificationRepository;
    this._passwordResetRepository = passwordResetRepository;
    this._eventPublisher = eventPublisher;
    this._config = config;
  }

  private async issueTokens(user: User, deviceName: string | null): Promise<TokenPair> {
    const accessToken = this._jwtService.generateAccessToken(user.id, user.role);
    const { raw, hash } = this._jwtService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this._config.refreshExpiryDays * 24 * 60 * 60 * 1000);
    await this._sessionRepository.create(user.id, hash, expiresAt, deviceName);
    return { accessToken, refreshToken: raw };
  }

  private async createEmailVerification(user: User): Promise<void> {
    const { raw, hash } = this._jwtService.generateRefreshToken();
    const expiresAt = new Date(
      Date.now() + this._config.emailVerificationExpiryHours * 60 * 60 * 1000,
    );
    await this._emailVerificationRepository.create(user.id, hash, expiresAt);
    this._eventPublisher.publishEmailVerificationRequested(user.id, user.email, raw);
  }

  // Đăng ký: tạo user status=pending_verification, KHÔNG cấp token.
  // User phải verify email mới login được (chặn dùng email người khác).
  async registerAsync(dto: RegisterRequestDto): Promise<UserBriefDto> {
    if (await this._userRepository.emailExists(dto.email)) {
      throw new EmailAlreadyExistsException();
    }
    const passwordHash = await this._passwordHasher.hashPassword(dto.password);
    const user = await this._userRepository.create(
      dto.email,
      passwordHash,
      'user',
      'pending_verification',
    );
    // Publish ngay để user-service tạo profile (mang full_name — chỉ có ở bước này).
    // Login vẫn bị chặn tới khi verify (status = pending_verification).
    this._eventPublisher.publishUserRegistered(user.id, user.email, dto.full_name);
    await this.createEmailVerification(user);
    return toUserBrief(user);
  }

  async loginAsync(dto: LoginRequestDto): Promise<LoginResultDto> {
    const user = await this._userRepository.findByEmail(dto.email);
    if (!user) {
      throw new InvalidCredentialsException();
    }
    if (user.status === 'banned') throw new UserBannedException();
    if (user.status === 'inactive') throw new UserInactiveException();

    const ok = await this._passwordHasher.verifyPassword(user.passwordHash, dto.password);
    if (!ok) {
      throw new InvalidCredentialsException();
    }

    // Chưa verify email -> chặn login (chống dùng email người khác đăng ký).
    if (!user.emailVerified) {
      throw new EmailNotVerifiedException();
    }

    // Đã bật 2FA: chưa cấp token, trả challenge để gọi /2fa/verify.
    if (user.totpEnabled) {
      return {
        requires_2fa: true,
        challenge_token: this._jwtService.generateChallengeToken(user.id),
      };
    }

    const tokens = await this.issueTokens(user, dto.device_name ?? null);
    await this._userRepository.updateLastLogin(user.id);
    return { user: toUserBrief(user), tokens: toTokensDto(tokens) };
  }

  async refreshTokenAsync(refreshToken: string): Promise<TokensDto> {
    const hash = this._jwtService.hashRefreshToken(refreshToken);
    const session = await this._sessionRepository.findActiveByHash(hash);
    if (!session) {
      throw new InvalidRefreshTokenException();
    }
    const user = await this._userRepository.findById(session.userId);
    if (!user) {
      throw new InvalidRefreshTokenException();
    }
    await this._sessionRepository.revokeByHash(hash);
    const tokens = await this.issueTokens(user, null);
    return toTokensDto(tokens);
  }

  async logoutAsync(refreshToken: string): Promise<void> {
    await this._sessionRepository.revokeByHash(this._jwtService.hashRefreshToken(refreshToken));
  }

  async getMeAsync(userId: string): Promise<UserBriefDto> {
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }
    return toUserBrief(user);
  }

  // ---------- Email verification ----------

  async verifyEmailAsync(token: string): Promise<void> {
    const hash = this._jwtService.hashRefreshToken(token);
    const record = await this._emailVerificationRepository.findValidByHash(hash);
    if (!record) {
      throw new InvalidTokenException();
    }
    await this._emailVerificationRepository.markVerified(record.id);
    await this._userRepository.setEmailVerified(record.userId);
    // Verify xong -> kích hoạt tài khoản để login được.
    await this._userRepository.setStatus(record.userId, 'active');
    const user = await this._userRepository.findById(record.userId);
    if (user) {
      this._eventPublisher.publishEmailVerified(user.id, user.email);
    }
  }

  async resendVerificationAsync(email: string): Promise<void> {
    const user = await this._userRepository.findByEmail(email);
    // Không tiết lộ email có tồn tại hay không.
    if (!user || user.emailVerified) {
      return;
    }
    await this.createEmailVerification(user);
  }

  // ---------- Password reset ----------

  async forgotPasswordAsync(email: string): Promise<void> {
    const user = await this._userRepository.findByEmail(email);
    if (!user) {
      return; // Không tiết lộ email có tồn tại hay không.
    }
    const { raw, hash } = this._jwtService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this._config.passwordResetExpiryHours * 60 * 60 * 1000);
    await this._passwordResetRepository.create(user.id, hash, expiresAt);
    this._eventPublisher.publishPasswordResetRequested(user.id, user.email, raw);
  }

  async resetPasswordAsync(token: string, newPassword: string): Promise<void> {
    const hash = this._jwtService.hashRefreshToken(token);
    const record = await this._passwordResetRepository.findValidByHash(hash);
    if (!record) {
      throw new InvalidTokenException();
    }
    const user = await this._userRepository.findById(record.userId);
    if (!user) {
      throw new UserNotFoundException();
    }
    const passwordHash = await this._passwordHasher.hashPassword(newPassword);
    await this._userRepository.updatePassword(user.id, passwordHash);
    await this._passwordResetRepository.markUsed(record.id);
    this._eventPublisher.publishPasswordResetCompleted(user.id, user.email);
  }

  async changePasswordAsync(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }
    const ok = await this._passwordHasher.verifyPassword(user.passwordHash, oldPassword);
    if (!ok) {
      throw new OldPasswordIncorrectException();
    }
    const passwordHash = await this._passwordHasher.hashPassword(newPassword);
    await this._userRepository.updatePassword(user.id, passwordHash);
  }

  // ---------- TOTP 2FA ----------

  async setupTotpAsync(userId: string): Promise<TotpSetupDto> {
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }
    if (user.totpEnabled) {
      throw new TotpAlreadyEnabledException();
    }
    const secret = this._totpService.generateSecret();
    await this._userRepository.setTotpSecret(userId, secret);
    return {
      secret,
      otpauth_url: this._totpService.buildOtpAuthUrl(secret, user.email),
    };
  }

  async enableTotpAsync(userId: string, code: string): Promise<void> {
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }
    if (user.totpEnabled) {
      throw new TotpAlreadyEnabledException();
    }
    if (!user.totpSecret) {
      throw new TotpNotSetupException();
    }
    if (!this._totpService.verifyCode(user.totpSecret, code)) {
      throw new InvalidTotpCodeException();
    }
    await this._userRepository.setTotpEnabled(userId, true);
  }

  async disableTotpAsync(userId: string, code: string): Promise<void> {
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }
    if (!user.totpEnabled || !user.totpSecret) {
      throw new TotpNotEnabledException();
    }
    if (!this._totpService.verifyCode(user.totpSecret, code)) {
      throw new InvalidTotpCodeException();
    }
    await this._userRepository.setTotpEnabled(userId, false);
    await this._userRepository.setTotpSecret(userId, '');
  }

  async verifyTotpAsync(challengeToken: string, code: string): Promise<AuthResponseDto> {
    const userId = this._jwtService.verifyChallengeToken(challengeToken);
    if (!userId) {
      throw new InvalidChallengeException();
    }
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new InvalidChallengeException();
    }
    if (!user.totpEnabled || !user.totpSecret) {
      throw new TotpNotEnabledException();
    }
    if (!this._totpService.verifyCode(user.totpSecret, code)) {
      throw new InvalidTotpCodeException();
    }
    const tokens = await this.issueTokens(user, null);
    await this._userRepository.updateLastLogin(user.id);
    return { user: toUserBrief(user), tokens: toTokensDto(tokens) };
  }
}
