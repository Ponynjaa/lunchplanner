import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import webRoutes from './routes/web';
import errorHandler from './middleware/errorHandler';
import Keycloak from 'keycloak-connect';
import keycloakConfig from './config/keycloak.config';
import restaurantRoutes from './routes/restaurants';

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({
	extended: true
}));
app.use(cors());

const keycloak = new  Keycloak({}, keycloakConfig);
app.use(keycloak.middleware());

app.use('/api/v1', [
	webRoutes,
	restaurantRoutes
]);

app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export default app;
