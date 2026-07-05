const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
};

const imageProps = {
  id: { type: 'string', format: 'uuid' },
  image_url: { type: 'string' },
  object_key: { type: 'string' },
  sort_order: { type: 'integer' },
};

const productProps = {
  id: { type: 'string', format: 'uuid' },
  seller_id: { type: 'string', format: 'uuid' },
  category_id: { type: 'string', format: 'uuid', nullable: true },
  title: { type: 'string' },
  description: { type: 'string' },
  price: { type: 'number' },
  condition: { type: 'string', enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
  status: { type: 'string' },
  location: { type: 'string', nullable: true },
  campus: { type: 'string', nullable: true },
  view_count: { type: 'integer' },
  favorite_count: { type: 'integer' },
  images: { type: 'array', items: { type: 'object', properties: imageProps } },
  created_at: { type: 'string', format: 'date-time' },
  updated_at: { type: 'string', format: 'date-time' },
};

const imageInput = {
  type: 'object',
  required: ['upload_id'],
  properties: {
    upload_id: { type: 'string', format: 'uuid', description: 'upload_id từ upload-service (đã upload lên R2)' },
    sort_order: { type: 'integer' },
  },
};

const productWrapped = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: { type: 'object', properties: { product: { type: 'object', properties: productProps } } },
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Product Service API',
    version: '1.0.0',
    description:
      'Product service — sản phẩm, danh mục, yêu thích. Ảnh dùng upload_id từ upload-service: ' +
      'khi tạo/sửa product, service gọi upload-service save/unsave rồi copy object_key/image_url ' +
      'vào product_images (render KHÔNG cần gọi upload-service). GET public; mutation cần JWT qua Kong.',
  },
  servers: [
    { url: 'http://localhost:8080', description: 'Qua Kong gateway' },
    { url: 'http://localhost:3003', description: 'Trực tiếp product-service' },
  ],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/api/products': {
      get: {
        tags: ['Product'],
        summary: 'Danh sách sản phẩm active (public, phân trang + filter)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'category_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'min_price', in: 'query', schema: { type: 'number' } },
          { name: 'max_price', in: 'query', schema: { type: 'number' } },
          { name: 'condition', in: 'query', schema: { type: 'string' } },
          { name: 'campus', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'price_asc', 'price_desc'] } },
        ],
        responses: { '200': { description: 'Danh sách + total' } },
      },
      post: {
        tags: ['Product'],
        summary: 'Tạo sản phẩm (cần JWT). images = mảng upload_id.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'price', 'condition'],
                properties: {
                  category_id: { type: 'string', format: 'uuid' },
                  title: { type: 'string', example: 'Máy tính Casio FX-580VN X' },
                  description: { type: 'string' },
                  price: { type: 'number', example: 450000 },
                  condition: { type: 'string', enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
                  location: { type: 'string' },
                  campus: { type: 'string' },
                  images: { type: 'array', items: imageInput, maxItems: 10 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Đã tạo', content: { 'application/json': { schema: productWrapped } } },
          '400': { description: 'Validation / category không hợp lệ', content: { 'application/json': { schema: errorResponse } } },
          '401': { description: 'Thiếu identity', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/products/{id}': {
      get: {
        tags: ['Product'],
        summary: 'Chi tiết sản phẩm (public, tăng view_count)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Chi tiết', content: { 'application/json': { schema: productWrapped } } },
          '404': { description: 'Không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
      patch: {
        tags: ['Product'],
        summary: 'Cập nhật (chỉ seller/admin). images gửi lên -> diff (thêm save, bỏ unsave).',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  category_id: { type: 'string', format: 'uuid', nullable: true },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  condition: { type: 'string' },
                  location: { type: 'string', nullable: true },
                  campus: { type: 'string', nullable: true },
                  images: { type: 'array', items: imageInput, maxItems: 10 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Đã cập nhật', content: { 'application/json': { schema: productWrapped } } },
          '403': { description: 'Không phải seller', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
      delete: {
        tags: ['Product'],
        summary: 'Xóa mềm (chỉ seller/admin). Un-save toàn bộ ảnh.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Đã xóa' },
          '403': { description: 'Không phải seller', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/products/{id}/mark-sold': {
      post: {
        tags: ['Product'],
        summary: 'Đánh dấu đã bán (chỉ seller)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Đã đánh dấu sold', content: { 'application/json': { schema: productWrapped } } },
          '409': { description: 'Đã bán rồi', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/products/{id}/favorite': {
      post: {
        tags: ['Favorite'],
        summary: 'Thêm yêu thích (cần JWT)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Đã thêm' } },
      },
      delete: {
        tags: ['Favorite'],
        summary: 'Bỏ yêu thích (cần JWT)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Đã bỏ' } },
      },
    },
    '/api/me/favorites': {
      get: {
        tags: ['Favorite'],
        summary: 'Danh sách sản phẩm đã yêu thích (cần JWT)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Danh sách' } },
      },
    },
    '/api/categories': {
      get: {
        tags: ['Category'],
        summary: 'Danh mục active (public)',
        responses: { '200': { description: 'Danh sách danh mục' } },
      },
    },
  },
} as const;
