import { Router } from 'express';
import { register, login } from './auth.controller';
import { protect, IGetUserAuthInfoRequest } from '../../middleware/authMiddleware';
import { authValidation, validate } from '../../middleware/validationMiddleware'; // Import validation

const router = Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authValidation.register, validate, register);

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', authValidation.login, validate, login);

// @route   GET /api/auth/profile
// @desc    Get user profile (example of a protected route)
// @access  Private
router.get('/profile', protect, (req: IGetUserAuthInfoRequest, res) => {
    res.json(req.user);
});

export default router;