const router = require('express').Router();
const ctrl = require('../controllers/usuario.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

// Todo el módulo es solo para administradores
router.use(verificarToken, permitirRoles('Administrador'));

router.get('/roles', ctrl.roles);
router.get('/', ctrl.listar);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.patch('/:id/estado', ctrl.cambiarEstado);
router.patch('/:id/contrasena', ctrl.cambiarContrasena);

module.exports = router;