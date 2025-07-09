import { Response } from 'express';
import pool from '../../db';
import { IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';

/**
 * 新しい案件を登録する (自治体担当者のみ)
 */
export const createCase = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const { title, producer_id, item_name, quantity, desired_price, description, image_urls } = req.body;
    const created_by_user_id = req.user?.id;

    if (!title || !producer_id || !item_name) {
        return res.status(400).json({ message: 'title, producer_id, item_nameは必須です。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const caseQuery = `
            INSERT INTO cases (title, status, created_by_user_id, producer_id)
            VALUES ($1, 'NEW', $2, $3)
            RETURNING id, title, status, created_at;
        `;
        const caseResult = await client.query(caseQuery, [title, created_by_user_id, producer_id]);
        const newCase = caseResult.rows[0];

        const detailQuery = `
            INSERT INTO case_details (case_id, item_name, quantity, desired_price, description, image_urls)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const detailResult = await client.query(detailQuery, [newCase.id, item_name, quantity, desired_price, description, image_urls]);

        await client.query('COMMIT');
        res.status(201).json({ ...newCase, details: detailResult.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'サーバーエラーが発生しました。' });
    } finally {
        client.release();
    }
};

/**
 * 新着案件一覧を取得する (営業担当者のみ)
 */
export const getNewCases = async (req: IGetUserAuthInfoRequest, res: Response) => {
    try {
        const query = `
            SELECT c.id, c.title, c.status, c.created_at, p.name as producer_name, p.address as producer_address, cd.item_name, cd.quantity, cd.desired_price
            FROM cases c
            JOIN producers p ON c.producer_id = p.id
            JOIN case_details cd ON c.id = cd.case_id
            WHERE c.status = 'NEW'
            ORDER BY c.created_at DESC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'サーバーエラーが発生しました。' });
    }
};

/**
 * 案件の担当者になる (営業担当者のみ)
 */
export const assignCase = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const case_id = req.params.id;
    const sales_id = req.user?.id;

    try {
        const query = `
            UPDATE cases SET assigned_sales_id = $1, status = 'PENDING'
            WHERE id = $2 AND status = 'NEW'
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [sales_id, case_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: '案件が見つからないか、既に他の担当者がアサインされています。' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'サーバーエラーが発生しました。' });
    }
};

/**
 * 自身にアサインされた案件一覧を取得する (営業担当者のみ)
 */
export const getAssignedCases = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const sales_id = req.user?.id;
    try {
        const query = `
            SELECT c.id, c.title, c.status, c.created_at, c.updated_at, p.name as producer_name, p.address as producer_address, cd.item_name, cd.quantity, cd.desired_price
            FROM cases c
            JOIN producers p ON c.producer_id = p.id
            JOIN case_details cd ON c.id = cd.case_id
            WHERE c.assigned_sales_id = $1
            ORDER BY c.updated_at DESC;
        `;
        const { rows } = await pool.query(query, [sales_id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'サーバーエラーが発生しました。' });
    }
};

/**
 * 特定の案件の詳細情報を取得する (関係者のみアクセス可能)
 */
export const getCaseById = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const caseId = req.params.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        const query = `
            SELECT
                c.id,
                c.title,
                c.status,
                c.created_at,
                c.updated_at,
                c.created_by_user_id,
                creator.name AS created_by_user_name,
                c.producer_id,
                p.name AS producer_name,
                p.address AS producer_address,
                c.assigned_sales_id,
                sales.name AS assigned_sales_name,
                cd.item_name,
                cd.quantity,
                cd.desired_price,
                cd.description,
                cd.image_urls
            FROM cases c
            LEFT JOIN case_details cd ON c.id = cd.case_id
            LEFT JOIN producers p ON c.producer_id = p.id
            LEFT JOIN users creator ON c.created_by_user_id = creator.id
            LEFT JOIN users sales ON c.assigned_sales_id = sales.id
            WHERE c.id = $1;
        `;
        const { rows } = await pool.query(query, [caseId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: '案件が見つかりません。' });
        }

        const caseData = rows[0];

        // アクセス制御: ログインユーザーが案件の関係者であるかを確認
        const isStakeholder = (
            (userRole === 'MUNICIPALITY' && userId === caseData.created_by_user_id) ||
            (userRole === 'SALES' && userId === caseData.assigned_sales_id) ||
            (userRole === 'PRODUCER' && userId === (await pool.query('SELECT user_id FROM producers WHERE id = $1', [caseData.producer_id])).rows[0]?.user_id) ||
            false
        );

        if (!isStakeholder) {
            return res.status(403).json({ message: 'Forbidden: この案件にアクセスする権限がありません。' });
        }

        res.json(caseData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'サーバーエラーが発生しました。' });
    }
};