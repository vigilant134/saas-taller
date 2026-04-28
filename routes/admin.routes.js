const { Router } = require('express');
const router = Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const uploadCloud = require('../middlewares/uploadFotosServicio');

// IMPORTAR MIDDLEWARE
const authAdmin = require('../middlewares/authAdmin');

// PROTEGER TODO EL ARCHIVO
router.use(authAdmin);

// ============================
// OBTENER TALLERES
// ============================
router.get('/talleres', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM talleres');
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// ============================
// ACTUALIZAR TALLER
// ============================
router.patch('/talleres/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const campos = req.body;

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

// ============================
// CREAR TALLER + USUARIO
// ============================
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

    const passwordPlano = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(passwordPlano, 10);

    // crear taller
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

    const [tallerCreado] = await db.query(
      'SELECT id FROM talleres WHERE slug = ?',
      [slug]
    );

    const taller_id = tallerCreado[0].id;

    // crear usuario
    await db.query(
      `INSERT INTO usuarios (taller_id, nombre, email, password, rol)
       VALUES (?, ?, ?, ?, 'operador')`,
      [
        taller_id,
        nombre,
        slug + '-' + Date.now() + '@app.com',
        passwordHash
      ]
    );

    res.json({
      ok:true,
      usuario: slug + '@app.com',
      password: passwordPlano
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

// ============================
// SUBIR LOGO / PORTADA (CLOUDINARY)
// ============================
router.post('/talleres/:id/upload', (req, res) => {

  uploadCloud.single('imagen')(req, res, async (err) => {

    if (err) {
      console.error("ERROR CLOUDINARY:", err);
      return res.status(500).json({ ok:false });
    }

    const { id } = req.params;
    const { tipo } = req.body;

    if (!req.file) {
      return res.status(400).json({
        ok:false,
        message:'No se envió archivo'
      });
    }

    const campo = tipo === 'logo' ? 'logo' : 'portada';

    try {

      await db.query(
        `UPDATE talleres SET ${campo} = ? WHERE id = ?`,
        [req.file.path, id]
      );

      console.log("IMG CLOUDINARY:", req.file.path);

      res.json({ ok:true });

    } catch (err) {
      console.error("ERROR DB:", err);
      res.status(500).json({ ok:false });
    }

  });

});

// ============================
// LISTAR USUARIOS
// ============================
router.get('/usuarios', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.id,
        u.nombre,
        u.email,
        u.rol,
        u.estado,
        t.nombre AS taller,
        t.slug
      FROM usuarios u
      JOIN talleres t ON u.taller_id = t.id
      ORDER BY u.id DESC
    `);

    res.json({
      ok: true,
      usuarios: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;