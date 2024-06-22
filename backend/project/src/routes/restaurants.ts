import express from 'express';
import { getAllKitchens, getAllCustomRestaurants, getCustomRestaurantDetails, addCustomRestaurant, getAllLieferandoRestaurants } from '../controllers/index'
import { keycloak } from '../config/keycloak.config';

const router = express.Router();
const restaurantRouter = express.Router();

restaurantRouter.use(keycloak.protect());
restaurantRouter.get('/getAllKitchens/', getAllKitchens);

restaurantRouter.get('/getAllCustomRestaurants/', getAllCustomRestaurants);
restaurantRouter.get('/getCustomRestaurantDetails/', getCustomRestaurantDetails);
restaurantRouter.post('/addCustomRestaurant', addCustomRestaurant);

restaurantRouter.get('/getAllLieferandoRestaurants/', getAllLieferandoRestaurants);

router.use('/restaurant', restaurantRouter);

export default router;
