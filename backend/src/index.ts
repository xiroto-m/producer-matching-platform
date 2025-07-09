import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan'; // Import morgan
import logger from './config/logger'; // Import logger
import authRoutes from './api/auth/auth.routes';
import caseRoutes from './api/cases/case.routes';
import producerRoutes from './api/producers/producer.routes';
import proposalRoutes from './api/proposals/proposal.routes';
import restaurantRoutes from './api/restaurants/restaurant.routes';
import notificationRoutes from './api/notifications/notification.routes';
import userRoutes from './api/users/user.routes';
import './db';
import { notFound, errorHandler } from './middleware/errorMiddleware'; // Import error handlers

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
// Request logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/producers', producerRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to the Sapporo Matching Platform API!');
});

// Error handling middlewares
app.use(notFound);
app.use(errorHandler);

export default app;

// Only listen if not in a test environment
if (process.env.NODE_ENV !== 'test') {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}