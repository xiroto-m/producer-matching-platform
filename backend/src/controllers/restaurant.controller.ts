import { Response } from 'express';
import pool from '../../db';
import { IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';

/**
 * ログイン中の営業担当者が担当する飲食店リストを取得する (営業担当者のみ)
 */
export const getMyRestaurants = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const sales_id = req.user?.id;

    if (!sales_id) {
        return res.status(400).json({ message: '営業担当者IDが取得できませんでした。' });
    }

    try {
        const query = `
            SELECT id, name FROM restaurants
            WHERE managed_by_sales_id = $1
            ORDER BY name ASC;
        `;
        const { rows } = await pool.query(query, [sales_id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '担当飲食店リストの取得に失敗しました。' });
    }
};

/**
 * 特定の飲食店プロファイルを取得する (飲食店オーナーまたは担当営業者のみ)
 */
export const getRestaurantProfile = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const restaurantId = req.params.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        const query = `
            SELECT
                r.id, r.user_id, r.name, r.address, r.managed_by_sales_id,
                u.email, u.role,
                sales_user.name AS managed_by_sales_name
            FROM restaurants r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users sales_user ON r.managed_by_sales_id = sales_user.id
            WHERE r.id = $1;
        `;
        const { rows } = await pool.query(query, [restaurantId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: '飲食店プロファイルが見つかりません。' });
        }
        const restaurantData = rows[0];

        // アクセス制御: 飲食店オーナーまたは担当営業者のみ
        const isAuthorized = (
            (userRole === 'RESTAURANT' && userId === restaurantData.user_id) ||
            (userRole === 'SALES' && userId === restaurantData.managed_by_sales_id)
        );

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Forbidden: この飲食店プロファイルにアクセスする権限がありません。' });
        }

        res.json(restaurantData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '飲食店プロファイルの取得に失敗しました。' });
    }
};

/**
 * 飲食店プロファイルを更新する (飲食店オーナーのみ)
 */
export const updateRestaurantProfile = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const restaurantId = req.params.id;
    const { name, address } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        // 飲食店情報を取得し、オーナーであることを確認
        const restaurantResult = await pool.query('SELECT user_id FROM restaurants WHERE id = $1', [restaurantId]);
        if (restaurantResult.rows.length === 0) {
            return res.status(404).json({ message: '飲食店プロファイルが見つかりません。' });
        }
        const restaurantOwnerId = restaurantResult.rows[0].user_id;

        if (userRole !== 'RESTAURANT' || userId !== restaurantOwnerId) {
            return res.status(403).json({ message: 'Forbidden: この飲食店プロファイルを更新する権限がありません。' });
        }

        const query = `
            UPDATE restaurants
            SET name = COALESCE($1, name),
                address = COALESCE($2, address),
                updated_at = NOW()
            WHERE id = $3
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [name, address, restaurantId]);
        res.json(rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '飲食店プロファイルの更新に失敗しました。' });
    }
};
