const router = require('express').Router();
const ctrl = require('../controllers/categoria.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', ctrl.listar);
router.post('/', permitirRoles('Administrador', 'Encargado del Inventario'), ctrl.crear);

module.exports = router;