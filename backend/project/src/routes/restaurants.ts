import express from 'express';
import { getAllKitchens, getAllCustomRestaurants, getCurrentlyUsedKitchens, getCustomRestaurantDetails, getAllLieferandoRestaurants } from '../controllers/index'
import { keycloak } from '../config/keycloak.config';

const router = express.Router();
const restaurantRouter = express.Router();

// restaurantRouter.use(keycloak.protect());
restaurantRouter.get('/getAllCustomRestaurants/', getAllCustomRestaurants);
restaurantRouter.get('/getCustomRestaurantDetails/', getCustomRestaurantDetails);

restaurantRouter.get('/getAllLieferandoRestaurants/', getAllLieferandoRestaurants);

restaurantRouter.get('/getAllKitchens/', getAllKitchens);
restaurantRouter.get('/getCurrentlyUsedKitchens/', getCurrentlyUsedKitchens); // TODO: may remove as it seems unnecessary

router.use('/restaurant', restaurantRouter);

export default router;
