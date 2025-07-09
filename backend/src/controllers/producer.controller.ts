import { Response } from 'express';
import pool from '../../db';
import { IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';

/**
 * 生産者リストを取得する (自治体担当者のみアクセス可能)
 */
export const getProducers = async (req: IGetUserAuthInfoRequest, res: Response) => {
    try {
        // 将来的に、ログインしている自治体担当者が管轄する生産者に限定するロジックを追加可能
        // 現時点では全ての生産者を取得
        const query = `
            SELECT id, name FROM producers ORDER BY name ASC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '生産者リストの取得に失敗しました。' });
    }
};

/**
 * 特定の生産者プロファイルを取得する (生産者オーナーまたは担当営業者のみ)
 */
export const getProducerProfile = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const producerId = req.params.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        const query = `
            SELECT
                p.id, p.user_id, p.name, p.address,
                u.email, u.role
            FROM producers p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = $1;
        `;
        const { rows } = await pool.query(query, [producerId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: '生産者プロファイルが見つかりません。' });
        }
        const producerData = rows[0];

        // アクセス制御: 生産者オーナーまたは担当営業者のみ
        const isAuthorized = (
            (userRole === 'PRODUCER' && userId === producerData.user_id) ||
            (userRole === 'SALES' && (await pool.query('SELECT id FROM restaurants WHERE managed_by_sales_id = $1', [userId])).rows.length > 0) // 担当営業者が管理する飲食店に関連する生産者
        );

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Forbidden: この生産者プロファイルにアクセスする権限がありません。' });
        }

        res.json(producerData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '生産者プロファイルの取得に失敗しました。' });
    }
};

/**
 * 生産者プロファイルを更新する (生産者オーナーのみ)
 */
export const updateProducerProfile = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const producerId = req.params.id;
    const { name, address } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        // 生産者情報を取得し、オーナーであることを確認
        const producerResult = await pool.query('SELECT user_id FROM producers WHERE id = $1', [producerId]);
        if (producerResult.rows.length === 0) {
            return res.status(404).json({ message: '生産者プロファイルが見つかりません。' });
        }
        const producerOwnerId = producerResult.rows[0].user_id;

        if (userRole !== 'PRODUCER' || userId !== producerOwnerId) {
            return res.status(403).json({ message: 'Forbidden: この生産者プロファイルを更新する権限がありません。' });
        }

        const query = `
            UPDATE producers
            SET name = COALESCE($1, name),
                address = COALESCE($2, address),
                updated_at = NOW()
            WHERE id = $3
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [name, address, producerId]);
        res.json(rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '生産者プロファイルの更新に失敗しました。' });
    }
};
