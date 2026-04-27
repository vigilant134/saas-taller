const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary'); // asegúrate de tener este archivo

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const servicioId = req.params.id;

    return {
      folder: `talleres/servicios/${servicioId}`,
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    };
  }
});

const uploadFotosServicio = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'));
    }
    cb(null, true);
  }
});

module.exports = uploadFotosServicio;