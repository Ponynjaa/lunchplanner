import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import * as db from '../../database/db';
import { takeaway } from '../config/takeaway.config';

export const getAllCustomRestaurants = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const result = await db.query(`
			SELECT r.id AS id, r.name AS name, r.logourl AS logourl, r.city AS city, r.street AS street, r.delivery AS delivery, r.pickup AS pickup, JSON_AGG(
				JSON_BUILD_OBJECT(
					'id', sk.id,
					'description_de', sk.description_de,
					'description_en', sk.description_en
				)
			) AS subkitchens
			FROM lunchplanner.restaurants r
			JOIN lunchplanner.restaurants_subkitchens rs ON r.id = rs.restaurant_id
			JOIN lunchplanner.subkitchens sk ON sk.id = rs.subkitchen_id
			GROUP BY r.id, r.name, r.logourl, r.city, r.street, r.delivery, r.pickup;
		`);
		res.status(200).json(result.rows);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getCustomRestaurantDetails = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.query;
		const result = await db.query(`
			SELECT r.id AS id, r.name AS name, r.logourl AS logourl, r.city AS city, r.street AS street, r.delivery AS delivery, r.pickup AS pickup, JSON_AGG(
				JSON_BUILD_OBJECT(
					'id', sk.id,
					'description_de', sk.description_de,
					'description_en', sk.description_en
				)
			) AS subkitchens
			FROM lunchplanner.restaurants r
			JOIN lunchplanner.restaurants_subkitchens rs ON r.id = rs.restaurant_id
			JOIN lunchplanner.subkitchens sk ON sk.id = rs.subkitchen_id
			WHERE r.id = $1
			GROUP BY r.id, r.name, r.logourl, r.city, r.street, r.delivery, r.pickup;
		`, [id]);
		res.status(200).json(result.rows[0]);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const addCustomRestaurant = async (req: Request, res: Response, next: NextFunction) => {
	const dbClient = await db.getClient();

	try {
		if (!req.files?.image) {
			return res.status(400).send("No image file was sent!");
		}

		const uploadedImage = req.files.image as any;
		const mimeType = uploadedImage.mimetype;
		if (!/^image\//.test(mimeType)) {
			return res.status(400).send("Invalid mime type " + mimeType);
		}

		let { name, city, street, subkitchenIds, delivery, pickup } = req.body as any;
		subkitchenIds = JSON.parse(subkitchenIds);

		await dbClient.query('BEGIN');

		// insert without logourl as the id is being used for the logourl
		const result = await dbClient.query(`
			INSERT INTO lunchplanner.restaurants (
				name, city, street, delivery, pickup
			) VALUES (
				$1, $2, $3, $4, $5
			)
			RETURNING id;
		`, [name, city, street, delivery, pickup]);
		
		const restaurantId = result.rows[0].id;
		const fileExtension = /\.[a-zA-Z]+$/.exec(uploadedImage.name);
		const fileName = `${restaurantId}${fileExtension}`;
		const logoUrl = `${process.env.SERVER_URL}/restaurantImages/${fileName}`;

		// update just inserted row and set logourl
		await dbClient.query(`
			UPDATE lunchplanner.restaurants
			SET logourl = $1
			WHERE id = $2;
		`, [logoUrl, restaurantId]);

		for (const subkitchenId of subkitchenIds) {
			await dbClient.query(`
				INSERT INTO lunchplanner.restaurants_subkitchens (restaurant_id, subkitchen_id) VALUES ($1, $2)
				ON CONFLICT (restaurant_id, subkitchen_id) DO
				UPDATE SET restaurant_id=$1, subkitchen_id=$2;
			`, [
				restaurantId, subkitchenId
			]);
		}

		const restaurantImagesDir = path.join(__dirname, '../../.customRestaurantImages');
		const files = await fsp.readdir(restaurantImagesDir);

		const existingRestaurantImagePath = files.find(file => file.startsWith(`${restaurantId}.`));
		if (existingRestaurantImagePath) {
			fs.rmSync(path.join(restaurantImagesDir, existingRestaurantImagePath));
		}

		const uploadPath = path.join(restaurantImagesDir, fileName);
		await uploadedImage.mv(uploadPath);

		await dbClient.query('COMMIT');

		res.status(200).json({ success: true, restaurantId: restaurantId, logoUrl: logoUrl });
	} catch (err) {
		await dbClient.query('ROLLBACK');
		next(err);
		res.status(400).send(err);
	} finally {
		dbClient.release();
	}
}

export const getAllLieferandoRestaurants = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { postalCode, latitude, longitude } = req.query as any;
		const country = await takeaway.getCountryById('DE');
		const restaurants = await country.getRestaurants(postalCode, latitude, longitude);

		const allSubkitchenIds: Set<number> = new Set();
		for (const restaurant of restaurants) {
			if (!restaurant.subKitchens) {
				continue;
			}

			for (const id of restaurant.subKitchens.ids) {
				allSubkitchenIds.add(id);
			}
		}

		const allSubkitchens = await getSubkitchens(Array.from(allSubkitchenIds));
		const subkitchenMap = new Map();
		for (const subkitchen of allSubkitchens) {
			subkitchenMap.set(subkitchen.id, {
				description_de: subkitchen.description_de,
				description_en: subkitchen.description_en
			});
		}

		const result = restaurants.map((restaurant) => {
			return {
				id: restaurant.id,
				name: restaurant.name,
				logourl: restaurant.logoUrl,
				city: restaurant.address.city,
				street: restaurant.address.street,
				distance: restaurant.distance,
				deliveryMethods: restaurant.deliveryMethods,
				deliveryCosts: restaurant.deliveryCosts,
				estimatedDeliveryTime: restaurant.estimatedDeliveryTime,
				new: restaurant.new,
				open: restaurant.open,
				eta: restaurant.eta,
				ratingCount: restaurant.ratingCount,
				rating: restaurant.rating,
				subkitchens: restaurant.subKitchens?.ids.map((id) => {
					id = parseInt(id.toString());
					return {
						id: id,
						...subkitchenMap.get(id)
					};
				}) ?? []
			};
		});

		res.status(200).json(result);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

const getSubkitchens = async (ids: number[]) => {
	const result = await db.query(`
		SELECT id, description_de, description_en
		FROM lunchplanner.subkitchens
		WHERE id = ANY ($1);
		`, [ids]);

	return result.rows;
}

export const getAllKitchens = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const result = await db.query(`
			SELECT k.id AS id, k.description_de AS description_de, k.description_en AS description_en,
				JSON_AGG(
					JSON_BUILD_OBJECT(
						'id', sk.id,
						'description_de', sk.description_de,
						'description_en', sk.description_en
					)
				) AS subkitchens
			FROM lunchplanner.subkitchens sk
			JOIN lunchplanner.kitchens k ON k.id = sk.kitchen_id
			GROUP BY k.id, k.description_de, k.description_en;
		`);
		res.status(200).json(result.rows);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
