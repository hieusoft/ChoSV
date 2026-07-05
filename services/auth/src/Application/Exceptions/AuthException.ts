export class AuthException extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'AuthException';
  }
}

export class EmailAlreadyExistsException extends AuthException {
  constructor() {
    super('EMAIL_ALREADY_EXISTS', 409);
  }
}

export class InvalidCredentialsException extends AuthException {
  constructor() {
    super('INVALID_CREDENTIALS', 401);
  }
}

export class UserBannedException extends AuthException {
  constructor() {
    super('USER_BANNED', 403);
  }
}

export class UserInactiveException extends AuthException {
  constructor() {
    super('USER_INACTIVE', 403);
  }
}

export class EmailNotVerifiedException extends AuthException {
  constructor() {
    super('EMAIL_NOT_VERIFIED', 403);
  }
}

export class InvalidRefreshTokenException extends AuthException {
  constructor() {
    super('INVALID_REFRESH_TOKEN', 401);
  }
}

export class UserNotFoundException extends AuthException {
  constructor() {
    super('USER_NOT_FOUND', 404);
  }
}

export class InvalidTokenException extends AuthException {
  constructor() {
    super('INVALID_TOKEN', 400);
  }
}

export class InvalidTotpCodeException extends AuthException {
  constructor() {
    super('INVALID_TOTP_CODE', 401);
  }
}

export class TotpNotEnabledException extends AuthException {
  constructor() {
    super('TOTP_NOT_ENABLED', 400);
  }
}

export class TotpAlreadyEnabledException extends AuthException {
  constructor() {
    super('TOTP_ALREADY_ENABLED', 409);
  }
}

export class TotpNotSetupException extends AuthException {
  constructor() {
    super('TOTP_NOT_SETUP', 400);
  }
}

export class InvalidChallengeException extends AuthException {
  constructor() {
    super('INVALID_CHALLENGE', 401);
  }
}

export class OldPasswordIncorrectException extends AuthException {
  constructor() {
    super('OLD_PASSWORD_INCORRECT', 400);
  }
}
