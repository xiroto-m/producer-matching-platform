import { Response } from 'express';
import pool from '../../db';
import { IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';

/**
 * 新しい提案を作成する (営業担当者のみ)
 */
export const createProposal = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const { case_id, restaurant_id, memo } = req.body;
    const sales_id = req.user?.id;

    if (!case_id || !restaurant_id || !sales_id) {
        return res.status(400).json({ message: 'case_id, restaurant_id, sales_idは必須です。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // トランザクション開始

        // 1. proposalsテーブルに新しい提案を登録
        const proposalQuery = `
            INSERT INTO proposals (case_id, restaurant_id, sales_id, status, memo)
            VALUES ($1, $2, $3, 'PROPOSED', $4)
            RETURNING *;
        `;
        const proposalResult = await client.query(proposalQuery, [case_id, restaurant_id, sales_id, memo]);
        const newProposal = proposalResult.rows[0];

        // 2. 関連するcasesテーブルのstatusを'PROPOSING'に更新
        const caseUpdateQuery = `
            UPDATE cases
            SET status = 'PROPOSING'
            WHERE id = $1 AND status != 'CLOSED' AND status != 'REJECTED'
            RETURNING *;
        `;
        await client.query(caseUpdateQuery, [case_id]);

        // 3. 提案を受けた飲食店に通知を生成
        const restaurantUserIdResult = await client.query(
            'SELECT user_id FROM restaurants WHERE id = $1',
            [restaurant_id]
        );
        const restaurantUserId = restaurantUserIdResult.rows[0]?.user_id;

        if (restaurantUserId) {
            const salesName = req.user?.name || '不明な営業担当者'; // ログインユーザーの名前を取得
            const caseTitleResult = await client.query(
                'SELECT title FROM cases WHERE id = $1',
                [case_id]
            );
            const caseTitle = caseTitleResult.rows[0]?.title || '不明な案件';

            const notificationMessage = `${salesName}さんから、${caseTitle}について新しい提案があります。`;
            const notificationLink = `/dashboard`; // 飲食店ダッシュボードへのリンク

            await client.query(
                'INSERT INTO notifications (user_id, message, link) VALUES ($1, $2, $3)',
                [restaurantUserId, notificationMessage, notificationLink]
            );
        }

        await client.query('COMMIT'); // トランザクション確定

        res.status(201).json(newProposal);

    } catch (error) {
        await client.query('ROLLBACK'); // エラー発生時はロールバック
        console.error(error);
        res.status(500).json({ message: '提案の作成に失敗しました。' });
    } finally {
        client.release(); // コネクションをプールに返却
    }
};

/**
 * 特定の提案のステータスを更新する
 * (提案を作成した営業担当者、または提案を受けた飲食店のみ実行可能)
 */
export const updateProposalStatus = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const proposalId = req.params.id;
    const { status: newStatus } = req.body; // リクエストボディから新しいステータスを取得
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // 有効なステータス値のチェック
    const validStatuses = ['PROPOSED', 'SAMPLE_REQUESTED', 'CONSIDERING', 'ACCEPTED', 'DECLINED'];
    if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ message: '無効なステータス値です。' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // トランザクション開始

        // 提案の情報を取得し、アクセス権限を確認
        const proposalResult = await client.query(
            `SELECT p.case_id, p.sales_id, p.restaurant_id, r.user_id as restaurant_user_id
             FROM proposals p
             JOIN restaurants r ON p.restaurant_id = r.id
             WHERE p.id = $1`,
            [proposalId]
        );

        if (proposalResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: '提案が見つかりません。' });
        }

        const proposal = proposalResult.rows[0];

        // アクセス制御
        const isAuthorized = (
            (userRole === 'SALES' && userId === proposal.sales_id) || // 提案を作成した営業担当者
            (userRole === 'RESTAURANT' && userId === proposal.restaurant_user_id) // 提案を受けた飲食店
        );

        if (!isAuthorized) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden: この提案のステータスを更新する権限がありません。' });
        }

        // proposalsテーブルのstatusを更新
        const updateProposalQuery = `
            UPDATE proposals
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *;
        `;
        const updatedProposalResult = await client.query(updateProposalQuery, [newStatus, proposalId]);
        const updatedProposal = updatedProposalResult.rows[0];

        // 新しいステータスが'ACCEPTED'の場合、関連するcasesテーブルのstatusを'CLOSED'に更新
        if (newStatus === 'ACCEPTED') {
            const updateCaseStatusQuery = `
                UPDATE cases
                SET status = 'CLOSED', updated_at = NOW()
                WHERE id = $1
                RETURNING *;
            `;
            await client.query(updateCaseStatusQuery, [proposal.case_id]);
        } else if (newStatus === 'DECLINED') {
            // 他にアクティブな提案（PROPOSED, CONSIDERING）がないか確認
            const activeProposalsCountResult = await client.query(
                `SELECT COUNT(*) FROM proposals WHERE case_id = $1 AND status IN ('PROPOSED', 'CONSIDERING')`,
                [proposal.case_id]
            );
            const activeProposalsCount = parseInt(activeProposalsCountResult.rows[0].count, 10);

            if (activeProposalsCount === 0) {
                // アクティブな提案が他にない場合、案件のステータスを更新
                const caseStatusUpdateQuery = `
                    UPDATE cases
                    SET status = CASE
                        WHEN assigned_sales_id IS NULL THEN 'NEW' -- 担当者がいない場合はNEWに戻す
                        ELSE 'PENDING' -- 担当者がいる場合はPENDINGに戻す
                    END,
                    updated_at = NOW()
                    WHERE id = $1
                    RETURNING *;
                `;
                await client.query(caseStatusUpdateQuery, [proposal.case_id]);
            }
        }

        await client.query('COMMIT'); // トランザクション確定
        res.json(updatedProposal);

    } catch (error) {
        await client.query('ROLLBACK'); // エラー発生時はロールバック
        console.error(error);
        res.status(500).json({ message: '提案ステータスの更新に失敗しました。' });
    } finally {
        client.release();
    }
};

/**
 * ログイン中の飲食店に提案された案件一覧を取得する (飲食店のみ)
 */
export const getProposalsForRestaurant = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const userId = req.user?.id; // ログイン中のユーザーID

    try {
        // ログイン中のユーザーIDに紐づく飲食店IDを取得
        const restaurantResult = await pool.query('SELECT id FROM restaurants WHERE user_id = $1', [userId]);
        if (restaurantResult.rows.length === 0) {
            return res.status(404).json({ message: '飲食店情報が見つかりません。' });
        }
        const restaurantId = restaurantResult.rows[0].id;

        const query = `
            SELECT
                p.id AS proposal_id,
                p.status AS proposal_status,
                p.memo AS proposal_memo,
                p.created_at,
                c.id AS case_id,
                c.title AS case_title,
                cd.item_name AS case_item_name,
                c.status AS case_status,
                prod.name AS producer_name,
                sales_user.name AS sales_name
            FROM proposals p
            JOIN cases c ON p.case_id = c.id
            JOIN case_details cd ON c.id = cd.case_id
            JOIN producers prod ON c.producer_id = prod.id
            JOIN users sales_user ON p.sales_id = sales_user.id
            WHERE p.restaurant_id = $1
            ORDER BY p.created_at DESC;
        `;
        const { rows } = await pool.query(query, [restaurantId]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '飲食店向け提案リストの取得に失敗しました。' });
    }
};