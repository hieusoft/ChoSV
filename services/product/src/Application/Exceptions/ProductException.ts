export class ProductException extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'ProductException';
  }
}

export class ProductNotFoundException extends ProductException {
  constructor() {
    super('PRODUCT_NOT_FOUND', 404);
  }
}

export class ProductForbiddenException extends ProductException {
  constructor() {
    super('PRODUCT_FORBIDDEN', 403);
  }
}

export class CategoryNotFoundException extends ProductException {
  constructor() {
    super('CATEGORY_NOT_FOUND', 400);
  }
}

export class ImageNotFoundException extends ProductException {
  constructor() {
    super('IMAGE_NOT_FOUND', 404);
  }
}

export class AlreadySoldException extends ProductException {
  constructor() {
    super('PRODUCT_ALREADY_SOLD', 409);
  }
}
