import express from 'express';
import { getAllKitchens, getAllRestaurants, getCurrentlyUsedKitchens, getRestaurantById } from '../controllers/index'
import { keycloak } from '../config/keycloak.config';

const router = express.Router();
const restaurantRouter = express.Router();

restaurantRouter.use(keycloak.protect());
restaurantRouter.get('/getAllRestaurants/', getAllRestaurants);
restaurantRouter.get('/getRestaurantById/', getRestaurantById);
restaurantRouter.get('/getAllKitchens/', getAllKitchens);
restaurantRouter.get('/getCurrentlyUsedKitchens/', getCurrentlyUsedKitchens);

router.use('/restaurant', restaurantRouter);

export default router;
