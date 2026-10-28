
const express = require("express");
const router = express.Router();

const ProductoController = require("../controllers/producto.controller");

router.get("/", ProductoController.listar);
router.post("/", ProductoController.crear);

module.exports = router;
