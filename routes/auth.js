import express from 'express';
import * as authController from '../controllers/authController.js';
import { estaAutenticado, esInvitado } from '../middlewares/auth.js';

const router = express.Router();

router.get('/login', esInvitado, authController.mostrarLogin);
router.get('/registro', esInvitado, authController.mostrarRegistro);
router.post('/login', authController.procesarLogin);
router.post('/registro', authController.procesarRegistro);
router.get('/logout', authController.procesarLogout);

export default router;