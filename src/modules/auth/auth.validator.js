// src/modules/auth/auth.validator.js
const Joi = require('joi');

const passwordRule = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  .messages({
    'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
    'string.min': 'Password must be at least 8 characters',
  });

const register = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: passwordRule.required(),
  firstName: Joi.string().min(2).max(50).trim().required(),
  lastName: Joi.string().min(2).max(50).trim().required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-()]{7,15}$/).optional(),
  employeeId: Joi.string().max(50).trim().optional(),
  departmentId: Joi.string().uuid().optional(),
});

const login = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const refreshToken = Joi.object({
  refreshToken: Joi.string().required(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  password: passwordRule.required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Passwords do not match' }),
});

const changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordRule.required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords do not match' }),
});

const verifyEmail = Joi.object({
  token: Joi.string().required(),
});

module.exports = { register, login, refreshToken, forgotPassword, resetPassword, changePassword, verifyEmail };
