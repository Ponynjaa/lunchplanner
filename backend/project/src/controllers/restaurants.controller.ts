import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fsp from 'fs/promises';
import { glob } from 'glob';
import { getUserId, getUserInfo } from '../utils/userinfo.js';
import * as db from '../../database/db.js';
import { wss } from '../app.js';
import { takeaway } from '../config/takeaway.config.js';

const __dirname = import.meta.dirname;

const getVoteInfos = async (restaurantId: string) => {
	const result = await db.query(`
		SELECT
			lieferando,
			SUM(CASE WHEN upvote THEN 1 ELSE -1 END) AS votes,
			COALESCE(ARRAY_AGG(user_id) FILTER(WHERE upvote = true), '{}') AS upvotes,
			COALESCE(ARRAY_AGG(user_id) FILTER(WHERE upvote = false), '{}') AS downvotes
		FROM lunchplanner.restaurant_votes
		WHERE date = CURRENT_DATE AND restaurant_id = $1
		GROUP BY lieferando;
	`, [restaurantId]);

	const infos = result.rows[0] ?? {
		votes: null,
		upvotes: [],
		downvotes: []
	};

	if (infos.votes !== null) {
		infos.votes = parseInt(infos.votes);
	}

	const getMappedVotes = async (votes: any[]) => {
		const mappedVotes = [];

		for (const id of votes) {
			const userInfo = await getUserInfo(id);
			const userImage = `${process.env.SERVER_URL}/userImages/${id}`;
			mappedVotes.push({
				id: id,
				userImage: userImage,
				firstName: userInfo?.firstName,
				lastName: userInfo?.lastName
			});
		}

		return mappedVotes;
	}

	infos.upvotes = await getMappedVotes(infos.upvotes);
	infos.downvotes = await getMappedVotes(infos.downvotes);

	return infos;
}

export const removeVote = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { restaurantId } = req.body;
		const userId = getUserId(req);

		const result = await db.query(`
			DELETE FROM lunchplanner.restaurant_votes
			WHERE restaurant_id = $1 AND user_id = $2
			RETURNING lieferando;
		`, [restaurantId, userId]);

		// need to retrieve lieferando info here as row is deleted
		// therefore `getVoteInfos` might not be able to retrieve any
		// rows for this restaurant when this was the last vote
		const lieferando = result.rows[0].lieferando;

		// notify all clients of new votes for restaurant
		const voteInfo = await getVoteInfos(restaurantId);
		const response = { restaurantId, ...voteInfo, lieferando };
		wss.sendMessage(response);

		res.status(200).json(response);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const upvote = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { restaurantId, restaurantName, lieferando } = req.body;
		const userId = getUserId(req);

		await db.query(`
			INSERT INTO lunchplanner.restaurant_votes (restaurant_id, restaurant_name, lieferando, user_id, upvote)
			VALUES ($1, $2, $3, $4, true)
			ON CONFLICT (restaurant_id, date, user_id) DO
			UPDATE SET upvote = true;
		`, [restaurantId, restaurantName, lieferando, userId]);

		// notify all clients of new votes for restaurant
		const voteInfo = await getVoteInfos(restaurantId);
		const response = { restaurantId, ...voteInfo };
		wss.sendMessage(response);

		res.status(200).json(response);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const downvote = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { restaurantId, restaurantName, lieferando } = req.body;
		const userId = getUserId(req);

		await db.query(`
			INSERT INTO lunchplanner.restaurant_votes (restaurant_id, restaurant_name, lieferando, user_id, upvote)
			VALUES ($1, $2, $3, $4, false)
			ON CONFLICT (restaurant_id, date, user_id) DO
			UPDATE SET upvote = false;
		`, [restaurantId, restaurantName, lieferando, userId]);

		// notify all clients of new votes for restaurant
		const voteInfo = await getVoteInfos(restaurantId);
		const response = { restaurantId, ...voteInfo };
		wss.sendMessage(response);

		res.status(200).json(response);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getAllCustomRestaurants = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const restaurants = (await db.query(`
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
		`)).rows;

		// TODO: add type in models
		const result: any[] = [];
		for (const restaurant of restaurants) {
			const voteInfo = await getVoteInfos(restaurant.id as string);
			const { votes, upvotes, downvotes } = voteInfo;
			result.push({
				...restaurant,
				votes,
				upvotes,
				downvotes
			});
		}

		res.status(200).json(result);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getCustomRestaurantDetails = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.query;
		const result = await db.query(`
			SELECT r.id AS id, r.name AS name, r.logourl AS logourl, r.menuurl AS menuurl, r.city AS city, r.street AS street, r.delivery AS delivery, r.pickup AS pickup, JSON_AGG(
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
			GROUP BY r.id, r.name, r.logourl, r.menuurl, r.city, r.street, r.delivery, r.pickup;
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
			return res.status(400).send("No logo image was sent!");
		}
		if (!req.files?.menu) {
			return res.status(400).send("No menu was sent!");
		}

		const uploadedImage = req.files.image as any;
		const uploadedMenu = req.files.menu as any;
		if (!/^image\//.test(uploadedImage.mimetype)) {
			return res.status(400).send(`Invalid mime type for logo image: ${uploadedImage.mimetype}`);
		}
		if (uploadedMenu.mimetype !== 'application/pdf') {
			return res.status(400).send(`Invalid mime type for menu: ${uploadedMenu.mimetype}`);
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
		const logoFileExtension = /\.[a-zA-Z]+$/.exec(uploadedImage.name);
		const logoFileName = `${restaurantId}${logoFileExtension}`;
		const logoUrl = `${process.env.SERVER_URL}/restaurantImages/${logoFileName}`;

		const menuFileName = `${restaurantId}.pdf`;
		const menuUrl = `${process.env.SERVER_URL}/restaurantMenus/${menuFileName}`;

		// update just inserted row and set logourl and menuurl
		await dbClient.query(`
			UPDATE lunchplanner.restaurants
			SET logourl = $1,
				menuurl = $2
			WHERE id = $3;
		`, [logoUrl, menuUrl, restaurantId]);

		for (const subkitchenId of subkitchenIds) {
			await dbClient.query(`
				INSERT INTO lunchplanner.restaurants_subkitchens (restaurant_id, subkitchen_id) VALUES ($1, $2)
				ON CONFLICT (restaurant_id, subkitchen_id) DO
				UPDATE SET restaurant_id=$1, subkitchen_id=$2;
			`, [
				restaurantId, subkitchenId
			]);
		}

		const logoDir = path.join(__dirname, '../../.customRestaurantImages');
		const logoFiles = await glob(`${restaurantId}.*`, { cwd: logoDir });
		for (const logoFile of logoFiles) {
			await fsp.rm(path.join(logoDir, logoFile));
		}

		const menuDir = path.join(__dirname, '../../.customRestaurantMenus');
		const menuFiles = await glob(`${restaurantId}.*`, { cwd: menuDir });
		for (const menuFile of menuFiles) {
			await fsp.rm(path.join(menuDir, menuFile));
		}

		const logoUploadPath = path.join(logoDir, logoFileName);
		await uploadedImage.mv(logoUploadPath);

		const menuUploadPath = path.join(menuDir, menuFileName);
		await uploadedMenu.mv(menuUploadPath);

		await dbClient.query('COMMIT');

		res.status(200).json({ success: true, restaurantId, logoUrl, menuUrl });
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

		// TODO: add type in models
		const result: any[] = [];
		for (const restaurant of restaurants) {
			const voteInfo = await getVoteInfos(restaurant.id as string);
			const { votes, upvotes, downvotes } = voteInfo;

			result.push({
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
				votes: votes,
				upvotes: upvotes,
				downvotes: downvotes,
				subkitchens: restaurant.subKitchens?.ids.map((id: any) => {
					id = parseInt(id.toString());
					return {
						id: id,
						...subkitchenMap.get(id)
					};
				}) ?? []
			});
		}

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
