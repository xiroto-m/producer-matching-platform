import { Router } from 'express';
import { getMyRestaurants, getRestaurantProfile, updateRestaurantProfile } from '../controllers/restaurant.controller';
import { protect, authorize } from '../../middleware/authMiddleware';
import { restaurantValidation, validate } from '../../middleware/validationMiddleware'; // Import validation
import { param } from 'express-validator'; // Import param for ID validation

const router = Router();

router.use(protect);

// @route   GET /api/restaurants/my
// @desc    Get list of restaurants managed by the logged-in sales rep
// @access  Private (Sales only)
router.get('/my', authorize('SALES'), getMyRestaurants);

// @route   GET /api/restaurants/:id
// @desc    Get a specific restaurant profile
// @access  Private (Restaurant owner or Sales rep managing)
router.get('/:id', param('id').isInt({ gt: 0 }).withMessage('有効な飲食店IDは必須です。'), validate, getRestaurantProfile);

// @route   PUT /api/restaurants/:id
// @desc    Update a specific restaurant profile
// @access  Private (Restaurant owner only)
router.put('/:id', restaurantValidation.updateProfile, validate, updateRestaurantProfile);

export default router;