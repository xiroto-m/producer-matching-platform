import { Response } from 'express';
import pool from '../../db';
import { IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';

/**
 * 特定の提案に紐づくメッセージ一覧を取得する
 * (提案の関係者のみアクセス可能)
 */
export const getMessagesByProposalId = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const proposalId = req.params.proposalId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
        return res.status(401).json({ message: '認証されていません。' });
    }

    try {
        // 提案の情報を取得し、ユーザーが関係者であるかを確認
        const proposalResult = await pool.query(
            `SELECT p.sales_id, r.user_id as restaurant_user_id
             FROM proposals p
             JOIN restaurants r ON p.restaurant_id = r.id
             WHERE p.id = $1`,
            [proposalId]
        );

        if (proposalResult.rows.length === 0) {
            return res.status(404).json({ message: '提案が見つかりません。' });
        }

        const proposal = proposalResult.rows[0];

        // アクセス制御: 提案を作成した営業担当者、または提案を受けた飲食店のみ
        const isAuthorized = (
            (userRole === 'SALES' && userId === proposal.sales_id) ||
            (userRole === 'RESTAURANT' && userId === proposal.restaurant_user_id)
        );

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Forbidden: この提案のメッセージにアクセスする権限がありません。' });
        }

        // メッセージリストを取得
        const { rows } = await pool.query(
            `SELECT m.id, m.content, m.created_at, u.name as sender_name, u.role as sender_role
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.proposal_id = $1
             ORDER BY m.created_at ASC`,
            [proposalId]
        );
        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'メッセージの取得に失敗しました。' });
    }
};

/**
 * 特定の提案に新しいメッセージを投稿する
 * (提案の関係者のみアクセス可能)
 */
export const createMessage = async (req: IGetUserAuthInfoRequest, res: Response) => {
    const proposalId = req.params.proposalId;
    const { content } = req.body;
    const senderId = req.user?.id;
    const userRole = req.user?.role;

    if (!senderId || !content) {
        return res.status(400).json({ message: '送信者IDとメッセージ内容は必須です。' });
    }

    try {
        // 提案の情報を取得し、ユーザーが関係者であるかを確認
        const proposalResult = await pool.query(
            `SELECT p.sales_id, r.user_id as restaurant_user_id
             FROM proposals p
             JOIN restaurants r ON p.restaurant_id = r.id
             WHERE p.id = $1`,
            [proposalId]
        );

        if (proposalResult.rows.length === 0) {
            return res.status(404).json({ message: '提案が見つかりません。' });
        }

        const proposal = proposalResult.rows[0];

        // アクセス制御: 提案を作成した営業担当者、または提案を受けた飲食店のみ
        const isAuthorized = (
            (userRole === 'SALES' && senderId === proposal.sales_id) ||
            (userRole === 'RESTAURANT' && senderId === proposal.restaurant_user_id)
        );

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Forbidden: この提案にメッセージを投稿する権限がありません。' });
        }

        // メッセージを挿入
        const { rows } = await pool.query(
            `INSERT INTO messages (proposal_id, sender_id, content)
             VALUES ($1, $2, $3)
             RETURNING id, content, created_at`,
            [proposalId, senderId, content]
        );
        res.status(201).json(rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'メッセージの投稿に失敗しました。' });
    }
};
