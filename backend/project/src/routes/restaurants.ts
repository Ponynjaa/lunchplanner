import express from 'express';
import { authenticate, getAllRestaurants, getRestaurantById } from '../controllers/index'
import authenticationMiddleware from '../middleware/authMiddleware';

const router = express.Router();

// router.post('/auth/', authenticate);
router.get('/getAllRestaurants/', getAllRestaurants);
router.get('/getRestaurantById/', getRestaurantById);

export default router;
