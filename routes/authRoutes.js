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
const VALID_USERNAMES = [
  'sir_visue', 'visue_sir', 'chief_judge_visue', 'dr_rashid', 'rashid_jahangir',
  'dr.rashid', 'dr_rashid_jahangir', 'dr.rashid.jahangir', 'dr rashid', 'rashid', 'sir', 'admin'
];
const VALID_PASSWORDS = [
  'spark2026', 'Spark@26', 'Spark2026', 'spark@26', 'spark@2026', 'Spark@2026',
  'VisueSpark#2026!Arena', 'visuespark2026'
];

/**
 * POST /api/login
 * Sir / Judge Login with Username & Password Verification
 */
router.post('/login', validateLogin, (req, res) => {
  const { username, password } = req.body;

  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  const normUser = cleanUser.replace(/[^a-z0-9]/g, '');

  const matchedTeacher = store.authenticateTeacher(cleanUser, cleanPass);
  const isLegacyUserValid = VALID_USERNAMES.some(u => u.toLowerCase() === cleanUser || u.replace(/[^a-z0-9]/g, '') === normUser);
  const isLegacyPassValid = VALID_PASSWORDS.some(p => p === cleanPass || p.toLowerCase() === cleanPass.toLowerCase());

  if (!matchedTeacher && (!isLegacyUserValid || !isLegacyPassValid)) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Invalid Judge Username or Password.'
    });
  }

  // Always resolve authentic teacher record so custom photo and name are never lost
  const primaryTeacher = matchedTeacher || store.getTeacherByUsername(cleanUser) || store.getTeacherById('teacher-1') || store.getTeachers(true)[0];
  const teacherName = primaryTeacher ? primaryTeacher.name : 'Dr. Rashid Jahangir';
  const teacherDept = primaryTeacher ? (primaryTeacher.department || 'Department of Computer Science') : 'Department of Computer Science';
  const teacherDesignation = primaryTeacher ? (primaryTeacher.designation || 'Chief Evaluation Judge') : 'Chief Evaluation Judge';
  const teacherPic = primaryTeacher ? (primaryTeacher.profilePic || null) : null;

  // Single-Judge Session Management:
  // Seamless takeover: If there was an active session from another tab or before browser restart,
  // supersede it without locking Sir out.
  const existingSession = store.getActiveJudgeSession();
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
    name: teacherName,
    department: teacherDept,
    designation: teacherDesignation,
    profilePic: teacherPic,
    issuedAt: Date.now()
  };

  // Sign token valid for 8 hours (competition duration)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

  // Notify any other connected client that a new session has taken over
  const io = req.app.get('io');
  if (io && existingSession) {
    io.emit('judgeSessionChanged', {
      sessionId,
      message: 'Judge Portal unlocked in a new session. Previous session terminated.'
    });
  }

  return res.status(200).json({
    success: true,
    message: `Welcome ${teacherName}! Judge Evaluation Portal unlocked.`,
    token,
    sessionId,
    judge: {
      username: payload.username,
      name: payload.name,
      role: payload.role,
      department: payload.department,
      designation: payload.designation,
      profilePic: payload.profilePic
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

    const teacher = store.getTeacherByUsername(decoded.username) || store.getTeacherById('teacher-1') || store.getTeachers(false)[0];
    return res.status(200).json({
      success: true,
      judge: {
        username: decoded.username,
        name: (teacher ? teacher.name : decoded.name) || 'Dr. Rashid Jahangir',
        role: decoded.role || 'judge',
        department: (teacher ? teacher.department : decoded.department) || 'Department of Computer Science',
        designation: (teacher ? teacher.designation : decoded.designation) || 'Chief Evaluation Judge',
        profilePic: (teacher ? teacher.profilePic : decoded.profilePic) || null
      }
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired' });
  }
});

/**
 * POST /api/admin/profile
 * Sir updates their own profile details (Name, Designation, Department, Profile Picture)
 */
router.post('/admin/profile', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required to update profile' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, designation, department, profilePic } = req.body || {};

    const updated = store.syncSirProfile({ name, designation, department, profilePic });

    const safeJudge = {
      username: decoded.username,
      name: updated.name,
      role: 'judge',
      department: updated.department,
      designation: updated.designation,
      profilePic: updated.profilePic
    };

    // Broadcast update via Socket.IO so all connected screens reflect changes live
    const io = req.app.get('io');
    if (io) {
      io.emit('teacherProfileUpdated', { teacher: safeJudge });
    }

    return res.status(200).json({
      success: true,
      message: 'Judge profile updated and permanently persisted! ✨',
      judge: safeJudge
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
});

/**
 * POST /api/admin/profile/sync
 * Sync cached teacher profile from client localStorage to persist across server cold boots
 */
router.post('/admin/profile/sync', (req, res) => {
  try {
    const { name, designation, department, profilePic } = req.body || {};
    if (!name && !profilePic) {
      return res.status(400).json({ success: false, message: 'No profile data provided for sync' });
    }

    const updated = store.syncSirProfile({ name, designation, department, profilePic });
    return res.status(200).json({
      success: true,
      message: 'Judge profile synchronized successfully!',
      teacher: {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        designation: updated.designation,
        department: updated.department,
        profilePic: updated.profilePic
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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