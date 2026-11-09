const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/', verificarToken, ctrl.obtener);

module.exports = router;