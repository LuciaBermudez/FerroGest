const router = require('express').Router();
const ctrl = require('../controllers/producto.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

const puedeGestionar = permitirRoles('Administrador', 'Encargado del Inventario');

router.use(verificarToken); // todas las rutas exigen sesión

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', puedeGestionar, ctrl.crear);
router.put('/:id', puedeGestionar, ctrl.actualizar);
router.patch('/:id/estado', puedeGestionar, ctrl.cambiarEstado);

module.exports = router;