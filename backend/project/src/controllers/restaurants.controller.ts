import { Request, Response, NextFunction } from 'express';
import * as db from '../../database/db';

export const getAllRestaurants = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const result = await db.query(`
			SELECT r.id AS id, r.name AS name, r.logourl AS logourl, r.city AS city, r.street AS street, ARRAY_AGG(sk.description_de) AS subkitchens
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

export const getRestaurantById = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.query;
		const result = await db.query(`
			WITH subkitchens_agg AS (
				SELECT r.id AS restaurant_id, k.description_de AS kitchen_description, json_agg(sk.description_de) AS subkitchens_array
				FROM lunchplanner.restaurants r
				JOIN lunchplanner.restaurants_subkitchens rs ON r.id = rs.restaurant_id
				JOIN lunchplanner.subkitchens sk ON sk.id = rs.subkitchen_id
				JOIN lunchplanner.kitchens k ON k.id = sk.kitchen_id
				GROUP BY r.id, k.description_de
			)
			SELECT r.id AS id, r.name AS name, r.logourl AS logourl, r.city AS city, r.street AS street,
				json_object_agg(
					s.kitchen_description,
					s.subkitchens_array
				) AS kitchens
			FROM lunchplanner.restaurants r
			JOIN subkitchens_agg s ON r.id = s.restaurant_id
			WHERE r.id = $1
			GROUP BY r.id, r.name, r.logourl, r.city, r.street;
		`, [id]);
		res.status(200).json(result.rows[0]);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getAllKitchens = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const result = await db.query(`
			SELECT k.description_de AS description, ARRAY_AGG(sk.description_de) AS subkitchens
			FROM lunchplanner.subkitchens sk
			JOIN lunchplanner.kitchens k ON k.id = sk.kitchen_id
			GROUP BY k.description_de;
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
			SELECT k.description_de AS description, ARRAY_AGG(sk.description_de) AS subkitchens
			FROM lunchplanner.subkitchens sk
			JOIN lunchplanner.kitchens k ON k.id = sk.kitchen_id
			WHERE sk.id IN (
				SELECT rs.subkitchen_id
				FROM lunchplanner.restaurants_subkitchens rs
			)
			GROUP BY k.description_de;
		`);
		res.status(200).json(result.rows);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
