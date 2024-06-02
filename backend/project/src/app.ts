import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';

import errorHandler from './middleware/errorHandler';
import { keycloak } from './config/keycloak.config';
import webRoutes from './routes/web';
import restaurantRoutes from './routes/restaurants';
import userRoutes from './routes/user';

const app = express();

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

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export default app;
