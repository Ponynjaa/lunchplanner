import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { kcAdmin, kcConfig } from '../config/keycloak.config.js';
import * as db from '../../database/db.js';

export const getKeycloakId = (req: Request) => {
	const bearerToken = req.headers.authorization ?? '';
	const token = /^Bearer (.*)/.exec(bearerToken)![1];
	const userInfo = jwt.decode(token) as any;
	return userInfo.sub;
}

export const getUserInfosByKeycloakId = async (keycloakId: string) => {
	const result = await db.query(`
		SELECT * FROM users
		WHERE keycloak_id = $1;
	`, [keycloakId]);

	return result.rows[0];
}

export const getKeycloakUserInfo = async (keycloakId: string) => {
	await kcAdmin.auth({
		clientId: 'admin-cli',
		grantType: 'password',
		username: process.env.KC_ADMIN_USERNAME,
		password: process.env.KC_ADMIN_PASSWORD
	});
	return await kcAdmin.users.findOne({ id: keycloakId, realm: kcConfig.realm });
}
