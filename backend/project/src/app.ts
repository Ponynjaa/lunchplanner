import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import fsp from 'fs/promises';
import path from 'path';

import errorHandler from './middleware/errorHandler';
import { WebSocketConfiguration } from './config/websocket.config';
import { keycloak } from './config/keycloak.config';
import webRoutes from './routes/web';
import restaurantRoutes from './routes/restaurants';
import userRoutes from './routes/user';

const app = express();
init();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({
	extended: true
}));
app.use(fileUpload());
app.use(cors({ origin: true }));
app.use(keycloak.middleware());

app.use('/api/v1', [
	webRoutes,
	restaurantRoutes,
	userRoutes
]);

app.use(errorHandler);

app.use('/restaurantImages', express.static(path.join(__dirname, '../.customRestaurantImages')));

const server = app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export const wss = new WebSocketConfiguration(server);

async function init () {
	try {
		await fsp.mkdir(path.join(__dirname, '../.customRestaurantImages'));
		await fsp.mkdir(path.join(__dirname, '../.userImages'));
	} catch (error: any) {
		if (error.code !== 'EEXIST') {
			console.error(error);
		}
	}
}

export default app;
