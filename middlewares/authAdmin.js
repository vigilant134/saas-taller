module.exports = (req, res, next) => {

  if (!req.session || !req.session.user) {
    return res.status(401).json({
      ok:false,
      message:'No autenticado'
    });
  }

  if (req.session.user.rol !== 'admin') {
    return res.status(403).json({
      ok:false,
      message:'Sin permisos'
    });
  }

  next();
};