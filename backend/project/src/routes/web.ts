import express from 'express';
// import userRoutes from './users';
const router = express.Router();

router.get('/health', (req, res) => {
	const { ping } = req.query;
	res.json({ pong: ping });
});

// Export the router
export default router;
