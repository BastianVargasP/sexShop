import express from "express";
import * as pedidosController from "../controllers/pedidosController.js";
import {estaAutenticado} from "../middlewares/auth.js";

const router = express.Router();

router.get('/pedidos', estaAutenticado, pedidosController.listarPedidos);
router.get('/pedidos/:id', estaAutenticado, pedidosController.verPedido);

export default router;