import { Router } from 'express';
import { createCase, getNewCases, assignCase, getAssignedCases, getCaseById, getProposalsByCaseId, getCasesForProducer, updateCase, deleteCase } from './case.controller';
import { protect, authorize } from '../../middleware/authMiddleware';
import { caseValidation, validate } from '../../middleware/validationMiddleware'; // Import validation
import { param } from 'express-validator'; // Import param for ID validation

const router = Router();

router.use(protect);

router.post('/', authorize('MUNICIPALITY'), caseValidation.createCase, validate, createCase);

router.get('/new', authorize('SALES'), getNewCases);

// @route   GET /api/cases/assigned/me
// @desc    Get all cases assigned to the current sales rep
// @access  Private (Sales only)
router.get('/assigned/me', authorize('SALES'), getAssignedCases);

// @route   GET /api/cases/:id
// @desc    Get a single case by ID
// @access  Private (Stakeholders only, checked in controller)
router.get('/:id', param('id').isInt({ gt: 0 }).withMessage('有効な案件IDは必須です。'), validate, getCaseById);

// @route   GET /api/cases/:caseId/proposals
// @desc    Get proposals for a specific case
// @access  Private (Stakeholders only, checked in controller)
router.get('/:caseId/proposals', param('caseId').isInt({ gt: 0 }).withMessage('有効な案件IDは必須です。'), validate, getProposalsByCaseId);

// @route   GET /api/cases/producer/me
// @desc    Get all cases related to the logged-in producer
// @access  Private (Producer only)
router.get('/producer/me', authorize('PRODUCER'), getCasesForProducer);

// @route   PUT /api/cases/:id
// @desc    Update a case
// @access  Private (Municipality creator or assigned Sales)
router.put('/:id', caseValidation.updateCase, validate, updateCase);

// @route   DELETE /api/cases/:id
// @desc    Delete a case
// @access  Private (Municipality creator only)
router.delete('/:id', param('id').isInt({ gt: 0 }).withMessage('有効な案件IDは必須です。'), validate, deleteCase);

router.put('/:id/assign', authorize('SALES'), caseValidation.assignCase, validate, assignCase);

export default router;