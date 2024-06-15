import { Request, Response, NextFunction } from 'express';
import * as db from '../../database/db';
import { takeaway } from '../config/takeaway.config';

export const getAllCustomRestaurants = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const result = await db.query(`
			SELECT r.id AS id, r.name AS name, r.logourl AS logourl, r.city AS city, r.street AS street, JSON_AGG(
				JSON_BUILD_OBJECT(
					'id', sk.id,
					'description_de', sk.description_de,
					'description_en', sk.description_en
				)
			) AS subkitchens
			FROM lunchplanner.restaurants r
			JOIN lunchplanner.restaurants_subkitchens rs ON r.id = rs.restaurant_id
			JOIN lunchplanner.subkitchens sk ON sk.id = rs.subkitchen_id
			GROUP BY r.id, r.name, r.logourl, r.city, r.street;
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
			SELECT r.id AS id, r.name AS name, r.logourl AS logourl, r.city AS city, r.street AS street, JSON_AGG(
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
			GROUP BY r.id, r.name, r.logourl, r.city, r.street;
		`, [id]);
		res.status(200).json(result.rows[0]);
	} catch (err) {
		next(err);
		res.status(400).send(err);
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

export const getCurrentlyUsedKitchens = async (req: Request, res: Response, next: NextFunction) => {
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
			WHERE sk.id IN (
				SELECT rs.subkitchen_id
				FROM lunchplanner.restaurants_subkitchens rs
			)
			GROUP BY k.id, k.description_de, k.description_en;
		`);
		res.status(200).json(result.rows);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
