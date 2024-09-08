import express from 'express';
import { getLocationByAddress } from '../controllers/index.js'
import { keycloak } from '../config/keycloak.config.js';

const router = express.Router();

router.get('/address/getLocationByAddress/', keycloak.protect(), getLocationByAddress);

export default router;
