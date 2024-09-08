import express from 'express';
import { createGroup, deleteGroup, editImage, getGroups, joinGroup, getInvitationInfos, createGroupInviteLink } from '../controllers/index.js'
import { keycloak } from '../config/keycloak.config.js';

const router = express.Router();

router.get('/group/getGroups/', keycloak.protect(), getGroups);
router.get('/group/getInvitationInfos/', keycloak.protect(), getInvitationInfos);
router.get('/group/getInviteLink/', keycloak.protect(), createGroupInviteLink);
router.post('/group/joinGroup/', keycloak.protect(), joinGroup);
router.post('/group/createGroup/', keycloak.protect(), createGroup);
router.put('/group/editImage/', keycloak.protect(), editImage);
router.delete('/group/deleteGroup/', keycloak.protect(), deleteGroup);

export default router;
