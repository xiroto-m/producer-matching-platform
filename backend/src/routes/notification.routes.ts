import { Router } from 'express';
import { protect } from '../../middleware/authMiddleware';
import { getNotificationsForUser, markNotificationAsRead } from '../controllers/notification.controller';

const router = Router();

router.use(protect); // 全ての通知ルートに認証ミドルウェアを適用

// @route   GET /api/notifications
// @desc    Get unread notifications for the logged-in user
// @access  Private
router.get('/', getNotificationsForUser);

// @route   PATCH /api/notifications/:id/read
// @desc    Mark a specific notification as read
// @access  Private
router.patch('/:id/read', markNotificationAsRead);

export default router;