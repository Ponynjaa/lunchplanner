import express from 'express';
import { authenticate, getAllKitchens, getAllRestaurants, getCurrentlyUsedKitchens, getRestaurantById } from '../controllers/index'
import authenticationMiddleware from '../middleware/authMiddleware';

const router = express.Router();

// router.post('/auth/', authenticate);
router.get('/getAllRestaurants/', getAllRestaurants);
router.get('/getRestaurantById/', getRestaurantById);
router.get('/getAllKitchens/', getAllKitchens);
router.get('/getCurrentlyUsedKitchens/', getCurrentlyUsedKitchens);

export default router;
