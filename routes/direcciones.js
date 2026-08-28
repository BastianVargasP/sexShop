import {estaAutenticado} from "../middlewares/auth.js";
import * as direccionesController from "../controllers/direccionesController.js";
import express from "express";

const router = express.Router();

router.get('/direcciones', estaAutenticado, direccionesController.listarDirecciones);
router.get('/nueva-direccion', estaAutenticado, direccionesController.formularioNuevaDireccion);
router.post('/nueva-direccion', estaAutenticado, direccionesController.nuevaDireccion);
router.get('/direcciones/:id/editar', estaAutenticado, direccionesController.formularioEditarDireccion);
router.post('/direcciones/:id/editar', estaAutenticado, direccionesController.editarDireccion);
router.post('/direcciones/:id/eliminar', estaAutenticado, direccionesController.eliminarDireccion);
router.post('/direcciones/:id/predeterminada', estaAutenticado, direccionesController.marcarPredeterminada);

export default router;