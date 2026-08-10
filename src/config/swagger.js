// src/config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ITSM Platform API',
      version: '1.0.0',
      description: 'Context-Aware Cross-Platform IT Service Management Framework for Ghanaian Organizations',
      contact: { name: 'ITSM Support', email: 'support@itsm.com' },
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 3000}/api/v1`, description: 'Development' },
      { url: `${process.env.APP_URL}/api/v1`, description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: {} },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.js', './src/docs/*.yaml'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
