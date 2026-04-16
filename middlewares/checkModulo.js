module.exports = function(modulo){
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({ ok:false, message:'No autenticado' });
    }

    const modulos = req.user.modulos || {};

    if (!modulos[modulo]) {
      return res.status(403).json({
        ok:false,
        message:`Módulo ${modulo} no disponible en tu plan`
      });
    }

    next();
  };
};