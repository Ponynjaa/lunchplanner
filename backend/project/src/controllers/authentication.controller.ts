import Keycloak from 'keycloak-connect';
import { Request, Response, NextFunction } from 'express';
import kcConfig from '../config/keycloak.config';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { username, password } = req.body;
		const keycloak = new Keycloak({}, kcConfig);

		// const accessToken = await keycloak.accessToken.get('openid');
		res.status(200).send("asdf");
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
