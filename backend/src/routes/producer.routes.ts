import { Router } from 'express';
import { getProducers, getProducerProfile, updateProducerProfile } from '../controllers/producer.controller';
import { protect, authorize } from '../../middleware/authMiddleware';
import { producerValidation, validate } from '../../middleware/validationMiddleware'; // Import validation
import { param } from 'express-validator'; // Import param for ID validation

const router = Router();

router.use(protect);

// @route   GET /api/producers
// @desc    Get list of producers
// @access  Private (Municipality only)
router.get('/', authorize('MUNICIPALITY'), getProducers);

// @route   GET /api/producers/:id
// @desc    Get a specific producer profile
// @access  Private (Producer owner or Sales rep managing related restaurant)
router.get('/:id', param('id').isInt({ gt: 0 }).withMessage('有効な生産者IDは必須です。'), validate, getProducerProfile);

// @route   PUT /api/producers/:id
// @desc    Update a specific producer profile
// @access  Private (Producer owner only)
router.put('/:id', producerValidation.updateProfile, validate, updateProducerProfile);

export default router;