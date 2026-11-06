const router = require('express').Router();
const ctrl = require('../controllers/chat.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

// Cualquier usuario con sesión puede usar el chat; las herramientas se limitan por rol en el servicio
router.post('/', verificarToken, ctrl.conversar);

module.exports = router;