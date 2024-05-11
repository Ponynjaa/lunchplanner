import { Request, Response, NextFunction } from 'express';
import Keycloak from 'keycloak-connect';
import keycloakConfig from '../config/keycloak.config';

const authenticationMiddleware = async (req: Request, res: Response, next: NextFunction, roles: string[] = []) => {
	try {
		const authHeader = req.headers['authorization'] || '';
		const token = authHeader.replace('Bearer ', '');
		const keycloak = new Keycloak({}, keycloakConfig);

		console.log(token);
		// const data = await keycloak.jwt.verify(token);
		// const verified = !data.isExpired() && roles.every((role) => {
		// 	return data.hasRealmRole(role);
		// });
		// console.log(data.isExpired())

		if (true) {
			// res.setHeader('authorization', await keycloak.accessToken.get('openid'));
			next();
		} else {
			res.status(401).json({ message: 'Unauthorized' });
		}
	} catch (error) {
		next(error);
		res.status(401).json({ message: 'Unauthorized' });
	}
};

export default authenticationMiddleware;
