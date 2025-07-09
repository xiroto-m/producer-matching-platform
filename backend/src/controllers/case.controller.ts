import { Response } from 'express';
import pool from '../../db';
import { IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';
import { createNotification } from '../../utils/notificationUtils';

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

        // 通知生成
        if (created_by_user_id) {
            await createNotification(
                created_by_user_id,
                `新しい案件「${newCase.title}」が登録されました。`,
                `/cases/${newCase.id}`
            );
        }

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

        // 通知生成
        if (sales_id) {
            await createNotification(
                sales_id,
                `案件「${rows[0].title}」があなたにアサインされました。`,
                `/cases/${rows[0].id}`
            );
        }

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
            SELECT c.id, c.title, c.status, c.created_at, c.updated_at,
                p.name as producer_name, p.address as producer_address,
                cd.item_name, cd.quantity, cd.desired_price,
                sales.name AS assigned_sales_name
            FROM cases c
            JOIN producers p ON c.producer_id = p.id
            JOIN case_details cd ON c.id = cd.case_id
            LEFT JOIN users sales ON c.assigned_sales_id = sales.id
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

/**
 * 特定の案件に紐づく提案リストを取得する (案件の関係者のみアクセス可能)
 */
export const getProposalsByCaseId = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const caseId = req.params.caseId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        // まず案件の基本情報を取得し、ユーザーが関係者であるかを確認
        const caseResult = await pool.query(
            `SELECT created_by_user_id, producer_id, assigned_sales_id FROM cases WHERE id = $1`,
            [caseId]
        );
        if (caseResult.rows.length === 0) {
            return res.status(404).json({ message: '案件が見つかりません。' });
        }
        const caseData = caseResult.rows[0];

        // アクセス制御: ログインユーザーが案件の関係者であるかを確認
        const isStakeholder = (
            (userRole === 'MUNICIPALITY' && userId === caseData.created_by_user_id) ||
            (userRole === 'SALES' && userId === caseData.assigned_sales_id) ||
            (userRole === 'PRODUCER' && userId === (await pool.query('SELECT user_id FROM producers WHERE id = $1', [caseData.producer_id])).rows[0]?.user_id) ||
            false
        );

        if (!isStakeholder) {
            return res.status(403).json({ message: 'Forbidden: この案件の提案リストにアクセスする権限がありません。' });
        }

        // 提案リストを取得
        const query = `
            SELECT
                p.id,
                p.status,
                p.memo,
                p.created_at,
                r.name AS restaurant_name,
                r.address AS restaurant_address
            FROM proposals p
            JOIN restaurants r ON p.restaurant_id = r.id
            WHERE p.case_id = $1
            ORDER BY p.created_at DESC;
        `;
        const { rows } = await pool.query(query, [caseId]);
        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '提案リストの取得に失敗しました。' });
    }
};

/**
 * ログイン中の生産者に関連する案件一覧を取得する (生産者のみ)
 */
export const getCasesForProducer = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const userId = req.user?.id;

    try {
        // ログイン中のユーザーIDに紐づく生産者IDを取得
        const producerResult = await pool.query('SELECT id FROM producers WHERE user_id = $1', [userId]);
        if (producerResult.rows.length === 0) {
            return res.status(404).json({ message: '生産者情報が見つかりません。' });
        }
        const producerId = producerResult.rows[0].id;

        const query = `
            SELECT
                c.id, c.title, c.status, c.created_at, c.updated_at,
                p.name as producer_name, p.address as producer_address,
                cd.item_name, cd.quantity, cd.desired_price,
                sales.name AS assigned_sales_name
            FROM cases c
            JOIN producers p ON c.producer_id = p.id
            JOIN case_details cd ON c.id = cd.case_id
            LEFT JOIN users sales ON c.assigned_sales_id = sales.id
            WHERE c.producer_id = $1
            ORDER BY c.created_at DESC;
        `;
        const { rows } = await pool.query(query, [producerId]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '生産者案件リストの取得に失敗しました。' });
    }
};

/**
 * 案件を更新する (自治体担当者または担当営業者のみ)
 */
export const updateCase = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const caseId = req.params.id;
    const { title, producer_id, item_name, quantity, desired_price, description, image_urls } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 案件の情報を取得し、アクセス権限を確認
        const caseResult = await pool.query(
            `SELECT created_by_user_id, assigned_sales_id FROM cases WHERE id = $1`,
            [caseId]
        );
        if (caseResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: '案件が見つかりません。' });
        }
        const existingCase = caseResult.rows[0];

        // アクセス制御: 案件作成者（自治体）または担当営業者のみ更新可能
        const isAuthorized = (
            (userRole === 'MUNICIPALITY' && userId === existingCase.created_by_user_id) ||
            (userRole === 'SALES' && userId === existingCase.assigned_sales_id)
        );

        if (!isAuthorized) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden: この案件を更新する権限がありません。' });
        }

        // casesテーブルの更新
        const updateCaseQuery = `
            UPDATE cases
            SET title = COALESCE($1, title),
                producer_id = COALESCE($2, producer_id),
                updated_at = NOW()
            WHERE id = $3
            RETURNING *;
        `;
        const updatedCaseResult = await client.query(updateCaseQuery, [title, producer_id, caseId]);

        // case_detailsテーブルの更新
        const updateCaseDetailsQuery = `
            UPDATE case_details
            SET item_name = COALESCE($1, item_name),
                quantity = COALESCE($2, quantity),
                desired_price = COALESCE($3, desired_price),
                description = COALESCE($4, description),
                image_urls = COALESCE($5, image_urls),
                updated_at = NOW()
            WHERE case_id = $6
            RETURNING *;
        `;
        const updatedDetailsResult = await client.query(updateCaseDetailsQuery, [item_name, quantity, desired_price, description, image_urls, caseId]);

        await client.query('COMMIT');
        res.json({ ...updatedCaseResult.rows[0], details: updatedDetailsResult.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: '案件の更新に失敗しました。' });
    } finally {
        client.release();
    }
};

/**
 * 案件を削除する (自治体担当者のみ)
 */
export const deleteCase = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const caseId = req.params.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        // 案件の情報を取得し、アクセス権限を確認
        const caseResult = await pool.query(
            `SELECT created_by_user_id FROM cases WHERE id = $1`,
            [caseId]
        );
        if (caseResult.rows.length === 0) {
            return res.status(404).json({ message: '案件が見つかりません。' });
        }
        const existingCase = caseResult.rows[0];

        // アクセス制御: 案件作成者（自治体）のみ削除可能
        const isAuthorized = (userRole === 'MUNICIPALITY' && userId === existingCase.created_by_user_id);

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Forbidden: この案件を削除する権限がありません。' });
        }

        // 案件を削除 (CASCADEによりcase_detailsとproposalsも削除される)
        await pool.query('DELETE FROM cases WHERE id = $1', [caseId]);

        res.status(200).json({ message: '案件が正常に削除されました。' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '案件の削除に失敗しました。' });
    }
};

/**
 * ログイン中の自治体担当者が登録した案件一覧を取得する (自治体担当者のみ)
 */
export const getCasesCreatedByMe = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const userId = req.user?.id; // ログイン中のユーザーID

    try {
        const query = `
            SELECT
                c.id, c.title, c.status, c.created_at, c.updated_at,
                p.name as producer_name, p.address as producer_address,
                cd.item_name, cd.quantity, cd.desired_price,
                sales.name AS assigned_sales_name
            FROM cases c
            JOIN producers p ON c.producer_id = p.id
            JOIN case_details cd ON c.id = cd.case_id
            LEFT JOIN users sales ON c.assigned_sales_id = sales.id
            WHERE c.created_by_user_id = $1
            ORDER BY c.created_at DESC;
        `;
        const { rows } = await pool.query(query, [userId]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '登録案件リストの取得に失敗しました。' });
    }
};