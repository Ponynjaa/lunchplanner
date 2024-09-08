import { Request, Response, NextFunction } from 'express';
import { getKeycloakId, getKeycloakUserInfo } from '../utils/user.js';
import * as db from '../../database/db.js';
import { wss } from '../app.js';
import { takeaway } from '../config/takeaway.config.js';

const getVoteInfos = async (sessionId: number|null, restaurantId: string) => {
	let infos: {votes: number|null, upvotes: any[], downvotes: any[]} = {
		votes: null,
		upvotes: [],
		downvotes: []
	};

	if (!sessionId) {
		return infos;
	}

	const result = await db.query(`
		SELECT
			type,
			SUM(CASE WHEN upvote THEN 1 ELSE -1 END) AS votes,
			COALESCE(JSON_AGG(JSON_BUILD_OBJECT('user_id', user_id, 'image', u.image)) FILTER(WHERE upvote = true), '{}') AS upvotes,
			COALESCE(JSON_AGG(JSON_BUILD_OBJECT('user_id', user_id, 'image', u.image)) FILTER(WHERE upvote = false), '{}') AS downvotes
		FROM restaurant_votes
		WHERE session_id = $1 AND restaurant_id = $2
		JOIN users u ON user_id = u.id
		GROUP BY type;
	`, [sessionId, restaurantId]);

	const row = result.rows[0];
	if (row) {
		infos.votes = parseInt(row.votes);
		infos.upvotes = infos.upvotes;
		infos.downvotes = infos.downvotes;
	}

	const getMappedVotes = async (votes: any[]) => {
		const mappedVotes = [];

		for (const vote of votes) {
			const { id, image } = vote;
			const userInfo = await getKeycloakUserInfo(id);
			mappedVotes.push({
				id: id,
				userImage: image,
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
		const { restaurantId, sessionId } = req.body;
		const userId = getKeycloakId(req);

		const result = await db.query(`
			DELETE FROM restaurant_votes
			WHERE restaurant_id = $1 AND user_id = $2 AND session_id = $3
			RETURNING type;
		`, [restaurantId, userId, sessionId]);

		// need to retrieve type info here as row is deleted
		// therefore `getVoteInfos` might not be able to retrieve any
		// rows for this restaurant when this was the last vote
		const type = result.rows[0].type;

		// notify all clients of new votes for restaurant
		const voteInfo = await getVoteInfos(sessionId, restaurantId);
		const response = { restaurantId, ...voteInfo, type };
		wss.sendMessage(sessionId, response);

		res.status(200).json(response);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const upvote = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { restaurantId, type, sessionId } = req.body;
		const userId = getKeycloakId(req);

		await db.query(`
			INSERT INTO restaurant_votes (restaurant_id, type, user_id, session_id, upvote)
			VALUES ($1, $2, $3, $4, $5, true)
			ON CONFLICT (restaurant_id, session_id, user_id) DO
			UPDATE SET upvote = true;
		`, [restaurantId, type, userId, sessionId]);

		// notify all clients of new votes for restaurant
		const voteInfo = await getVoteInfos(sessionId, restaurantId);
		const response = { restaurantId, ...voteInfo };
		wss.sendMessage(sessionId, response);

		res.status(200).json(response);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const downvote = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { restaurantId, type, sessionId } = req.body;
		const userId = getKeycloakId(req);

		await db.query(`
			INSERT INTO restaurant_votes (restaurant_id, type, user_id, session_id, upvote)
			VALUES ($1, $2, $3, $4, false)
			ON CONFLICT (restaurant_id, date, user_id) DO
			UPDATE SET upvote = false;
		`, [restaurantId, type, userId, sessionId]);

		// notify all clients of new votes for restaurant
		const voteInfo = await getVoteInfos(sessionId, restaurantId);
		const response = { restaurantId, ...voteInfo };
		wss.sendMessage(sessionId, response);

		res.status(200).json(response);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getAllCustomRestaurants = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { sessionId, longitude, latitude, range } = req.query;
		const parsedSessionId = sessionId ? parseInt(sessionId.toString()) : null;

		const restaurants = (await db.query(`
			SELECT r.id AS id, r.name AS name, r.location AS location, r.logo AS logo, r.city AS city, r.street AS street, r.delivery AS delivery, r.pickup AS pickup, JSON_AGG(
				JSON_BUILD_OBJECT(
					'id', sk.id,
					'description_de', sk.description_de,
					'description_en', sk.description_en
				)
			) AS subkitchens
			FROM restaurants r
			JOIN restaurants_subkitchens rs ON r.id = rs.restaurant_id
			JOIN subkitchens sk ON sk.id = rs.subkitchen_id
			WHERE ST_DWithin(r.location, ST_MakePoint($1, $2)::geography, $3)
			GROUP BY r.id, r.name, r.location, r.logo, r.city, r.street, r.delivery, r.pickup;
		`, [longitude, latitude, range ?? 5_000])).rows;

		// TODO: add type in models
		const result: any[] = [];
		for (const restaurant of restaurants) {
			const voteInfo = await getVoteInfos(parsedSessionId, restaurant.id as string);
			const { votes, upvotes, downvotes } = voteInfo;

			restaurant.logo = `data:application/octet-stream;base64,${restaurant.logo.toString('base64')}`;
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
		const { id, longitude, latitude } = req.query;
		const result = await db.query(`
			SELECT r.id AS id, r.name AS name, r.location AS location, r.logo AS logo, r.menu AS menu, r.city AS city, r.street AS street, r.delivery AS delivery, r.pickup AS pickup,
			ST_Distance(ST_MakePoint($2, $3)::geography, r.location) AS distance, JSON_AGG(
				JSON_BUILD_OBJECT(
					'id', sk.id,
					'description_de', sk.description_de,
					'description_en', sk.description_en
				)
			) AS subkitchens
			FROM restaurants r
			JOIN restaurants_subkitchens rs ON r.id = rs.restaurant_id
			JOIN subkitchens sk ON sk.id = rs.subkitchen_id
			WHERE r.id = $1
			GROUP BY r.id, r.name, r.location, r.logo, r.menu, r.city, r.street, r.delivery, r.pickup, distance;
		`, [id, longitude, latitude]);

		const restaurant = result.rows[0];
		restaurant.logo = `data:application/octet-stream;base64,${restaurant.logo.toString('base64')}`;

		res.status(200).json(restaurant);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getCustomRestaurantPdf = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.query;

		const result = await db.query(`
			SELECT menu FROM restaurants
			WHERE id = $1;
		`, [id]);

		const menu = result.rows[0].menu;

		res.setHeader('Content-Type', 'application/pdf').status(200).send(menu);
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

		let { name, longitude, latitude, city, street, subkitchenIds, delivery, pickup } = req.body as any;
		subkitchenIds = JSON.parse(subkitchenIds);

		await dbClient.query('BEGIN');

		const result = await dbClient.query(`
			INSERT INTO restaurants (
				name, logo, menu, location, city, street, delivery, pickup
			) VALUES (
				$1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7, $8, $9
			)
			RETURNING id;
		`, [name, uploadedImage.data, uploadedMenu.data, longitude, latitude, city, street, delivery, pickup]);

		const restaurantId = result.rows[0].id;

		for (const subkitchenId of subkitchenIds) {
			await dbClient.query(`
				INSERT INTO restaurants_subkitchens (restaurant_id, subkitchen_id) VALUES ($1, $2)
				ON CONFLICT (restaurant_id, subkitchen_id) DO
				UPDATE SET restaurant_id=$1, subkitchen_id=$2;
			`, [
				restaurantId, subkitchenId
			]);
		}

		await dbClient.query('COMMIT');

		res.status(200).json({ success: true, restaurantId });
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
		const { sessionId, postalCode, latitude, longitude } = req.query as any;
		const parsedSessionId = sessionId ? parseInt(sessionId.toString()) : null;
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
			const voteInfo = await getVoteInfos(parsedSessionId, restaurant.id as string);
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
		FROM subkitchens
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
			FROM subkitchens sk
			JOIN kitchens k ON k.id = sk.kitchen_id
			GROUP BY k.id, k.description_de, k.description_en;
		`);
		res.status(200).json(result.rows);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
