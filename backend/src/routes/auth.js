import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    locationLabel: user.locationLabel,
    lastSeenAt: user.lastSeenAt,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, timezone = 'UTC', locationLabel = '' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        timezone: String(timezone || 'UTC'),
        locationLabel: String(locationLabel || ''),
      },
    });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
    const token = signToken(updated);
    res.json({ token, user: publicUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      locationLabel: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.patch('/me', authRequired, async (req, res) => {
  const { name, timezone, locationLabel } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user.userId },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(timezone !== undefined ? { timezone: String(timezone) } : {}),
      ...(locationLabel !== undefined ? { locationLabel: String(locationLabel) } : {}),
      lastSeenAt: new Date(),
    },
  });
  res.json({ user: publicUser(user) });
});

router.post('/presence', authRequired, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.userId },
    data: { lastSeenAt: new Date() },
  });
  res.json({ user: publicUser(user) });
});

export default router;
