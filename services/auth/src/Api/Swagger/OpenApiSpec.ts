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

const authResult = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            role: { type: 'string' },
            status: { type: 'string' },
            email_verified: { type: 'boolean' },
          },
        },
        tokens: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string' },
          },
        },
      },
    },
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Auth Service API',
    version: '1.0.0',
    description:
      'Auth service (Node + Express + TS). Các route protected (/me, /logout) đi qua Kong: ' +
      'Kong validate JWT và forward X-User-Id. Gọi trực tiếp service này thì tự set header X-User-Id.',
  },
  servers: [
    { url: 'http://localhost:8080', description: 'Qua Kong gateway' },
    { url: 'http://localhost:3001', description: 'Trực tiếp auth-service' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng ký tài khoản',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'full_name'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'student@university.edu.vn' },
                  password: { type: 'string', minLength: 6, example: 'secret123' },
                  full_name: { type: 'string', example: 'Nguyễn Văn A' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Đăng ký thành công — status=pending_verification, CHƯA cấp token. Cần verify email.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            email: { type: 'string' },
                            role: { type: 'string' },
                            status: { type: 'string', example: 'pending_verification' },
                            email_verified: { type: 'boolean', example: false },
                          },
                        },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
          '409': { description: 'Email đã tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'student@university.edu.vn' },
                  password: { type: 'string', example: 'secret123' },
                  device_name: { type: 'string', example: 'iPhone 15' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Đăng nhập thành công', content: { 'application/json': { schema: authResult } } },
          '401': { description: 'Sai thông tin đăng nhập', content: { 'application/json': { schema: errorResponse } } },
          '403': { description: 'User bị ban / inactive', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Làm mới token (rotation)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token mới',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        access_token: { type: 'string' },
                        refresh_token: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Refresh token không hợp lệ', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng xuất (revoke session)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Đã đăng xuất' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Lấy thông tin user hiện tại',
        description:
          'Qua Kong: chỉ cần Bearer token, Kong tự forward X-User-Id. ' +
          'Gọi trực tiếp: phải tự gửi header X-User-Id.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Thông tin user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            email: { type: 'string' },
                            role: { type: 'string' },
                            status: { type: 'string' },
                            email_verified: { type: 'boolean' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Thiếu identity', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'User không tồn tại', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/verify-email': {
      post: {
        tags: ['Verification'],
        summary: 'Xác thực email bằng token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Email đã xác thực' },
          '400': { description: 'Token không hợp lệ / hết hạn', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/resend-verification': {
      post: {
        tags: ['Verification'],
        summary: 'Gửi lại email xác thực',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Đã gửi (nếu email tồn tại và chưa verify)' } },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Password'],
        summary: 'Yêu cầu reset mật khẩu',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Đã gửi link reset (nếu email tồn tại)' } },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Password'],
        summary: 'Đặt lại mật khẩu bằng token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'new_password'],
                properties: {
                  token: { type: 'string' },
                  new_password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Đổi mật khẩu thành công' },
          '400': { description: 'Token không hợp lệ / hết hạn', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/change-password': {
      post: {
        tags: ['Password'],
        summary: 'Đổi mật khẩu (đang đăng nhập)',
        description: 'Qua Kong: cần Bearer token. Gọi trực tiếp: cần header X-User-Id.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['old_password', 'new_password'],
                properties: {
                  old_password: { type: 'string' },
                  new_password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Đổi mật khẩu thành công' },
          '400': { description: 'Mật khẩu cũ sai', content: { 'application/json': { schema: errorResponse } } },
          '401': { description: 'Thiếu identity', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/2fa/setup': {
      post: {
        tags: ['2FA'],
        summary: 'Bắt đầu setup TOTP — trả secret + otpauth URL (render QR)',
        description: 'Qua Kong: cần Bearer token. Gọi trực tiếp: cần header X-User-Id.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Secret + otpauth URL',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        secret: { type: 'string' },
                        otpauth_url: { type: 'string', example: 'otpauth://totp/...' },
                      },
                    },
                  },
                },
              },
            },
          },
          '409': { description: '2FA đã bật', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/2fa/enable': {
      post: {
        tags: ['2FA'],
        summary: 'Bật TOTP (nhập code đầu tiên để xác nhận)',
        description: 'Qua Kong: cần Bearer token. Gọi trực tiếp: cần header X-User-Id.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: { code: { type: 'string', example: '123456' } },
              },
            },
          },
        },
        responses: {
          '200': { description: '2FA đã bật' },
          '401': { description: 'Code sai', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/2fa/disable': {
      post: {
        tags: ['2FA'],
        summary: 'Tắt TOTP',
        description: 'Qua Kong: cần Bearer token. Gọi trực tiếp: cần header X-User-Id.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: { code: { type: 'string', example: '123456' } },
              },
            },
          },
        },
        responses: {
          '200': { description: '2FA đã tắt' },
          '401': { description: 'Code sai', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/auth/2fa/verify': {
      post: {
        tags: ['2FA'],
        summary: 'Bước 2 của login khi bật 2FA — đổi challenge_token + code lấy tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['challenge_token', 'code'],
                properties: {
                  challenge_token: { type: 'string' },
                  code: { type: 'string', example: '123456' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Đăng nhập thành công', content: { 'application/json': { schema: authResult } } },
          '401': { description: 'Challenge / code không hợp lệ', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
  },
} as const;
