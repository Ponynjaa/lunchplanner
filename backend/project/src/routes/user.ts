import express from 'express';
import { uploadUserImage, getUserImage, getUserInfo } from '../controllers/index.js'
import { keycloak } from '../config/keycloak.config.js';

const router = express.Router();

router.post('/user/uploadUserImage/', keycloak.protect(), uploadUserImage);
router.get('/user/getUserImage/', keycloak.protect(), getUserImage);
router.get('/user/getUserInfo/', getUserInfo);

export default router;
