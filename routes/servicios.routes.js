const { Router } = require('express');
const router = Router();
const db = require('../db');
const uploadFotosServicio = require('../middlewares/uploadFotosServicio');
const authTaller = require('../middlewares/authTaller');
const checkEstado = require('../middlewares/checkEstado');

router.use(authTaller, checkEstado);

/*
========================================
POST agregar servicio
========================================
*/
router.post('/', async (req, res) => {
  const { vin, descripcion, fecha_servicio, garantia_meses, kilometraje, unidad, costo } = req.body;
  const taller_id = req.user.taller_id;

  const vinClean = vin.trim().toUpperCase(); 

  if (!vin || !descripcion || !fecha_servicio) {
    return res.status(400).json({ ok: false, message: 'Faltan datos' });
  }

  try {

    //  INICIAR TRANSACCIÓN
    await db.query('START TRANSACTION');

    const [vehiculos] = await db.query(
      'SELECT id FROM vehiculos WHERE vin = ? AND taller_id = ?',
      [vinClean, taller_id]
    );

    if (vehiculos.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Vehículo no registrado' });
    }

    const vehiculo_id = vehiculos[0].id;

    // ==================================
    //  GENERAR FOLIO POR TALLER
    // ==================================

    let [[row]] = await db.query(
      'SELECT ultimo_numero FROM folios WHERE taller_id = ? FOR UPDATE',
      [taller_id]
    );

    if (!row) {
      await db.query(
        'INSERT INTO folios (taller_id, ultimo_numero) VALUES (?, 0)',
        [taller_id]
      );
      row = { ultimo_numero: 0 };
    }

    const siguiente = row.ultimo_numero + 1;

    await db.query(
      'UPDATE folios SET ultimo_numero = ? WHERE taller_id = ?',
      [siguiente, taller_id]
    );

    const folio = `T${taller_id}-${String(siguiente).padStart(6, '0')}`;

    // ==================================
    //  INSERT CON FOLIO
    // ==================================

    const [result] = await db.query(
      `INSERT INTO servicios 
      (vehiculo_id, descripcion, fecha_servicio, garantia_meses, kilometraje, unidad, costo, taller_id, folio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vehiculo_id,
        descripcion,
        fecha_servicio,
        garantia_meses || 0,
        kilometraje || null,
        unidad || null,
        costo || 0,
        taller_id,
        folio
      ]
    );

    //  CONFIRMAR TODO
    await db.query('COMMIT');

    res.status(201).json({ ok: true, id: result.insertId });

  } catch (err) {
    //  SI FALLA ALGO
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error al crear servicio' });
  }
});
/*
========================================
POST subir fotos a servicio
========================================
*/
router.post('/:id/fotos', uploadFotosServicio.array('fotos', 10), async (req, res) => {

  const taller_id = req.user.taller_id;
  const servicioId = req.params.id;

  // VALIDACIÓN DE SEGURIDAD
  const [servicios] = await db.query(
    'SELECT id FROM servicios WHERE id = ? AND taller_id = ?',
    [servicioId, taller_id]
  );

  if (servicios.length === 0) {
    return res.status(403).json({ ok:false, message:'No autorizado' });
  }

  //  lógica sigue igual
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ ok: false, message: 'No se subieron archivos' });
  }

  try {
    for (const file of req.files) {
      await db.query(
        'INSERT INTO fotos_servicio (servicio_id, archivo, taller_id) VALUES (?, ?, ?)',
        [servicioId, file.filename, taller_id]
      );
    }

    res.json({ ok: true, message: 'Fotos guardadas' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error al guardar fotos' });
  }
});
/*
========================================
GET fotos por servicio
========================================
*/
router.get('/:id/fotos', async (req, res) => {
   const taller_id = req.user.taller_id;
  const { id } = req.params;

  try {
    const [fotos] = await db.query(
      'SELECT id, archivo FROM fotos_servicio WHERE servicio_id = ? AND taller_id = ?',
      [id, taller_id]
    );

    res.json({ ok: true, fotos });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, message:'Error al obtener fotos' });
  }
});
/*
========================================
GET servicios + fotos por VIN
========================================
*/
router.get('/vehiculo/:vin', async (req, res) => {
   const taller_id = req.user.taller_id;
  const { vin } = req.params;
  const vinClean = vin.trim().toUpperCase();
  try {
    const [vehiculos] = await db.query(
      'SELECT id FROM vehiculos WHERE vin = ? AND taller_id = ?',
      [vinClean, taller_id]
    );

    if (vehiculos.length === 0) {
      return res.status(404).json({ ok: false, message: 'Vehículo no encontrado' });
    }

    const vehiculo_id = vehiculos[0].id;

    const [servicios] = await db.query(
  `
  SELECT 
    id,
    descripcion,
    fecha_servicio,
    garantia_meses,
    kilometraje,
    unidad,
    costo,
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
  [vehiculo_id , taller_id]
);

    if (servicios.length === 0) {
      return res.json({ ok: true, servicios: [] });
    }

    const ids = servicios.map(s => s.id);
    if (!ids.length) {
  return res.json({ ok: true, servicios: [] });
}

    const [fotos] = await db.query(
  `SELECT id, servicio_id, archivo 
   FROM fotos_servicio 
   WHERE servicio_id IN (${ids.map(() => '?').join(',')})
   AND taller_id = ?`,
  [...ids, taller_id]
);

   const serviciosConFotos = servicios.map(s => ({
  ...s,
  fotos: fotos
    .filter(f => f.servicio_id === s.id)
   .map(f => ({
  id: f.id,
  url: `/uploads/servicios/${s.id}/${f.archivo}`
    }))
}));

    res.json({ ok: true, servicios: serviciosConFotos });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error al obtener servicios' });
  }
});

// DELETE foto de servicio
router.delete('/fotos/:id', async (req, res) => {
   const taller_id = req.user.taller_id;
  const fotoId = req.params.id;

  try {
    // obtener archivo
    const [rows] = await db.query(
      'SELECT archivo, servicio_id FROM fotos_servicio WHERE id = ? AND taller_id = ?',
      [fotoId, taller_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok:false, message:'Foto no encontrada' });
    }

    const { archivo, servicio_id } = rows[0];

    const fs = require('fs');
    const path = require('path');

    const filePath = path.join(__dirname, '../uploads/servicios', String(servicio_id), archivo);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.query('DELETE FROM fotos_servicio WHERE id = ? AND taller_id = ?', [fotoId, taller_id]);

    res.json({ ok:true, message:'Foto eliminada' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, message:'Error al borrar foto' });
  }
});

// ========================================
// GET servicio completo (para imprimir)
// ========================================
router.get('/:id', async (req, res) => {
  const taller_id = req.user.taller_id;
  const { id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        s.*,
        v.id AS vehiculo_id,
        v.marca,
        v.modelo,
        v.anio,
        v.vin,
        c.id AS cliente_id,
        c.nombre AS cliente_nombre,
        c.telefono AS cliente_telefono,
        c.correo AS cliente_correo,
        CASE
          WHEN s.garantia_meses > 0
          AND DATE_ADD(s.fecha_servicio, INTERVAL s.garantia_meses MONTH) >= CURDATE()
          THEN 1
          ELSE 0
        END AS en_garantia
      FROM servicios s
      JOIN vehiculos v ON s.vehiculo_id = v.id
      JOIN clientes c ON v.cliente_id = c.id
      WHERE s.id = ?
      AND s.taller_id = ?
    `, [id, taller_id]);

    if (!rows.length) {
      return res.status(404).json({ ok:false, message:'Servicio no encontrado' });
    }

    res.json({ ok:true, data: rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, message:'Error al obtener servicio' });
  }
});

// ========================================
// 🔍 Buscar servicio por folio
// ========================================
router.get('/folio/:folio', async (req, res) => {
  const taller_id = req.user.taller_id;
  const { folio } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT id FROM servicios WHERE folio = ? AND taller_id = ?',
      [folio, taller_id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok:false, message:'No encontrado' });
    }

    res.json({ ok:true, data: rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false });
  }
});

module.exports = router;