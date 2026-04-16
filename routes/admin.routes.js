const { Router } = require('express');
const router = Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

// IMPORTAR MIDDLEWARE
const authAdmin = require('../middlewares/authAdmin');

// PROTEGER TODO EL ARCHIVO
router.use(authAdmin);

const fs = require('fs');

const uploadPath = path.join(process.cwd(), 'uploads/talleres');

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads/talleres'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const nombreLimpio = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, '_')
      .toLowerCase();

    const unique = Date.now() + '-' + nombreLimpio + ext;

    cb(null, unique);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo imágenes'), false);
  }
};

const upload = multer({ storage, fileFilter });

//  (luego le metemos auth admin)
router.get('/talleres', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM talleres');
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

//  actualizar plan / estado / módulos / descripcion / ubicacion / servicios
router.patch('/talleres/:id', async (req, res) => {
  const { id } = req.params;

  try {

    const campos = req.body;

    // 🔥 si vienen modulos, convertir a JSON
    if (campos.modulos) {
      campos.modulos = JSON.stringify(campos.modulos);
    }

    await db.query(
      `UPDATE talleres SET ? WHERE id = ?`,
      [campos, id]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});


//  CREAR TALLER + USUARIO
router.post('/talleres', async (req, res) => {

  const {
    nombre,
    telefono,
    slug,
    plan,
    estado,
    modulos
  } = req.body;

  if (!nombre || !slug) {
    return res.status(400).json({
      ok:false,
      message:'Nombre y slug son obligatorios'
    });
  }

  try {

    //  password temporal
    const passwordPlano = '123456';
    const passwordHash = await bcrypt.hash(passwordPlano, 10);

    // 1️ crear taller
    await db.query(
      `INSERT INTO talleres
      (nombre, telefono, slug, plan, estado, modulos)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        telefono || null,
        slug,
        plan || 'basico',
        estado || 'activo',
        JSON.stringify(modulos || {
          citas: true,
          landing: true,
          recordatorios: true
        })
      ]
    );

    // 2️ obtener id del taller
    const [tallerCreado] = await db.query(
      'SELECT id FROM talleres WHERE slug = ?',
      [slug]
    );

    const taller_id = tallerCreado[0].id;

    // 3️ crear usuario
    await db.query(
      `INSERT INTO usuarios (taller_id, nombre, email, password, rol)
       VALUES (?, ?, ?, ?, 'admin')`,
      [
        taller_id,
        nombre,
        slug + '@app.com',
        passwordHash
      ]
    );

    res.json({
      ok:true,
      usuario: slug + '@app.com',
      password: passwordPlano //  para que lo veas al crear
    });

  } catch (err) {
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        ok:false,
        message:'Slug ya existe'
      });
    }

    res.status(500).json({ ok:false });
  }
});

router.post('/talleres/:id/upload', upload.single('imagen'), async (req, res) => {
  const { id } = req.params;
  const { tipo } = req.body;

  try {

    //  VALIDACIÓN
    if (!req.file) {
      return res.status(400).json({
        ok:false,
        message:'No se envió archivo'
      });
    }

    const campo = tipo === 'logo' ? 'logo' : 'portada';

    await db.query(
      `UPDATE talleres SET ${campo} = ? WHERE id = ?`,
      [req.file.filename, id]
    );

    res.json({ ok:true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false });
  }
});

module.exports = router;