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

  // ==========================
  // VALIDACIONES PRIMERO
  // ==========================
  if (!cliente || !vehiculo || !servicio) {
    return res.status(400).json({ ok: false, message: 'Faltan bloques' });
  }

  if (!cliente.nombre || !cliente.telefono) {
    return res.status(400).json({ ok: false, message: 'Cliente incompleto' });
  }

  if (!vehiculo.vin || typeof vehiculo.vin !== 'string') {
    return res.status(400).json({ ok: false, message: 'VIN obligatorio' });
  }

  if (!servicio.descripcion || !servicio.fecha_servicio) {
    return res.status(400).json({ ok: false, message: 'Servicio incompleto' });
  }

  // ==========================
  // LIMPIAR VIN 
  // ==========================
  const vinClean = vehiculo.vin.trim().toUpperCase();

  if (!vinClean) {
    return res.status(400).json({ ok:false, message:'VIN inválido' });
  }

  // ==========================
  // CONEXIÓN
  // ==========================
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ==========================
    // 1️ CLIENTE (NO DUPLICAR)
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
  [
    taller_id,
    cliente.nombre,
    cliente.telefono,
    cliente.correo || null
  ]
);

cliente_id = resultadoCliente.insertId;
 }

    // ==========================
    // 2️ VEHÍCULO (POR VIN)
    // ==========================
    const [vehiculosExistentes] = await connection.query(
      `SELECT id FROM vehiculos WHERE vin = ? AND taller_id = ?`,
      [vinClean, taller_id]
    );

    let vehiculo_id;

    if (vehiculosExistentes.length > 0) {
      vehiculo_id = vehiculosExistentes[0].id;

      await connection.query(
        `UPDATE vehiculos SET cliente_id = ? WHERE id = ?`,
        [cliente_id, vehiculo_id]
      );

    } else {
      const [resultadoVehiculo] = await connection.query(
        `INSERT INTO vehiculos
         (taller_id, cliente_id, vin, marca, modelo, anio)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          taller_id,
          cliente_id,
          vinClean,
          vehiculo.marca || null,
          vehiculo.modelo || null,
          vehiculo.anio || null
        ]
      );

      vehiculo_id = resultadoVehiculo.insertId;
    }

    // ==========================
    // 3️ SERVICIO
    // ==========================
    const [resultadoServicio] = await connection.query(
      `INSERT INTO servicios
       (taller_id, vehiculo_id, descripcion, costo, fecha_servicio, garantia_meses, kilometraje, unidad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taller_id,
        vehiculo_id,
        servicio.descripcion,
        Number(servicio.costo) || 0,
        servicio.fecha_servicio,
        servicio.garantia_meses || 0,
        servicio.kilometraje || null,
        servicio.unidad || 'km'
      ]
    );

  // ==========================
  // COMMIT
  // ==========================
  await connection.commit();

  return res.json({
    ok: true,
    message: 'Registro completo',
    cliente_id,
    vehiculo_id,
    servicio_id: resultadoServicio.insertId
  });

} catch (error) {
  await connection.rollback();
  console.error(error);

  //  ERROR DE DUPLICADO
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      ok: false,
      message: 'El cliente ya está registrado con ese teléfono'
    });
  }

  return res.status(500).json({
    ok: false,
    message: 'Error al registrar información'
  });

} finally {
  connection.release();
} 
});



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