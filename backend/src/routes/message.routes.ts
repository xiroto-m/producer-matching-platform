import { Router } from 'express';
import { protect } from '../../middleware/authMiddleware';
import { getMessagesByProposalId, createMessage } from '../controllers/message.controller';
import { body } from 'express-validator';
import { validate } from '../../middleware/validationMiddleware';

const router = Router({ mergeParams: true }); // proposalIdをparamsから取得できるようにmergeParamsをtrueに

router.use(protect); // 全てのメッセージルートに認証ミドルウェアを適用

// @route   GET /api/proposals/:proposalId/messages
// @desc    Get messages for a specific proposal
// @access  Private (Proposal stakeholders only)
router.get('/:proposalId/messages', getMessagesByProposalId);

// @route   POST /api/proposals/:proposalId/messages
// @desc    Post a new message to a specific proposal
// @access  Private (Proposal stakeholders only)
router.post(
  '/:proposalId/messages',
  [body('content').notEmpty().withMessage('メッセージ内容は必須です。')],
  validate,
  createMessage
);

export default router;