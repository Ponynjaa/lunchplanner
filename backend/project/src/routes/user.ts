import express from 'express';
import { uploadUserImage, getUserImage } from '../controllers/index'
import { keycloak } from '../config/keycloak.config';

const router = express.Router();

router.post('/user/uploadUserImage/', keycloak.protect(), uploadUserImage);
router.get('/user/getUserImage/', keycloak.protect(), getUserImage);

export default router;
