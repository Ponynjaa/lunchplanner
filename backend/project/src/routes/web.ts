import express from 'express';
// import userRoutes from './users';
const router = express.Router();

router.get('/health', (req, res) => {
	const { ping } = req.query;
	res.json({ pong: ping });
});

// router.use('/api/v1', [
// 	userRoutes
// ]);

// Export the router
export default router;
