import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

export const uploadUserImage = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const bearerToken = req.headers.authorization ?? '';
		const token = /^Bearer (.*)/.exec(bearerToken)?.[1];
		if (!token) {
			return res.status(401).send("Invalid Bearer token!");
		}

		const userInfo = jwt.decode(token) as any;
		const userId = userInfo.sub;

		if (!req.files?.image) {
			return res.status(400).send("No image file was sent!");
		}

		const uploadedImage = req.files.image as any;
		const mimeType = uploadedImage.mimetype;
		if (!/^image\//.test(mimeType)) {
			return res.status(400).send("Invalid mime type " + mimeType);
		}

		const fileExtension = /\.[a-zA-Z]+$/.exec(uploadedImage.name);
		const userImagesDir = path.join(__dirname, '../../.userImages');

		fs.readdir(userImagesDir, async (err, files) => {
			if (err) {
				return next(err);
			}

			const existingUserImagePath = files.find(file => file.startsWith(`${userId}.`));
			if (existingUserImagePath) {
				fs.rmSync(path.join(userImagesDir, existingUserImagePath));
			}

			const uploadPath = path.join(userImagesDir, `${userId}${fileExtension}`);
			await uploadedImage.mv(uploadPath);
	
			res.status(200).json({ success: true });
		});

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

		fs.readdir(userImagesDir, (err, files) => {
			if (err) {
				return next(err);
			}

			const userImageFile = files.find(file => file.startsWith(`${userId}.`));
			const userImagePath = userImageFile ? path.join(userImagesDir, userImageFile) : fallbackImagePath;

			return res.status(200).sendFile(userImagePath);
		});
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
