import express from 'express';
import { getAllKitchens, getAllCustomRestaurants, getCustomRestaurantDetails, addCustomRestaurant, getAllLieferandoRestaurants, upvote, downvote, removeVote } from '../controllers/index.js';
import { keycloak } from '../config/keycloak.config.js';

const router = express.Router();
const restaurantRouter = express.Router();

restaurantRouter.use(keycloak.protect());
restaurantRouter.get('/getAllKitchens/', getAllKitchens);
restaurantRouter.post('/upvote/', upvote);
restaurantRouter.post('/downvote/', downvote);
restaurantRouter.post('/removeVote/', removeVote);

restaurantRouter.get('/getAllCustomRestaurants/', getAllCustomRestaurants);
restaurantRouter.get('/getCustomRestaurantDetails/', getCustomRestaurantDetails);
restaurantRouter.post('/addCustomRestaurant', addCustomRestaurant);

restaurantRouter.get('/getAllLieferandoRestaurants/', getAllLieferandoRestaurants);

router.use('/restaurant', restaurantRouter);

export default router;
