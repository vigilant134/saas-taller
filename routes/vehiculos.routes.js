const { Router } = require('express');
const router = Router();
const db = require('../db');
const authTaller = require('../middlewares/authTaller');
const checkEstado = require('../middlewares/checkEstado');

router.use(authTaller, checkEstado);

// GET vehículos por cliente
router.get('/cliente/:id', async (req, res) => {
  const { id } = req.params;
  const taller_id = req.user.taller_id;

  try {
    const [vehiculos] = await db.query(
      `SELECT id, vin, marca, modelo, anio 
       FROM vehiculos 
       WHERE cliente_id = ?
       AND taller_id = ?`,
      [id, taller_id]
    );

    res.json({ ok: true, vehiculos });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, message:'Error al buscar vehículos' });
  }
});
/*
========================================
GET servicios por vehículo (HISTORIAL)
========================================
*/
router.get('/:vehiculoId/servicios', async (req, res) => {
  const { vehiculoId } = req.params;
  const taller_id = req.user.taller_id;

  try {
    const [servicios] = await db.query(
      `
      SELECT
        id,
        descripcion,
        costo,
        fecha_servicio,
        kilometraje,
        unidad,
        garantia_meses,
        CASE
          WHEN garantia_meses > 0
           AND DATE_ADD(fecha_servicio, INTERVAL garantia_meses MONTH) >= CURDATE()
          THEN 1
          ELSE 0
        END AS en_garantia
      FROM servicios
      WHERE vehiculo_id = ?
      AND taller_id = ?
      ORDER BY fecha_servicio DESC
      `,
      [vehiculoId, taller_id]
    );

    res.json(servicios);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener servicios' });
  }
});

/*
========================================
GET verificar garantía vigente por VIN
========================================
*/
router.get('/:vin/garantia', async (req, res) => {
  const { vin } = req.params;
  const taller_id = req.user.taller_id;

  try {
    const [rows] = await db.query(
      'SELECT id FROM vehiculos WHERE vin = ? AND taller_id = ?',
      [vin, taller_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Vehículo no registrado'
      });
    }

    const vehiculo_id = rows[0].id;

    const [servicios] = await db.query(
      `
      SELECT
        id,
        descripcion,
        fecha_servicio,
        garantia_meses,
        DATE_ADD(fecha_servicio, INTERVAL garantia_meses MONTH) AS vence_en
      FROM servicios
      WHERE vehiculo_id = ?
        AND taller_id = ?
        AND garantia_meses > 0
        AND DATE_ADD(fecha_servicio, INTERVAL garantia_meses MONTH) >= CURDATE()
      ORDER BY vence_en DESC
      `,
      [vehiculo_id, taller_id]
    );

    res.json({
      ok: true,
      garantia_vigente: servicios.length > 0,
      servicios_en_garantia: servicios
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: 'Error al calcular garantía'
    });
  }
});

/*
========================================
GET vehículo por VIN + historial
========================================
*/
router.get('/:vin', async (req, res) => {
  const { vin } = req.params;
  const taller_id = req.user.taller_id;

  try {
    const [vehiculos] = await db.query(
      'SELECT id, vin FROM vehiculos WHERE vin = ? AND taller_id = ?',
      [vin, taller_id]
    );

    if (vehiculos.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Vehículo no registrado'
      });
    }

    const vehiculo = vehiculos[0];

    const [servicios] = await db.query(
      `
      SELECT
        id,
        descripcion,
        fecha_servicio,
        garantia_meses,
        kilometraje,
        unidad,
        CASE
          WHEN garantia_meses > 0
           AND DATE_ADD(fecha_servicio, INTERVAL garantia_meses MONTH) >= CURDATE()
          THEN 1
          ELSE 0
        END AS en_garantia
      FROM servicios
      WHERE vehiculo_id = ?
      AND taller_id = ?
      ORDER BY fecha_servicio DESC
      `,
      [vehiculo.id, taller_id]
    );

    const [garantia] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM servicios
      WHERE vehiculo_id = ?
        AND taller_id = ?
        AND garantia_meses > 0
        AND DATE_ADD(fecha_servicio, INTERVAL garantia_meses MONTH) >= CURDATE()
      `,
      [vehiculo.id, taller_id]
    );

    res.json({
      ok: true,
      vehiculo,
      servicios,
      garantia_vigente: garantia[0].total > 0
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: 'Error al obtener historial'
    });
  }
});

/*
========================================
POST registrar vehículo por VIN
========================================
*/

router.post('/', async (req, res) => {

  const { vin, marca, modelo, anio, cliente_id } = req.body;
  const taller_id = req.user.taller_id;

  if (!vin) {
    return res.status(400).json({
      ok: false,
      message: 'VIN es obligatorio'
    });
  }

  try {
    const vinClean = vin.trim().toUpperCase();

    // validar duplicado
    const [rows] = await db.query(
      'SELECT id FROM vehiculos WHERE vin = ? AND taller_id = ?',
      [vinClean, taller_id]
    );

    if (rows.length > 0) {
      return res.status(409).json({
        ok: false,
        message: 'El VIN ya existe en este taller'
      });
    }


const [result] = await db.query(
  `INSERT INTO vehiculos 
  (vin, marca, modelo, anio, cliente_id, taller_id)
  VALUES (?, ?, ?, ?, ?, ?)`,
  [
    vinClean,
    marca ? marca.trim() : null,
    modelo ? modelo.trim() : null,
    anio ? parseInt(anio) : null,
    cliente_id ? parseInt(cliente_id) : null,
    taller_id
  ]
);

    res.status(201).json({
      ok: true,
      id: result.insertId
    });

  } catch (error) {
    console.error(error);
    console.error('ERROR VEHICULO:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al crear vehículo'
    });
  }
});

module.exports = router;