const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.get('/', verificarToken, permitirRoles('Administrador'), ctrl.obtener);

module.exports = router;