// src/middleware/upload.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../shared/errors');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const SUBFOLDERS = {
  ticket: 'tickets',
  knowledge: 'knowledge',
  asset: 'assets',
  avatar: 'avatars',
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const folder = SUBFOLDERS[req.uploadType] || 'misc';
    const destination = path.join(uploadDir, folder);

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    callback(null, destination);
  },

  filename: (req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    callback(null, uuidv4() + extension);
  },
});

const allowedTypes = (
  process.env.ALLOWED_FILE_TYPES
  || 'image/jpeg,image/png,image/gif,application/pdf'
)
  .split(',')
  .map(type => type.trim())
  .filter(Boolean);

const fileFilter = (req, file, callback) => {
  if (allowedTypes.includes(file.mimetype)) {
    callback(null, true);
    return;
  }

  callback(
    new AppError(
      `File type ${file.mimetype} is not allowed`,
      400
    ),
    false
  );
};

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize:
      parseInt(process.env.MAX_FILE_SIZE, 10)
      || 10 * 1024 * 1024,
  },
});

function setUploadType(type) {
  return (req, res, next) => {
    req.uploadType = type;
    next();
  };
}

function getFileUrl(req, file) {
  const folder = SUBFOLDERS[req.uploadType] || 'misc';

  return (
    `${req.protocol}://${req.get('host')}`
    + `/uploads/${folder}/`
    + encodeURIComponent(file.filename)
  );
}

function deleteFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Cleanup is best effort. The original request error must still be returned.
  }
}

module.exports = {
  upload,
  setUploadType,
  getFileUrl,
  deleteFile,
};