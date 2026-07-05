export class ProfileException extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'ProfileException';
  }
}

export class ProfileNotFoundException extends ProfileException {
  constructor() {
    super('PROFILE_NOT_FOUND', 404);
  }
}
