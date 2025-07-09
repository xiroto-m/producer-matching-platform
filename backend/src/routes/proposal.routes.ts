import { Router } from 'express';
import { createProposal, updateProposalStatus, getProposalsForRestaurant } from '../controllers/proposal.controller';
import { protect, authorize } from '../../middleware/authMiddleware';
import { proposalValidation, validate } from '../../middleware/validationMiddleware'; // Import validation
import { param } from 'express-validator'; // Import param for ID validation

const router = Router();

router.use(protect);

// @route   POST /api/proposals
// @desc    Create a new proposal
// @access  Private (Sales only)
router.post('/', authorize('SALES'), proposalValidation.createProposal, validate, createProposal);

// @route   PATCH /api/proposals/:id/status
// @desc    Update status of a specific proposal
// @access  Private (Sales or Restaurant stakeholder)
router.patch('/:id/status', proposalValidation.updateProposalStatus, validate, updateProposalStatus);

// @route   GET /api/proposals/restaurant/me
// @desc    Get all proposals made to the logged-in restaurant
// @access  Private (Restaurant only)
router.get('/restaurant/me', authorize('RESTAURANT'), getProposalsForRestaurant);

// Import message routes
import messageRoutes from './message.routes';

// Mount message routes under /api/proposals/:proposalId
router.use('/:proposalId', messageRoutes);

export default router;