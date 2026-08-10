// __tests__/setup/globalTeardown.js
module.exports = async () => {
  // Prisma disconnects automatically
  // Redis closes automatically
  console.log('✅ Test teardown complete');
};
