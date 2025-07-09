import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

// バリデーション結果を処理するミドルウェア
export const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    const extractedErrors: { [key: string]: string } = {};
    errors.array().map(err => {
        if (err.type === 'field') {
            extractedErrors[err.path] = err.msg;
        }
    });
    return res.status(422).json({
        errors: extractedErrors,
        message: '入力値に誤りがあります。' ,
    });
};

// ユーザー認証関連のバリデーション
export const authValidation = {
    register: [
        body('name').notEmpty().withMessage('名前は必須です。'),
        body('email').isEmail().withMessage('有効なメールアドレスを入力してください。'),
        body('password').isLength({ min: 6 }).withMessage('パスワードは6文字以上である必要があります。'),
        body('role').isIn(['MUNICIPALITY', 'SALES', 'PRODUCER', 'RESTAURANT']).withMessage('無効な役割です。'),
    ],
    login: [
        body('email').isEmail().withMessage('有効なメールアドレスを入力してください。'),
        body('password').notEmpty().withMessage('パスワードは必須です。'),
    ],
};

// 案件関連のバリデーション
export const caseValidation = {
    createCase: [
        body('title').notEmpty().withMessage('案件タイトルは必須です。'),
        body('producer_id').isInt({ gt: 0 }).withMessage('有効な生産者IDは必須です。'),
        body('item_name').notEmpty().withMessage('品目は必須です。'),
        body('quantity').optional().isString().withMessage('数量は文字列である必要があります。'),
        body('desired_price').optional().isNumeric().withMessage('希望価格は数値である必要があります。'),
        body('description').notEmpty().withMessage('課題の詳細は必須です。'),
    ],
    updateCase: [
        param('id').isInt({ gt: 0 }).withMessage('有効な案件IDは必須です。'),
        body('title').optional().notEmpty().withMessage('案件タイトルは空にできません。'),
        body('producer_id').optional().isInt({ gt: 0 }).withMessage('有効な生産者IDは必須です。'),
        body('item_name').optional().notEmpty().withMessage('品目は空にできません。'),
        body('quantity').optional().isString().withMessage('数量は文字列である必要があります。'),
        body('desired_price').optional().isNumeric().withMessage('希望価格は数値である必要があります。'),
        body('description').optional().notEmpty().withMessage('課題の詳細は空にできません。'),
    ],
    assignCase: [
        param('id').isInt({ gt: 0 }).withMessage('有効な案件IDは必須です。'),
    ],
};

// 提案関連のバリデーション
export const proposalValidation = {
    createProposal: [
        body('case_id').isInt({ gt: 0 }).withMessage('有効な案件IDは必須です。'),
        body('restaurant_id').isInt({ gt: 0 }).withMessage('有効な飲食店IDは必須です。'),
        body('memo').optional().isString().withMessage('メモは文字列である必要があります。'),
    ],
    updateProposalStatus: [
        param('id').isInt({ gt: 0 }).withMessage('有効な提案IDは必須です。'),
        body('status').isIn(['PROPOSED', 'SAMPLE_REQUESTED', 'CONSIDERING', 'ACCEPTED', 'DECLINED']).withMessage('無効なステータスです。'),
    ],
};

// ユーザープロファイル関連のバリデーション
export const userValidation = {
    updateMe: [
        body('name').optional().notEmpty().withMessage('名前は空にできません。'),
        body('email').optional().isEmail().withMessage('有効なメールアドレスを入力してください。'),
        body('password').optional().isLength({ min: 6 }).withMessage('パスワードは6文字以上である必要があります。'),
    ],
};

// 生産者プロファイル関連のバリデーション
export const producerValidation = {
    updateProfile: [
        param('id').isInt({ gt: 0 }).withMessage('有効な生産者IDは必須です。'),
        body('name').optional().notEmpty().withMessage('生産者名は空にできません。'),
        body('address').optional().isString().withMessage('所在地は文字列である必要があります。'),
    ],
};

// 飲食店プロファイル関連のバリデーション
export const restaurantValidation = {
    updateProfile: [
        param('id').isInt({ gt: 0 }).withMessage('有効な飲食店IDは必須です。'),
        body('name').optional().notEmpty().withMessage('飲食店名は空にできません。'),
        body('address').optional().isString().withMessage('所在地は文字列である必要があります。'),
    ],
};
