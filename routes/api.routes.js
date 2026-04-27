const { Router } = require('express');
const router = Router();
const db = require('../db');
const authTaller = require('../middlewares/authTaller');
const checkEstado = require('../middlewares/checkEstado');

router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API funcionando correctamente'
  });
});

router.post('/registro-nuevo',
  authTaller,
  checkEstado,
  async (req, res) => {

  const { cliente, vehiculo, servicio } = req.body;
  const taller_id = req.user.taller_id;

  if (
  !cliente ||
  !vehiculo ||
  !servicio ||
  !servicio.descripcion ||
  !vehiculo.vin
) {
  return res.status(400).json({ ok: false, message: 'Datos incompletos' });
}

  const vinClean = vehiculo.vin.trim().toUpperCase();

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ==========================
    // CLIENTE
    // ==========================
    const [clientes] = await connection.query(
      `SELECT id FROM clientes WHERE telefono = ? AND taller_id = ?`,
      [cliente.telefono, taller_id]
    );

    let cliente_id;

    if (clientes.length > 0) {
      cliente_id = clientes[0].id;
    } else {
      const [resultadoCliente] = await connection.query(
        `INSERT INTO clientes (taller_id, nombre, telefono, email)
         VALUES (?, ?, ?, ?)`,
        [taller_id, cliente.nombre, cliente.telefono, cliente.correo || null]
      );
      cliente_id = resultadoCliente.insertId;
    }

    // ==========================
    // VEHÍCULO
    // ==========================
    const [vehiculosExistentes] = await connection.query(
      `SELECT id FROM vehiculos WHERE vin = ? AND taller_id = ?`,
      [vinClean, taller_id]
    );

    let vehiculo_id;

    if (vehiculosExistentes.length > 0) {
      vehiculo_id = vehiculosExistentes[0].id;
    } else {
      const [resultadoVehiculo] = await connection.query(
        `INSERT INTO vehiculos (taller_id, cliente_id, vin, marca, modelo, anio)
VALUES (?, ?, ?, ?, ?, ?)`,
        [
  taller_id,
  cliente_id,
  vinClean,
  vehiculo.marca || '',
  vehiculo.modelo || '',
  vehiculo.anio || null
]
      );
      vehiculo_id = resultadoVehiculo.insertId;
    }

    // ==========================
    //  GENERAR FOLIO
    // ==========================
    const [count] = await connection.query(
      `SELECT COUNT(*) AS total FROM servicios WHERE taller_id = ?`,
      [taller_id]
    );

    const siguiente = count[0].total + 1;
    const folio = `T${taller_id}-${String(siguiente).padStart(6, '0')}`;

    // ==========================
    //  SERVICIO COMPLETO
    // ==========================
    console.log('DESCRIPCION:', servicio.descripcion);
    const [resultadoServicio] = await connection.query(
      `INSERT INTO servicios
       (
         taller_id,
         vehiculo_id,
         descripcion,
         costo,
         fecha_servicio,
         kilometraje,
         unidad,
         garantia_meses,
         folio
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taller_id,
        vehiculo_id,
        servicio.descripcion,
        Number(servicio.costo) || 0,
        servicio.fecha_servicio,
        Number(servicio.kilometraje) || 0,
        servicio.unidad || 'km',
        Number(servicio.garantia_meses) || 0,
        folio
      ]
    );

    await connection.commit();

    res.json({
      ok: true,
      servicio_id: resultadoServicio.insertId
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ ok: false });

  } finally {
    connection.release();
  }
});


//  ENDPOINT TALLER (YA CORRECTO)
router.get('/taller/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT * FROM talleres WHERE slug = ? LIMIT 1`,
      [slug]
    );

    if (!rows.length) {
      return res.json({ ok: false });
    }

    res.json({ ok: true, taller: rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;