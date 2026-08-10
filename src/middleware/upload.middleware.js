// src/middleware/upload.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../shared/errors');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const SUBFOLDERS = { ticket: 'tickets', knowledge: 'knowledge', asset: 'assets', avatar: 'avatars' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = SUBFOLDERS[req.uploadType] || 'misc';
    const dest = path.join(uploadDir, folder);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(',');

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${file.mimetype} not allowed`, 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

function setUploadType(type) {
  return (req, res, next) => { req.uploadType = type; next(); };
}

function getFileUrl(req, file) {
  return `${req.protocol}://${req.get('host')}/${file.path.replace(/\\/g, '/')}`;
}

function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    // Non-blocking
  }
}

module.exports = { upload, setUploadType, getFileUrl, deleteFile };
