const router = require('express').Router();
const ctrl = require('../controllers/movimiento.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

// Todo el módulo es solo para quien gestiona inventario
router.use(verificarToken, permitirRoles('Administrador', 'Encargado del Inventario'));

router.get('/', ctrl.listar);
router.post('/entrada', ctrl.entrada);
router.post('/ajuste', ctrl.ajuste);

module.exports = router;