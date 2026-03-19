'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { findUserById, searchUsers } = require('../db/queries');

// GET /api/users/me
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      userId: user.user_id,
      username: user.username,
      publicKey: user.public_key,
      createdAt: user.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// GET /api/users/search?q=
router.get('/search', requireAuth, (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json([]);
    const results = searchUsers(q, req.userId);
    res.json(results.map(u => ({
      userId: u.user_id,
      username: u.username,
      publicKey: u.public_key,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
