// ============================================================================
// V Spark 2026 - Super Admin Governance & Control Routes
// Platform Control: Teacher/Judge Management, Profile Pic Customization,
// and Global Website Lock (Read-Only Mode)
// ============================================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const store = require('../data/store');
const { JWT_SECRET, verifySuperAdminToken } = require('../middleware/auth');

// Allowed Super Admin Credentials (easy to remember and secure)
const VALID_SUPERADMIN_USERS = ['superadmin', 'head_admin', 'super_admin'];
const VALID_SUPERADMIN_PASSWORDS = ['superadmin2026', 'Spark@Super2026', 'admin123'];

/**
 * POST /api/superadmin/login
 * Super Administrator Login
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  const isUserValid = VALID_SUPERADMIN_USERS.includes(cleanUser);
  const isPassValid = VALID_SUPERADMIN_PASSWORDS.includes(cleanPass);

  if (!isUserValid || !isPassValid) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Invalid Super Admin username or password.'
    });
  }

  const payload = {
    role: 'superadmin',
    username: cleanUser,
    name: 'Head / Super Administrator',
    issuedAt: Date.now()
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

  return res.status(200).json({
    success: true,
    message: 'Welcome Super Admin! System Governance Portal unlocked.',
    token,
    user: {
      username: payload.username,
      name: payload.name,
      role: payload.role
    }
  });
});

/**
 * GET /api/superadmin/verify-auth
 * Verify active Super Admin token
 */
router.get('/verify-auth', verifySuperAdminToken, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      username: req.user.username,
      name: req.user.name,
      role: req.user.role
    }
  });
});

/**
 * GET /api/superadmin/teachers
 * Retrieve all registered teachers / judges
 */
router.get('/teachers', verifySuperAdminToken, (req, res) => {
  try {
    const teachersList = store.getTeachers(false);
    return res.status(200).json({
      success: true,
      count: teachersList.length,
      teachers: teachersList
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/superadmin/teachers
 * Add a new teacher / judge
 */
router.post('/teachers', verifySuperAdminToken, (req, res) => {
  try {
    const { name, username, password, designation, department, profilePic } = req.body || {};
    const newTeacher = store.addTeacher({ name, username, password, designation, department, profilePic });

    const safeTeacher = { ...newTeacher };
    delete safeTeacher.password;

    return res.status(201).json({
      success: true,
      message: `Teacher "${newTeacher.name}" added successfully!`,
      teacher: safeTeacher
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/superadmin/teachers/:id
 * Edit an existing teacher's profile picture, name, designation, or password
 */
router.put('/teachers/:id', verifySuperAdminToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, designation, department, profilePic } = req.body || {};

    const updated = store.updateTeacher(id, { name, username, password, designation, department, profilePic });

    const safeTeacher = { ...updated };
    delete safeTeacher.password;

    // Notify connected clients if Sir's profile changed
    const io = req.app.get('io');
    if (io) {
      io.emit('teacherProfileUpdated', {
        teacher: safeTeacher
      });
    }

    return res.status(200).json({
      success: true,
      message: `Teacher "${safeTeacher.name}" updated successfully!`,
      teacher: safeTeacher
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/superadmin/teachers/:id
 * Delete a teacher / judge
 */
router.delete('/teachers/:id', verifySuperAdminToken, (req, res) => {
  try {
    const { id } = req.params;
    const removed = store.deleteTeacher(id);

    return res.status(200).json({
      success: true,
      message: `Teacher "${removed.name}" has been removed.`,
      removedId: id
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/superadmin/lock
 * Get current Website Lock status
 */
router.get('/lock', verifySuperAdminToken, (req, res) => {
  const settings = store.getSystemSettings();
  return res.status(200).json({
    success: true,
    locked: Boolean(settings.websiteLocked),
    lockedAt: settings.lockedAt,
    lockedBy: settings.lockedBy
  });
});

/**
 * POST /api/superadmin/lock
 * Toggle Website Lock (Read-Only Mode)
 */
router.post('/lock', verifySuperAdminToken, (req, res) => {
  try {
    const { locked } = req.body || {};
    const isLocked = Boolean(locked);

    const updatedSettings = store.setWebsiteLocked(isLocked, req.user ? req.user.name : 'Super Admin');

    // Broadcast lock change via real-time Socket.IO to all participants and teachers
    const io = req.app.get('io');
    if (io) {
      io.emit('websiteLockChanged', {
        locked: isLocked,
        lockedAt: updatedSettings.lockedAt,
        message: isLocked
          ? '🔒 Arena has been LOCKED in Read-Only mode by Super Admin. Submissions and registrations are paused.'
          : '🔓 Arena has been UNLOCKED. Normal operations and submissions have resumed.'
      });
    }

    return res.status(200).json({
      success: true,
      locked: isLocked,
      message: isLocked
        ? 'Website is now LOCKED in Read-Only Mode. Students and teachers cannot modify contest data.'
        : 'Website is now UNLOCKED. Full operational mode resumed.',
      settings: updatedSettings
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/superadmin/status
 * Public status endpoint
 */
router.get('/status', (req, res) => {
  return res.status(200).json({
    success: true,
    locked: store.isWebsiteLocked()
  });
});

module.exports = router;
