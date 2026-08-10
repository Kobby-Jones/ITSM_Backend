// src/modules/users/users.validator.js
const Joi = require('joi');

const updateUser = Joi.object({
  firstName: Joi.string().min(2).max(50).trim(),
  lastName: Joi.string().min(2).max(50).trim(),
  phone: Joi.string().pattern(/^\+?[\d\s\-()]{7,15}$/).allow('', null),
  employeeId: Joi.string().max(50).trim().allow('', null),
  departmentId: Joi.string().uuid().allow(null),
  fcmToken: Joi.string().allow('', null),
});

const updateRole = Joi.object({ roleId: Joi.string().uuid().required() });
const updateStatus = Joi.object({ status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').required() });
const updateFcmToken = Joi.object({ fcmToken: Joi.string().required() });

module.exports = { updateUser, updateRole, updateStatus, updateFcmToken };
