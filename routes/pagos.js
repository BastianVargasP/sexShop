import express from 'express';
import * as pagosController from '../controllers/pagosController.js';
import { estaAutenticado } from '../middlewares/auth.js';

const router = express.Router();

router.get('/pagos', estaAutenticado, pagosController.listar);
router.get('/nuevo-metodo-pago', estaAutenticado, pagosController.mostrarFormularioNuevo);
router.post('/nuevo-metodo-pago', estaAutenticado, pagosController.crear);
router.get('/pagos/:id/editar', estaAutenticado, pagosController.mostrarFormularioEditar);
router.post('/pagos/:id/editar', estaAutenticado, pagosController.editar);
router.post('/pagos/:id/eliminar', estaAutenticado, pagosController.eliminar);
router.post('/pagos/:id/predeterminada', estaAutenticado, pagosController.marcarPredeterminado);

export default router;