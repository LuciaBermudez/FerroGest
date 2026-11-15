const router = require('express').Router();
const { login, perfil } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { limitarLogin } = require('../middlewares/loginRateLimit.middleware');

router.post('/login', limitarLogin, login);
router.get('/perfil', verificarToken, perfil);

module.exports = router;