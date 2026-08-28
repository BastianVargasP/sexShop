import express from 'express';
import * as perfilController from '../controllers/perfilController.js';
import { estaAutenticado } from '../middlewares/auth.js';

const router = express.Router();

router.get('/perfil', estaAutenticado, perfilController.verPerfil);
router.post('/perfil', estaAutenticado, perfilController.actualizarPerfil);

export default router;