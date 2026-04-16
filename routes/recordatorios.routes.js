const { Router } = require('express');
const router = Router();
const db = require('../db');
const authTaller = require('../middlewares/authTaller');
const checkEstado = require('../middlewares/checkEstado');
const checkModulo = require('../middlewares/checkModulo');
router.use(authTaller, checkEstado, checkModulo('recordatorios'));

// Crear recordatorio
router.post('/', async (req, res) => {

  const {
    nombre_cliente,
    telefono,
    correo,
    vehiculo,
    servicio,
    fecha_recordatorio
  } = req.body;

  if (!nombre_cliente || !fecha_recordatorio) {
    return res.status(400).json({
      ok: false,
      message: 'Nombre y fecha son obligatorios'
    });
  }

  try {

    //  VALIDACIÓN DUPLICADO AQUÍ
    const [existe] = await db.query(
      `SELECT id FROM recordatorios 
       WHERE telefono = ? 
       AND fecha_recordatorio = ?
       AND taller_id = ?`,
      [telefono, fecha_recordatorio, req.user.taller_id]
    );

    if (existe.length) {
      return res.json({ ok:true, message:'Ya existe recordatorio' });
    }

    // 🔥 INSERT
    await db.query(
  `INSERT INTO recordatorios
   (taller_id, nombre_cliente, telefono, correo, vehiculo, servicio, fecha_recordatorio, estado)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    req.user.taller_id,
    nombre_cliente,
    telefono || null,
    correo || null,
    vehiculo || null,
    servicio || null,
    fecha_recordatorio,
    'pendiente'
  ]
);

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});
// Obtener recordatorios pendientes (hoy y futuro)
router.get('/pendientes', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM recordatorios
       WHERE taller_id = ?
       AND estado = 'pendiente'
       AND fecha_recordatorio >= CURDATE()
       ORDER BY fecha_recordatorio ASC`,
      [req.user.taller_id]
    );

    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, data: [] });
  }
}); 

// Eliminar recordatorio
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      'DELETE FROM recordatorios WHERE id = ? AND taller_id = ?',
      [id, req.user.taller_id]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;