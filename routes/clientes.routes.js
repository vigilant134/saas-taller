const { Router } = require('express');
const router = Router();
const db = require('../db');
const authTaller = require('../middlewares/authTaller');
const checkEstado = require('../middlewares/checkEstado');

router.use(authTaller, checkEstado);
/*
========================================
POST crear cliente
========================================
*/
router.post('/', async (req, res) => {
  const { nombre, telefono, correo } = req.body;
  const taller_id = req.session.user.taller_id;

  if (!nombre || !telefono) {
    return res.status(400).json({ ok:false, message:'Faltan datos' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO clientes (taller_id, nombre, telefono, correo)
       VALUES (?, ?, ?, ?)`,
      [taller_id, nombre, telefono, correo || null]
    );

    res.status(201).json({
      ok: true,
      message: 'Cliente registrado',
      data: {
        id: result.insertId,
        nombre,
        telefono
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, message:'Error al crear cliente' });
  }
});

/*
========================================
GET buscar clientes por nombre
========================================
*/
router.get('/buscar', async (req, res) => {
  const { nombre } = req.query;
  const taller_id = req.session.user.taller_id;

  if (!nombre) {
    return res.status(400).json({ ok:false, message:'Nombre requerido' });
  }

  try {
    const [clientes] = await db.query(
      `SELECT id, nombre, telefono
       FROM clientes
       WHERE nombre LIKE ?
       AND taller_id = ?
       ORDER BY nombre ASC`,
      [`%${nombre}%`, taller_id]
    );

    res.json({ ok:true, clientes });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, message:'Error al buscar clientes' });
  }
});
module.exports = router;