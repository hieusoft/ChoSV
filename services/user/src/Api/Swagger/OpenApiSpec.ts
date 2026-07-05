const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

const profileProps = {
  id: { type: 'string', format: 'uuid' },
  user_id: { type: 'string', format: 'uuid' },
  full_name: { type: 'string' },
  avatar_url: { type: 'string', nullable: true },
  university: { type: 'string', nullable: true },
  campus: { type: 'string', nullable: true },
  bio: { type: 'string', nullable: true },
  reputation_score: { type: 'integer' },
  total_reviews: { type: 'integer' },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'User Service API',
    version: '1.0.0',
    description:
      'User/Profile service (Node + Express + TS). Profile được tạo tự động khi auth-service ' +
      'phát event user.registered. Route /me qua Kong: Kong validate JWT + forward X-User-Id.',
  },
  servers: [
    { url: 'http://localhost:8080', description: 'Qua Kong gateway' },
    { url: 'http://localhost:3002', description: 'Trực tiếp user-service' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/api/users/me': {
      get: {
        tags: ['Profile'],
        summary: 'Lấy profile của chính mình',
        description: 'Qua Kong: cần Bearer token. Gọi trực tiếp: cần header X-User-Id.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile đầy đủ (có phone)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        profile: {
                          type: 'object',
                          properties: { ...profileProps, phone: { type: 'string', nullable: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Thiếu identity', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Profile không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
      patch: {
        tags: ['Profile'],
        summary: 'Cập nhật profile của chính mình',
        description: 'Qua Kong: cần Bearer token. Gọi trực tiếp: cần header X-User-Id.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  full_name: { type: 'string', example: 'Nguyễn Văn A' },
                  university: { type: 'string', example: 'Đại học ABC' },
                  campus: { type: 'string', example: 'Cơ sở 1' },
                  phone: { type: 'string', example: '0900000000' },
                  bio: { type: 'string', example: 'Sinh viên năm 3' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Đã cập nhật' },
          '401': { description: 'Thiếu identity', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Profile không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/users/{userId}': {
      get: {
        tags: ['Profile'],
        summary: 'Xem profile public của user khác (ẩn phone)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Profile public',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: { profile: { type: 'object', properties: profileProps } },
                    },
                  },
                },
              },
            },
          },
          '404': { description: 'Profile không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
  },
} as const;
