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

  if (!cliente || !vehiculo || !servicio) {
    return res.status(400).json({ ok: false, message: 'Faltan bloques' });
  }

  const vinClean = vehiculo.vin.trim().toUpperCase();

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

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

    const [vehiculosExistentes] = await connection.query(
      `SELECT id FROM vehiculos WHERE vin = ? AND taller_id = ?`,
      [vinClean, taller_id]
    );

    let vehiculo_id;

    if (vehiculosExistentes.length > 0) {
      vehiculo_id = vehiculosExistentes[0].id;
    } else {
      const [resultadoVehiculo] = await connection.query(
        `INSERT INTO vehiculos (taller_id, cliente_id, vin)
         VALUES (?, ?, ?)`,
        [taller_id, cliente_id, vinClean]
      );
      vehiculo_id = resultadoVehiculo.insertId;
    }

    const [resultadoServicio] = await connection.query(
      `INSERT INTO servicios
       (taller_id, vehiculo_id, descripcion, costo, fecha_servicio)
       VALUES (?, ?, ?, ?, ?)`,
      [
        taller_id,
        vehiculo_id,
        servicio.descripcion,
        Number(servicio.costo) || 0,
        servicio.fecha_servicio
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
    connection.release(); // 🔥 ESTO FALTABA
  }
});


// 🔥 ENDPOINT TALLER (YA CORRECTO)
router.get('/taller/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    console.log("SLUG:", slug);

    const [rows] = await db.query(
      `SELECT * FROM talleres`,
    );

    console.log("TODOS LOS TALLERES:", rows);

    return res.json({
      ok: true,
      total: rows.length,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;