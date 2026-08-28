import express from "express";
import * as favoritoController from "../controllers/favoritosController.js";
import {estaAutenticado} from "../middlewares/auth.js";

const router = express.Router();

router.get('/favoritos', estaAutenticado, favoritoController.listarFavoritos);

export default router;