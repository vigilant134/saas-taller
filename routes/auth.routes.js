const { Router } = require('express');
const router = Router();
const db = require('../db');
const bcrypt = require('bcrypt');   //  FALTABA ESTO

bcrypt.hash('123456', 10).then(hash => console.log(hash));

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM usuarios WHERE email = ? AND estado = "activo"',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const user = users[0];

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const [talleres] = await db.query(
      'SELECT id, nombre, plan, estado FROM talleres WHERE id = ?',
      [user.taller_id]
    );

    if (talleres.length === 0) {
      return res.status(401).json({ message: 'Taller no encontrado' });
    }

    const taller = talleres[0];

    if (taller.estado !== 'activo') {
      return res.status(403).json({ message: 'Taller bloqueado' });
    }

  // 🔥 guardar sesión
req.session.user = {
  user_id: user.id,
  taller_id: taller.id,
  plan: taller.plan,
  rol: user.rol
};

// 🔒 respuesta única
return res.json({
  ok: true,
  message: 'Login correcto',
  cambiarPassword: user.cambiar_password === 1,
  taller: {
    id: taller.id,
    nombre: taller.nombre,
    plan: taller.plan
  }
});

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ ok:false });
  }

  res.json({
    ok: true,
    user: req.session.user
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});



router.post('/cambiar-password', async (req, res) => {
  try {
    const { nueva } = req.body;

    if (!req.session || !req.session.user) {
      return res.status(401).json({
        ok:false,
        message:'No autenticado'
      });
    }

    if (!nueva || nueva.length < 6) {
      return res.json({
        ok:false,
        message:'Mínimo 6 caracteres'
      });
    }

    const user_id = req.session.user.user_id;

    const hash = await bcrypt.hash(nueva, 10);

    await db.query(
      'UPDATE usuarios SET password = ?, cambiar_password = 0 WHERE id = ?',
      [hash, user_id]
    );

    res.json({
      ok:true,
      message:'Contraseña actualizada'
    });

  } catch (err) {
    console.error('ERROR CAMBIAR PASSWORD:', err);
    res.status(500).json({ ok:false });
  }
});




module.exports = router;