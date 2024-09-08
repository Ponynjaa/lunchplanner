import { Request, Response, NextFunction } from 'express';
import * as imageUtils from '../utils/image.js';
import * as userUtils from '../utils/user.js';
import * as db from '../../database/db.js';
import { PoolClient } from 'pg';

export const addUserToGroup = async (userId: number, groupId: number, role: string, dbClient?: PoolClient) => {
	const query = `
		INSERT INTO users_groups (user_id, group_id, role)
		VALUES ($1, $2, $3);
	`;

	if (dbClient) {
		await dbClient.query(query, [userId, groupId, role]);
	} else {
		await db.query(query, [userId, groupId, role]);
	}
}

export const createGroup = async (req: Request, res: Response, next: NextFunction) => {
	const dbClient = await db.getClient();

	try {
		const { name, mastergroup } = req.body as any;

		let image: Buffer;
		if (req.files?.image) {
			const uploadedImage = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
			const mimeType = uploadedImage.mimetype;
			if (!/^image\//.test(mimeType)) {
				return res.status(400).send('Invalid mime type ' + mimeType);
			}

			image = uploadedImage.data;
		} else {
			const initials = name.match(/(\b\S)?/g).join('')
				.match(/(^\S|\S$)?/g)
				.join('').toUpperCase();
			image = imageUtils.createImage(initials);
		}

		await dbClient.query(`BEGIN`);

		// create group
		const result = await dbClient.query(`
			INSERT INTO groups (name, image, mastergroup)
			VALUES ($1, $2, $3)
			RETURNING id;
		`, [name, image, mastergroup]);

		const createdGroupId = result.rows[0].id;
		const users: any[] = [];

		// add current user to group as admin if created group is a top level group
		if (!mastergroup) {
			const keycloakId = userUtils.getKeycloakId(req);
			const userInfos = await userUtils.getUserInfosByKeycloakId(keycloakId);
			const role = 'admin';

			users.push({
				id: userInfos.id,
				first_name: userInfos.first_name,
				last_name: userInfos.last_name,
				image: `data:application/octet-stream;base64,${userInfos.image.toString('base64')}`,
				role: role
			});

			await addUserToGroup(userInfos.id, createdGroupId, role, dbClient);
		}

		const createdGroup = {
			id: createdGroupId,
			name,
			image: `data:application/octet-stream;base64,${image.toString('base64')}`,
			mastergroup,
			users: users,
			subgroups: []
		};

		await dbClient.query(`COMMIT`);

		res.status(200).json({ success: true, createdGroup });
	} catch (err) {
		await dbClient.query(`ROLLBACK`);
		next(err);
		res.status(400).send(err);
	} finally {
		dbClient.release();
	}
}

export const createGroupInviteLink = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { groupId } = req.query;

		const validUntil = new Date();
		validUntil.setDate(validUntil.getDate() + 1);

		const result = await db.query(`
			INSERT INTO groups_invites (group_id, valid_until)
			VALUES ($1, $2)
			ON CONFLICT (group_id) DO
			UPDATE SET valid_until=$2
			RETURNING code;
		`, [groupId, validUntil]);

		res.status(200).json({ success: true, code: result.rows[0].code });
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getInvitationInfos = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { code } = req.query;

		const result = await db.query(`
			SELECT g.id, g.name, g.image FROM groups_invites gi
			INNER JOIN groups g ON g.id = gi.group_id
			WHERE code = $1
			AND valid_until > NOW();
		`, [code]);

		const formatted = result.rows[0];
		formatted.image = `data:application/octet-stream;base64,${formatted.image.toString('base64')}`;

		res.status(200).json(formatted);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const joinGroup = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { code } = req.body;

		const result = await db.query(`
			SELECT group_id FROM groups_invites
			WHERE code = $1
			AND valid_until > NOW();
		`, [code]);
		const groupId = result.rows[0].group_id;

		const keycloakId = userUtils.getKeycloakId(req);
		const userInfos = await userUtils.getUserInfosByKeycloakId(keycloakId);
		await addUserToGroup(userInfos.id, groupId, 'regular');

		res.status(200).json({ success: true });
	} catch (err: any) {
		if (err.code === '23505') {
			res.status(400).json({ success: false, code: err.code, message: 'User is already part of the group.' });
			return;
		}

		next(err);
		res.status(400).send(err);
	}
}

export const deleteGroup = async (req: Request, res: Response, next: NextFunction) => {
	const dbClient = await db.getClient();

	try {
		const { groupId } = req.body;

		// TODO: need to check user roles to determine if he is allowed to remove the group
		// const keycloakId = userUtils.getKeycloakId(req);
		// const userId = await userUtils.getUserIdByKeycloakId(keycloakId);

		await dbClient.query(`BEGIN`);

		// find all subgroups as they have to be deleted too
		const groupIds = (await dbClient.query(`
			WITH RECURSIVE group_hierarchy AS (
				SELECT g.id FROM groups g
				WHERE g.id = $1

				UNION ALL

				SELECT g.id FROM groups g
				INNER JOIN group_hierarchy gh ON g.mastergroup = gh.id
			)

			SELECT id FROM group_hierarchy;
		`, [groupId])).rows.map(row => row.id);

		// remove all users from each group
		await dbClient.query(`
			DELETE FROM users_groups
			WHERE group_id = ANY($1);
		`, [groupIds]);

		// delete the groups
		await dbClient.query(`
			DELETE FROM groups
			WHERE id = ANY($1);
		`, [groupIds]);

		await dbClient.query(`COMMIT`);

		res.status(200).send({ success: true });
	} catch (err) {
		await dbClient.query(`ROLLBACK`);
		next(err);
		res.status(400).send(err);
	} finally {
		dbClient.release();
	}
}

export const editImage = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.query;

		if (!req.files?.image) {
			return res.status(400).send('No image was sent');
		}

		const uploadedImage = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
		const mimeType = uploadedImage.mimetype;
		if (!/^image\//.test(mimeType)) {
			return res.status(400).send('Invalid mime type ' + mimeType);
		}

		await db.query(`
			UPDATE groups
			SET image = $1
			WHERE id = $2;
		`, [uploadedImage.data, id]);

		res.status(200).json({ success: true });
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}

export const getGroups = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const keycloakId = userUtils.getKeycloakId(req);
		const userInfos = await userUtils.getUserInfosByKeycloakId(keycloakId);

		const groups = (await db.query(`
			WITH RECURSIVE user_root_groups AS (
				SELECT g.id AS root_group_id
				FROM groups g
				INNER JOIN users_groups ug ON g.id = ug.group_id
				WHERE ug.user_id = $1 AND g.mastergroup IS NULL
			),
			group_hierarchy AS (
				SELECT g.* FROM groups g
				INNER JOIN user_root_groups ur ON g.id = ur.root_group_id

				UNION ALL

				SELECT g.* FROM groups g
				INNER JOIN group_hierarchy gh ON g.mastergroup = gh.id
			)

			SELECT gh.*, COALESCE(json_agg(
				json_build_object(
					'user_id', ug.user_id,
					'first_name', u.first_name,
					'last_name', u.last_name,
					'user_image', u.image,
					'role', ug.role
				)) FILTER (WHERE ug.user_id IS NOT NULL), '[]') AS users
			FROM group_hierarchy gh
			LEFT JOIN users_groups ug ON gh.id = ug.group_id
			LEFT JOIN users u ON ug.user_id = u.id
			GROUP BY gh.id, gh.name, gh.image, gh.mastergroup;
		`, [userInfos.id])).rows;

		const groupMap = new Map();
		for (const group of groups) {
			group.image = `data:application/octet-stream;base64,${group.image.toString('base64')}`;
			group.users = group.users.map((user: any) => {
				// substring is necessary here due to the \x at the start of bytea columns
				// this only has to be done here since JSON_BUILD_OBJECT converts the bytea to a string.
				// when selecting the bytea column directly a Buffer is returned instead
				const userImage = Buffer.from(user.user_image.substring(2), 'hex').toString('base64');
				return {
					id: user.user_id,
					first_name: user.first_name,
					last_name: user.last_name,
					image: `data:application/octet-stream;base64,${userImage}`,
					role: user.role
				};
			});

			groupMap.set(group.id, {
				...group,
				subgroups: []
			});
		}

		const masterGroups = [];
		for (const group of groups) {
			if (group.mastergroup === null) {
				masterGroups.push(groupMap.get(group.id));
			} else {
				const parentGroup = groupMap.get(group.mastergroup);
				if (parentGroup) {
					parentGroup.subgroups.push(groupMap.get(group.id));
				}
			}
		}

		return res.status(200).json(masterGroups);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
