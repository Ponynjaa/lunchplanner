import { Request, Response, NextFunction } from 'express';
import * as imageUtils from '../utils/image.js';
import * as userUtils from '../utils/user.js';
import * as db from '../../database/db.js';

const createUser = async (keycloakId: string, firstName: string, lastName: string) => {
	const initials = firstName.substring(0, 1).toUpperCase() + lastName.substring(0, 1).toUpperCase();
	const image = imageUtils.createImage(initials);

	const result = await db.query(`
		INSERT INTO users (keycloak_id, first_name, last_name, image)
		VALUES ($1, $2, $3, $4)
		RETURNING id;
	`, [keycloakId, firstName, lastName, image]);

	return { id: result.rows[0].id, image };
}

export const getUserInfo = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.query as any;
		const user = await userUtils.getKeycloakUserInfo(id);

		res.status(200).json(user);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const uploadUserImage = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const userId = userUtils.getKeycloakId(req);

		if (!req.files?.image) {
			return res.status(400).send("No image file was sent!");
		}

		const uploadedImage = req.files.image as any;
		const mimeType = uploadedImage.mimetype;
		if (!/^image\//.test(mimeType)) {
			return res.status(400).send("Invalid mime type " + mimeType);
		}

		await db.query(`
			UPDATE users
			SET image = $1
			WHERE keycloak_id = $2;
		`, [uploadedImage.data, userId]);

		res.status(200).json({ success: true });
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getUserImage = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const userId = req.query.userId as string;
		const keycloakId = req.query.keycloakId as string;

		const result = await db.query(`
			SELECT image FROM users
			WHERE id = $1 OR keycloak_id = $2;
		`, [userId, keycloakId]);

		let image = result.rows[0]?.image;

		if (result.rows.length === 0) {
			const info = (await userUtils.getKeycloakUserInfo(keycloakId))!;
			const user = await createUser(keycloakId, info.firstName!, info.lastName!);
			image = user.image;
		}

		return res.status(200).send(image);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
