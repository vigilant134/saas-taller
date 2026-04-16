const db = require('../db');

module.exports = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      ok: false,
      mensaje: 'No autenticado'
    });
  }

  const taller_id = req.session.user.taller_id;

  const [rows] = await db.query(
    'SELECT id, nombre, estado, plan, modulos FROM talleres WHERE id = ?',
    [taller_id]
  );

  if (!rows.length) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Taller no encontrado'
    });
  }

  req.user = {
  id: rows[0].id,
  taller_id: rows[0].id,
  estado: rows[0].estado,
  plan: rows[0].plan,
  modulos: typeof rows[0].modulos === 'string'
    ? JSON.parse(rows[0].modulos)
    : (rows[0].modulos || {}),
  nombre_taller: rows[0].nombre
};

  next();
};