// ============================================================================
// V Spark 2026 - Judge Authentication Routes
// Lecture 9: Lightweight Auth & RBAC (POST /api/login)
// Secure Username & Password credentials (Never exposed on client UI)
// ============================================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const store = require('../data/store');
const { JWT_SECRET } = require('../middleware/auth');
const { validateLogin } = require('../middleware/validator');

// Short, unique, and easy-to-type credentials (never shown in UI)
const VALID_USERNAMES = ['sir_visue', 'visue_sir', 'chief_judge_visue', 'dr_rashid', 'rashid_jahangir'];
const VALID_PASSWORDS = ['spark2026', 'Spark@26', 'VisueSpark#2026!Arena'];

/**
 * POST /api/login
 * Sir / Judge Login with Username & Password Verification
 */
router.post('/login', validateLogin, (req, res) => {
  const { username, password } = req.body;

  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  const isUserValid = VALID_USERNAMES.some(u => u.toLowerCase() === cleanUser);
  const isPassValid = VALID_PASSWORDS.includes(cleanPass);

  if (!isUserValid || !isPassValid) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Invalid Judge Username or Password.'
    });
  }

  // Option A: Single-Judge Strict Lock Check
  const existingSession = store.getActiveJudgeSession();
  if (existingSession && !req.body.forceUnlock) {
    const loginTime = new Date(existingSession.loggedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return res.status(409).json({
      success: false,
      error: 'SESSION_LOCKED',
      message: `Access Denied: Judge Portal is already active on another device! Dr. Rashid Jahangir is logged in (Active since: ${loginTime}). Single-session lock is active. Please log out from the active device or click Force Unlock below.`,
      activeSession: {
        username: existingSession.username,
        loggedInAt: existingSession.loggedInAt,
        ip: existingSession.ip
      }
    });
  }

  // Create new active judge session
  const sessionId = `JSESS-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  store.setJudgeSession({
    sessionId,
    username: cleanUser,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent']
  });

  // Payload for JWT (includes unique sessionId)
  const payload = {
    role: 'judge',
    sessionId,
    username: cleanUser,
    name: 'Dr. Rashid Jahangir (Chief Evaluation Judge)',
    department: 'Department of Computer Science',
    issuedAt: Date.now()
  };

  // Sign token valid for 8 hours (competition duration)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

  // If forceUnlock was used, notify connected clients via Socket.IO
  const io = req.app.get('io');
  if (io && req.body.forceUnlock) {
    io.emit('judgeSessionChanged', {
      sessionId,
      message: 'Judge Portal was unlocked on another device. Previous session terminated.'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Welcome Dr. Rashid Jahangir! Judge Evaluation Portal unlocked.',
    token,
    sessionId,
    judge: {
      username: payload.username,
      name: payload.name,
      role: payload.role,
      department: payload.department
    }
  });
});

/**
 * GET /api/verify-auth
 * Verify existing judge token from client session
 */
router.get('/verify-auth', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No active session token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Option A: Verify active session lock
    if (decoded.sessionId) {
      const active = store.getActiveJudgeSession();
      if (!active || active.sessionId !== decoded.sessionId) {
        return res.status(401).json({
          success: false,
          error: 'SESSION_SUPERSEDED',
          message: 'Your judge session has ended because another session was unlocked or logged out.'
        });
      }
      store.touchJudgeSession();
    }

    return res.status(200).json({
      success: true,
      judge: {
        username: decoded.username,
        name: decoded.name,
        role: decoded.role,
        department: decoded.department
      }
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired' });
  }
});

/**
 * POST /api/logout
 * Sir / Judge explicit logout to release the single-judge session lock
 */
router.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      store.clearJudgeSession(decoded.sessionId);
    } catch (e) {
      store.clearJudgeSession();
    }
  } else {
    store.clearJudgeSession();
  }

  const io = req.app.get('io');
  if (io) {
    io.emit('judgeLoggedOut', { message: 'Judge logged out. Portal lock released.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Judge successfully logged out. Session lock released.'
  });
});

module.exports = router;