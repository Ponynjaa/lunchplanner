import { Request } from 'express';
import jwt from 'jsonwebtoken';

export const getUserId = (req: Request) => {
	const bearerToken = req.headers.authorization ?? '';
	const token = /^Bearer (.*)/.exec(bearerToken)![1];
	const userInfo = jwt.decode(token) as any;
	return userInfo.sub;
}
