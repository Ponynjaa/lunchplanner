import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';

import errorHandler from './middleware/errorHandler.js';
import { WebSocketConfiguration } from './config/websocket.config.js';
import { keycloak } from './config/keycloak.config.js';
import webRoutes from './routes/web.js';
import restaurantRoutes from './routes/restaurants.js';
import userRoutes from './routes/user.js';
import addressRoutes from './routes/address.js';
import groupRoutes from './routes/groups.js';

const app = express();

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
	userRoutes,
	addressRoutes,
	groupRoutes
]);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export const wss = new WebSocketConfiguration(server);

export default app;
