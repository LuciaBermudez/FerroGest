const router = require('express').Router();
const ctrl = require('../controllers/cliente.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

const atiendeClientes = permitirRoles('Administrador', 'Vendedor/Cajero');

router.use(verificarToken);

router.get('/', atiendeClientes, ctrl.listar);
router.get('/:id', atiendeClientes, ctrl.obtener);
router.post('/', atiendeClientes, ctrl.crear);
router.put('/:id', atiendeClientes, ctrl.actualizar);
router.patch('/:id/estado', permitirRoles('Administrador'), ctrl.cambiarEstado);

module.exports = router;