import { Response } from 'express';
import pool from '../../db';
import { IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';

/**
 * ログイン中のユーザーの未読通知を取得する
 */
export const getNotificationsForUser = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: '認証されていません。' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, message, link, read, created_at
             FROM notifications
             WHERE user_id = $1 AND read = FALSE
             ORDER BY created_at DESC`,
            [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '通知の取得に失敗しました。' });
    }
};

/**
 * 特定の通知を既読にする
 */
export const markNotificationAsRead = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const notificationId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: '認証されていません。' });
    }

    try {
        const { rowCount } = await pool.query(
            `UPDATE notifications
             SET read = TRUE, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [notificationId, userId]
        );

        if (rowCount === 0) {
            return res.status(404).json({ message: '通知が見つからないか、更新する権限がありません。' });
        }

        res.status(200).json({ message: '通知を既読にしました。' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '通知の既読化に失敗しました。' });
    }
};
