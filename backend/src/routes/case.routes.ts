import { Router } from 'express';
import { createCase, getNewCases, assignCase, getAssignedCases, getCaseById, getProposalsByCaseId, getCasesForProducer, updateCase, deleteCase, getCasesCreatedByMe } from './case.controller';
import { protect, authorize } from '../../middleware/authMiddleware';

const router = Router();

router.use(protect);

router.post('/', authorize('MUNICIPALITY'), createCase);

router.get('/new', authorize('SALES'), getNewCases);

// @route   GET /api/cases/assigned/me
// @desc    Get all cases assigned to the current sales rep
// @access  Private (Sales only)
router.get('/assigned/me', authorize('SALES'), getAssignedCases);

// @route   GET /api/cases/:id
// @desc    Get a single case by ID
// @access  Private (Stakeholders only, checked in controller)
router.get('/:id', getCaseById);

// @route   GET /api/cases/:caseId/proposals
// @desc    Get proposals for a specific case
// @access  Private (Stakeholders only, checked in controller)
router.get('/:caseId/proposals', getProposalsByCaseId);

// @route   GET /api/cases/producer/me
// @desc    Get all cases related to the logged-in producer
// @access  Private (Producer only)
router.get('/producer/me', authorize('PRODUCER'), getCasesForProducer);

// @route   GET /api/cases/created/me
// @desc    Get all cases created by the logged-in municipality user
// @access  Private (Municipality only)
router.get('/created/me', authorize('MUNICIPALITY'), getCasesCreatedByMe);

// @route   PUT /api/cases/:id
// @desc    Update a case
// @access  Private (Municipality creator or assigned Sales)
router.put('/:id', protect, updateCase);

// @route   DELETE /api/cases/:id
// @desc    Delete a case
// @access  Private (Municipality creator only)
router.delete('/:id', protect, deleteCase);

router.put('/:id/assign', authorize('SALES'), assignCase);

export default router;