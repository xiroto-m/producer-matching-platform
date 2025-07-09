import { Router } from 'express';
import { protect } from '../../middleware/authMiddleware';
import { getMyProfile, updateMyProfile } from '../controllers/user.controller';
import { userValidation, validate } from '../../middleware/validationMiddleware';

const router = Router();

router.use(protect); // 全てのユーザー関連ルートに認証ミドルウェアを適用

// @route   GET /api/users/me
// @desc    Get logged in user profile
// @access  Private
router.get('/me', getMyProfile);

// @route   PUT /api/users/me
// @desc    Update logged in user profile
// @access  Private
router.put('/me', userValidation.updateMyProfile, validate, updateMyProfile);

export default router;