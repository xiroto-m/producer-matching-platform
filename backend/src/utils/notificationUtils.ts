import pool from '../db';

// Helper function to create a notification
export const createNotification = async (userId: number, message: string, link: string) => {
    try {
        await pool.query(
            'INSERT INTO notifications (user_id, message, link) VALUES ($1, $2, $3)',
            [userId, message, link]
        );
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
};
