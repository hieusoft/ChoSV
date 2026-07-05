const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
};

const uploadProps = {
  id: { type: 'string', format: 'uuid' },
  owner_id: { type: 'string', format: 'uuid' },
  object_key: { type: 'string' },
  public_url: { type: 'string' },
  file_name: { type: 'string', nullable: true },
  content_type: { type: 'string', nullable: true },
  file_size: { type: 'integer', nullable: true },
  purpose: { type: 'string' },
  status: { type: 'string', enum: ['draft', 'saved'] },
  linked_service: { type: 'string', nullable: true },
  linked_entity_id: { type: 'string', format: 'uuid', nullable: true },
};

const uploadWrapped = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: { type: 'object', properties: { upload: { type: 'object', properties: uploadProps } } },
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Upload Service API',
    version: '2.0.0',
    description:
      'Upload service — Cloudflare R2 presigned uploads. Mô hình draft/saved: presign tạo draft, ' +
      'save gắn vào entity nghiệp vụ, unsave trả về draft (khi product bỏ ảnh). Cron dọn draft quá hạn. ' +
      'Tất cả route qua Kong: validate JWT + forward X-User-Id / X-User-Role.',
  },
  servers: [
    { url: 'http://localhost:8080', description: 'Qua Kong gateway' },
    { url: 'http://localhost:3010', description: 'Trực tiếp upload-service' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
  },
  paths: {
    '/api/uploads/presign': {
      post: {
        tags: ['Upload'],
        summary: 'Tạo draft + presigned PUT URL',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['purpose', 'file_name', 'content_type', 'file_size'],
                properties: {
                  purpose: { type: 'string', enum: ['product_image', 'avatar', 'report_attachment', 'chat_image'] },
                  file_name: { type: 'string', example: 'laptop.jpg' },
                  content_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
                  file_size: { type: 'integer', example: 1024000 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Draft + presigned URL',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        upload_id: { type: 'string', format: 'uuid' },
                        upload_url: { type: 'string' },
                        object_key: { type: 'string' },
                        public_url: { type: 'string' },
                        headers: { type: 'object', additionalProperties: { type: 'string' } },
                        expires_in: { type: 'integer', example: 300 },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation / file quá lớn', content: { 'application/json': { schema: errorResponse } } },
          '401': { description: 'Thiếu identity', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/uploads/{id}': {
      get: {
        tags: ['Upload'],
        summary: 'Lấy metadata upload (owner/admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Metadata', content: { 'application/json': { schema: uploadWrapped } } },
          '403': { description: 'Không phải chủ', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/uploads/{id}/save': {
      post: {
        tags: ['Upload'],
        summary: 'draft -> saved (HEAD verify R2 + gắn entity). Idempotent.',
        description: 'Service nghiệp vụ gọi sau khi tạo product/profile. Verify object đã lên R2.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['linked_service'],
                properties: {
                  linked_service: { type: 'string', example: 'product-service' },
                  linked_entity_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Đã saved', content: { 'application/json': { schema: uploadWrapped } } },
          '400': { description: 'Object chưa lên R2', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/uploads/{id}/unsave': {
      post: {
        tags: ['Upload'],
        summary: 'saved -> draft (để cron dọn). Dùng khi sửa/xóa product bỏ ảnh. Idempotent.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Đã trả về draft', content: { 'application/json': { schema: uploadWrapped } } },
          '404': { description: 'Không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
  },
} as const;
