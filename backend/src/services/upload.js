const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Una sola storage: elige la carpeta de Cloudinary según el nombre del campo del formulario
// (firma -> jej-activos-firmas, fotos -> jej-activos-evidencia).
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: file.fieldname === 'firma' ? 'jej-activos-firmas' : 'jej-activos-evidencia',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    resource_type: 'image'
  })
});

const MAX_ACTA_MB = 5;
const uploadActa = multer({ storage, limits: { fileSize: MAX_ACTA_MB * 1024 * 1024 } });

module.exports = { uploadActa, MAX_ACTA_MB };
