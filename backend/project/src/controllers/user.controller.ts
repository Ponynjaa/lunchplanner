import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fsp from 'fs/promises';
import * as userUtils from '../utils/userinfo.js';

const __dirname = import.meta.dirname;

export const getUserInfo = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.query as any;
		const user = await userUtils.getUserInfo(id);

		res.status(200).json(user);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const uploadUserImage = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const userId = userUtils.getUserId(req);

		if (!req.files?.image) {
			return res.status(400).send("No image file was sent!");
		}

		const uploadedImage = req.files.image as any;
		const mimeType = uploadedImage.mimetype;
		if (!/^image\//.test(mimeType)) {
			return res.status(400).send("Invalid mime type " + mimeType);
		}

		const fileExtension = /\.[a-zA-Z]+$/.exec(uploadedImage.name)![0].toLowerCase();
		const userImagesDir = path.join(__dirname, '../../.userImages');

		const files = await fsp.readdir(userImagesDir);

		const existingUserImagePath = files.find(file => file.startsWith(`${userId}.`));
		if (existingUserImagePath) {
			await fsp.rm(path.join(userImagesDir, existingUserImagePath));
		}

		const uploadPath = path.join(userImagesDir, `${userId}${fileExtension}`);
		await uploadedImage.mv(uploadPath);

		res.status(200).json({ success: true });
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getUserImage = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { userId } = req.query;
		const userImagesDir = path.join(__dirname, '../../.userImages');
		const fallbackImagePath = path.join(userImagesDir, 'fallback.svg');

		const files = await fsp.readdir(userImagesDir);
		const userImageFile = files.find(file => file.startsWith(`${userId}.`));
		const userImagePath = userImageFile ? path.join(userImagesDir, userImageFile) : fallbackImagePath;

		return res.status(200).sendFile(userImagePath);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
