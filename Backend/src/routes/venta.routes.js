const router = require('express').Router();
const ctrl = require('../controllers/venta.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

const puedeVender = permitirRoles('Administrador', 'Vendedor/Cajero');

router.use(verificarToken);

router.post('/', puedeVender, ctrl.crear);
router.get('/', puedeVender, ctrl.listar);
router.get('/:id', puedeVender, ctrl.obtener);
router.post('/:id/anular', permitirRoles('Administrador'), ctrl.anular);

module.exports = router;