const { Router } = require('express');
const router = Router();
const db = require('../db');
const authTaller = require('../middlewares/authTaller');
const checkEstado = require('../middlewares/checkEstado');
const checkModulo = require('../middlewares/checkModulo');
const { sendWhatsApp } = require('../services/whatsapp');


function normalizarTelefono(tel) {
  tel = tel.replace(/\D/g, ''); // quita todo lo que no sea número

  if (tel.startsWith('521')) return '+' + tel;
  return '+521' + tel;
}



/*
========================
CITAS DEL PANEL
========================
*/

// GET listar citas del taller
router.get('/',
  authTaller,
  checkEstado,
  checkModulo('citas'),
  async (req, res) => {
  const taller_id = req.user.taller_id;

  try {
    const [results] = await db.query(
      `SELECT * FROM citas 
       WHERE taller_id = ?
       AND estado IN ('pendiente','confirmada','reprogramar')
       ORDER BY 
         COALESCE(fecha_confirmada, fecha_solicitada),
         COALESCE(hora_confirmada, hora_solicitada) ASC`,
      [taller_id]
    );

    res.json({ ok: true, data: results });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: 'Error al obtener citas' });
  }
});
/*
========================
CITA PÚBLICA (LANDING)
========================
*/

router.post('/publica', async (req, res) => {
  try {
    const {
      slug,
      nombre,
      telefono,
      correo,
      fecha_solicitada,
      hora_solicitada,
      mensaje
    } = req.body;

    if (!slug || !nombre || !telefono || !fecha_solicitada || !hora_solicitada) {
      return res.status(400).json({ ok: false, message: 'Faltan datos' });
    }

    const [taller] = await db.query(
  'SELECT id, nombre FROM talleres WHERE slug = ? AND estado = "activo"',
  [slug]
);

if (taller.length === 0) {
  return res.status(404).json({ ok: false, message: 'Taller no encontrado' });
}

const taller_id = taller[0].id;
const nombreTaller = taller[0].nombre;

await db.query(
  `INSERT INTO citas
  (taller_id, nombre, telefono, correo, mensaje, estado, fecha_solicitada, hora_solicitada)
  VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
  [taller_id, nombre, telefono, correo || null, mensaje || null, fecha_solicitada, hora_solicitada]
);

const mensajeWhatsApp = `Hola ${nombre}, hemos recibido tu solicitud de cita en ${nombreTaller}. Pronto te confirmaremos fecha y hora.`;

try {
await sendWhatsApp(normalizarTelefono(telefono), mensajeWhatsApp);} catch (err) {
  console.error('Error enviando WhatsApp:', err);
}

    res.json({ ok: true, message: 'Cita registrada correctamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: 'Error al crear cita' });
  }
});

// Confirmar cita
router.patch('/:id/confirmar',
  authTaller,
  checkEstado,
  checkModulo('citas'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_confirmada, hora_confirmada } = req.body;
    const taller_id = req.user.taller_id;

    if (!fecha_confirmada || !hora_confirmada) {
      return res.status(400).json({ ok: false, message: 'Faltan datos' });
    }

    const [result] = await db.query(
      `UPDATE citas 
       SET estado = 'confirmada',
           fecha_confirmada = ?,
           hora_confirmada = ?
       WHERE id = ? AND taller_id = ?`,
      [fecha_confirmada, hora_confirmada, id, taller_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Cita no encontrada para este taller'
      });
    }

   // whatsapp notification

const [cita] = await db.query(
  'SELECT nombre, telefono FROM citas WHERE id = ?',
  [id]
);
if (!cita.length) {
  return res.status(404).json({ ok:false, message:'Cita no encontrada' });
}
const mensaje = `Hola ${cita[0].nombre}, tu cita en ${req.user.nombre_taller} quedó confirmada para el ${fecha_confirmada} a las ${hora_confirmada}.`;

try {
 await sendWhatsApp(normalizarTelefono(cita[0].telefono), mensaje);
} catch (err) {
  console.error('Error enviando WhatsApp:', err);
  
}

res.json({ ok: true, message: 'Cita confirmada' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: 'Error al confirmar cita' });
  }
});

// Reprogramar cita
router.patch('/:id/reprogramar',
  authTaller,
  checkEstado,
  checkModulo('citas'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const taller_id = req.user.taller_id;

    const [result] = await db.query(
      `UPDATE citas 
       SET estado = 'reprogramar'
       WHERE id = ? AND taller_id = ?`,
      [id, taller_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Cita no encontrada para este taller'
      });
    }
 // DATOS DE LA CITA
    const [cita] = await db.query(
      'SELECT nombre, telefono FROM citas WHERE id = ?',
      [id]
    );

    const mensaje = `Hola ${cita[0].nombre}, por favor contacta al taller Reparaciones el Parra al 6644838112 para reagendar tu cita.`;

    try {
      await sendWhatsApp(normalizarTelefono(cita[0].telefono), mensaje);
    } catch (err) {
      console.error('Error enviando WhatsApp:', err);
    }

    res.json({ ok: true, message: 'Cita marcada para reprogramar' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: 'Error al reprogramar cita' });
  }
});

// Atender cita (convertir en servicio)
router.patch('/:id/atender',
  authTaller,
  checkEstado,
  checkModulo('citas'),
  async (req, res) => {
  try {
    const { id } = req.params;
    const taller_id = req.user.taller_id;

    const [result] = await db.query(
      `UPDATE citas 
       SET estado = 'atendida'
       WHERE id = ? AND taller_id = ?`,
      [id, taller_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Cita no encontrada para este taller'
      });
    }

    res.json({ ok: true, message: 'Cita marcada como atendida' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: 'Error al atender cita' });
  }
});

// Obtener una cita por ID
router.get('/:id',
  authTaller,
  checkEstado,
  checkModulo('citas'),

  async (req, res) => {
  try {
    const { id } = req.params;
    const taller_id = req.user.taller_id;

    const [results] = await db.query(
      `SELECT id, nombre, telefono, correo, mensaje
       FROM citas
       WHERE id = ? AND taller_id = ?`,
      [id, taller_id]
    );

    if (results.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Cita no encontrada'
      });
    }

    res.json({ ok: true, data: results[0] });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: 'Error al obtener cita' });
  }
});

module.exports = router;