import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import fsp from 'fs/promises';
import path from 'path';

import errorHandler from './middleware/errorHandler.js';
import { WebSocketConfiguration } from './config/websocket.config.js';
import { keycloak } from './config/keycloak.config.js';
import webRoutes from './routes/web.js';
import restaurantRoutes from './routes/restaurants.js';
import userRoutes from './routes/user.js';

const __dirname = import.meta.dirname;

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
app.use('/restaurantMenus', express.static(path.join(__dirname, '../.customRestaurantMenus')));
app.use('/userImages', express.static(path.join(__dirname, '../.userImages'), {
	extensions: ['apng', 'avif', 'gif', 'jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp', 'png', 'svg', 'webp', 'bmp', 'ico', 'cur', 'tif', 'tiff']
}));

const server = app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export const wss = new WebSocketConfiguration(server);

async function init () {
	const dirNames = ['../.customRestaurantImages', '../.customRestaurantMenus', '../.userImages'];
	for (const dir of dirNames) {
		try {
			await fsp.mkdir(path.join(__dirname, dir));
		} catch (error: any) {
			if (error.code !== 'EEXIST') {
				console.error(error);
			}
		}
	}
}

export default app;
