const router = require('express').Router();
const { login, perfil } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.post('/login', login);
router.get('/perfil', verificarToken, perfil);

module.exports = router;