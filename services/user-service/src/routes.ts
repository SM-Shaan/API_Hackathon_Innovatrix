import { Router, Request, Response } from 'express';
import { UserService } from './service';

export const createUserRoutes = (userService: UserService) => {
  const router = Router();

  // Register new user
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name, role } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      const result = await userService.register({ email, password, name, role });
      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      res.status(400).json({ error: message });
    }
  });

  // Login
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await userService.login({ email, password });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      res.status(401).json({ error: message });
    }
  });

  // Verify token
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'Token required' });
      }

      const decoded = await userService.verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      res.json({ valid: true, user: decoded });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Get current user profile
  router.get('/me', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const decoded = await userService.verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const user = await userService.getById(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  });

  // Get all users (admin only)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const decoded = await userService.verifyToken(token);
      if (!decoded || decoded.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const users = await userService.getAll();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get users' });
    }
  });

  // Get user by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const user = await userService.getById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // Update user
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const decoded = await userService.verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Only allow users to update themselves, or admins to update anyone
      if (decoded.userId !== req.params.id && decoded.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const { name, role } = req.body;
      const user = await userService.update(req.params.id, { name, role });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  return router;
};
