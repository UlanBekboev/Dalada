import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM: получаем __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dalada API',
      version: '1.0.0',
      description: 'Документация API для платформы Dalada',
    },
    servers: [
      { url: 'http://localhost:5000/api' },
    ],
    security: [ { bearerAuth: [] } ]
  },
  apis: ['./src/controllers/*.ts'], // путь до контроллеров с JSDoc
};

const swaggerSpec = swaggerJsdoc(options);

fs.writeFileSync(path.resolve(__dirname, 'openapi.json'), JSON.stringify(swaggerSpec, null, 2));
console.log('✅ openapi.json сгенерирован!');
