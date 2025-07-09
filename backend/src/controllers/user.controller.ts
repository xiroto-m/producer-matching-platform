import { Response } from 'express';
import pool from '../../db';
import { IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';
import bcrypt from 'bcryptjs';

/**
 * ログイン中のユーザーのプロフィール情報を取得する
 */
export const getMyProfile = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: '認証されていません。' });
    }

    try {
        const { rows } = await pool.query(
            'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'ユーザーが見つかりません。' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'プロフィール情報の取得に失敗しました。' });
    }
};

/**
 * ログイン中のユーザーのプロフィール情報を更新する
 */
export const updateMyProfile = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const userId = req.user?.id;
    const { name, email, password } = req.body;

    if (!userId) {
        return res.status(401).json({ message: '認証されていません。' });
    }

    let passwordHash: string | undefined;
    if (password) {
        passwordHash = await bcrypt.hash(password, 10);
    }

    try {
        const { rows } = await pool.query(
            `UPDATE users
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 password_hash = COALESCE($3, password_hash),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING id, name, email, role, created_at, updated_at`,
            [name, email, passwordHash, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'ユーザーが見つからないか、更新に失敗しました。' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'プロフィール情報の更新に失敗しました。' });
    }
};