// __tests__/setup/globalSetup.js
const { execSync } = require('child_process');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ||
    'postgresql://itsm_user:itsm_password@localhost:5432/itsm_test?schema=public';
  process.env.REDIS_HOST = process.env.TEST_REDIS_HOST || 'localhost';
  process.env.REDIS_PORT = process.env.TEST_REDIS_PORT || '6379';
  process.env.JWT_SECRET = 'test-jwt-secret-super-long-string-32chars!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-super-long-string!';
  process.env.JWT_RESET_SECRET = 'test-reset-secret-super-long-string!!';
  process.env.JWT_VERIFY_SECRET = 'test-verify-secret-super-long-string!!';
  process.env.PORT = '3001';

  try {
    // Push schema to test database (no migration history needed)
    execSync('npx prisma db push --force-reset --skip-generate', {
      env: { ...process.env },
      stdio: 'pipe',
    });
    console.log('✅ Test database schema applied');
  } catch (err) {
    console.error('Failed to setup test database:', err.message);
    // Don't fail — integration tests may be skipped if no DB
  }
};
