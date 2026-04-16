function checkEstado(req, res, next){
  if(req.user.estado !== 'activo'){
    return res.status(403).json({
      ok:false,
      message:'Taller inactivo. Contacte a su proveedor.'
    });
  }
  next();
}

module.exports = checkEstado;