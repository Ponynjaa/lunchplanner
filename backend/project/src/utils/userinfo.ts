import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { kcAdmin, kcConfig } from '../config/keycloak.config.js';

export const getUserId = (req: Request) => {
	const bearerToken = req.headers.authorization ?? '';
	const token = /^Bearer (.*)/.exec(bearerToken)![1];
	const userInfo = jwt.decode(token) as any;
	return userInfo.sub;
}

export const getUserInfo = async (id: string) => {
	await kcAdmin.auth({
		clientId: 'admin-cli',
		grantType: 'password',
		username: process.env.KC_ADMIN_USERNAME,
		password: process.env.KC_ADMIN_PASSWORD
	});
	return await kcAdmin.users.findOne({ id: id, realm: kcConfig.realm });
}
