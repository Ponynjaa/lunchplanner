import { Request, Response, NextFunction } from 'express';
import * as db from '../../database/db';

export const getAllRestaurants = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const result = await db.query(`SELECT * FROM lunchplanner.restaurants;`);
		res.status(200).json(result.rows);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getRestaurantById = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.query;
		const result = await db.query(`SELECT * FROM lunchplanner.restaurants WHERE id=$1;`, [id]);
		res.status(200).json(result.rows[0]);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
