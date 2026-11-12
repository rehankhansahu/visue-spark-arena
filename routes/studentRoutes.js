// ============================================================================
// V Spark 2026 - Student & Public API Routes
// REST APIs (L5) & Real-Time Event Synchronization (L7)
// ============================================================================

const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { validateRegister, validateStudentLogin } = require('../middleware/validator');
const { generateExamLockScript } = require('../data/examLockGenerator');

/**
 * POST /api/register
 * Register Solo or Duo Team from any University with Username & Password
 * Created in 'pending' status waiting for Sir's approval
 */
router.post('/register', validateRegister, (req, res) => {
  try {
    if (store.isWebsiteLocked()) {
      return res.status(403).json({
        success: false,
        locked: true,
        message: '🔒 Arena is currently LOCKED in Read-Only mode by Super Admin. New team registrations are temporarily disabled.'
      });
    }

    const timer = store.getContestTimer();
    if (timer && timer.status && timer.status !== 'not_started') {
      return res.status(403).json({
        success: false,
        message: 'Registration Closed: The contest is currently in progress or has ended. Sir / Chief Judge must reset the previous contest before new registrations can be accepted.'
      });
    }

    const {
      teamType = 'solo',
      teamName,
      leaderName,
      leaderRoll,
      member2Name,
      member2Roll,
      university,
      language,
      username,
      password,
      secretKey,
      profilePic
    } = req.body;

    const result = store.registerTeam({
      teamType,
      teamName,
      leaderName,
      leaderRoll,
      member2Name,
      member2Roll,
      university,
      language,
      username,
      password,
      secretKey,
      profilePic
    });

    const team = result.team;

    // Broadcast new registration request to Sir / Judge desk via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('newRegistrationRequest', {
        team: team,
        event: result.isNew ? 'PENDING_REGISTRATION_CREATED' : 'EXISTING_TEAM_LOADED'
      });
    }

    return res.status(201).json({
      success: true,
      message: `Registration submitted for @${team.username}! Request sent to Sir/Judge for approval.`,
      isNew: true,
      team: team
    });
  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Registration failed. Please check your details.'
    });
  }
});

/**
 * POST /api/student/login
 * Student / Team login using Username (or Roll No) and Password
 */
router.post('/student/login', validateStudentLogin, (req, res) => {
  try {
    const { username, rollNo, password } = req.body || {};
    const identifier = (username || rollNo || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Team Username (or Roll Number) and Password are required.'
      });
    }

    const team = store.authenticateStudent(identifier, password);
    if (!team) {
      return res.status(401).json({
        success: false,
        message: `No team found with identifier "${identifier}". Please verify your credentials or register.`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${team.teamName}! Contest session active.`,
      team: team,
      resultsPublished: store.isResultsPublished()
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.message || 'Authentication failed. Please check your credentials.'
    });
  }
});

/**
 * GET /api/leaderboard
 * Fetch current real-time rankings
 * Masked if Sir has not yet published official scores
 */
router.get('/leaderboard', (req, res) => {
  try {
    const { includeUnpublished } = req.query;
    const isSir = req.headers.authorization && includeUnpublished === 'true';
    const lbData = store.getLeaderboard(Boolean(isSir));

    return res.status(200).json({
      success: true,
      published: Boolean(lbData.published),
      isResultsPublished: Boolean(lbData.published),
      isArchived: Boolean(lbData.isArchived),
      archivedAt: lbData.archivedAt || null,
      totalPoints: lbData.totalPoints,
      count: lbData.leaderboard.length,
      leaderboard: lbData.published || isSir ? lbData.leaderboard : []
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve leaderboard data'
    });
  }
});

/**
 * GET /api/timer
 * Returns Live Contest Countdown State (not_started, running, paused, ended)
 */
router.get('/timer', (req, res) => {
  try {
    const timer = store.getContestTimer();
    return res.status(200).json({
      success: true,
      timer: timer
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get timer' });
  }
});

/**
 * GET /api/team-status/:passKey
 * Check live approval and kickout status for a specific student pass / Secret Key
 */
router.get('/team-status/:passKey', (req, res) => {
  try {
    const query = (req.params.passKey || '').trim();
    let team = store.getTeamByUsername(query);
    if (!team) {
      team = store.getTeamByPassKey(query);
    }
    if (!team) {
      team = store.getTeamByRoll(query);
    }
    if (!team) {
      team = store.getTeamById(query);
    }
    if (!team) {
      return res.status(404).json({ success: false, message: `No team found with Username, PIN, or Roll Number "${query}". Please check your credentials or register.` });
    }
    return res.status(200).json({
      success: true,
      team: team,
      resultsPublished: store.isResultsPublished()
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to check team status' });
  }
});

/**
 * GET /api/system-status
 * Public endpoint to check website lock / read-only state
 */
router.get('/system-status', (req, res) => {
  return res.status(200).json({
    success: true,
    locked: store.isWebsiteLocked()
  });
});


/**
 * POST /api/team/pc-lock
 * Update Team PC Exam-Lock Status ('locked' | 'unlocked' | 'left')
 */
router.post('/team/pc-lock', (req, res) => {
  try {
    const { passKey, status = 'locked' } = req.body || {};
    if (!passKey) {
      return res.status(400).json({ success: false, message: 'PassKey or Team ID required' });
    }

    const team = store.setTeamPCLock(passKey, status);
    const io = req.app.get('io');
    if (io) {
      io.emit('teamLockStatusChanged', {
        teamId: team.id,
        teamName: team.teamName,
        leaderName: team.leaderName,
        pcLockStatus: team.pcLockStatus,
        pcLockedAt: team.pcLockedAt,
        pcTamperAlert: team.pcTamperAlert
      });
    }

    return res.status(200).json({
      success: true,
      message: `PC Exam-Lock updated to ${status}.`,
      team: {
        id: team.id,
        teamName: team.teamName,
        pcLockStatus: team.pcLockStatus
      }
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/team/pc-heartbeat
 * Keep-alive ping sent by background exam lock script every 4-5 seconds
 */
router.post('/team/pc-heartbeat', (req, res) => {
  try {
    const { passKey } = req.body || {};
    if (!passKey) {
      return res.status(400).json({ success: false, message: 'PassKey is required' });
    }

    const team = store.recordTeamHeartbeat(passKey);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const timer = store.getContestTimer();

    return res.status(200).json({
      success: true,
      contestStatus: timer ? timer.status : 'not_started',
      remainingSeconds: timer ? timer.remainingSeconds : null,
      leftArena: Boolean(team.leftEarly || team.status === 'left_early'),
      teamStatus: team.status
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/team/exam-lock-script/:passKey
 * Download personalized 1-Click Windows Exam-Lock (.bat) script for the team
 */
router.get('/team/exam-lock-script/:passKey', (req, res) => {
  try {
    const passKey = (req.params.passKey || '').trim();
    const team = store.getTeamByUsername(passKey) || store.getTeamByPassKey(passKey) || store.getTeamById(passKey) || store.getTeamByRoll(passKey);

    if (!team) {
      return res.status(404).send('Error: Team record not found. Please register first.');
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host') || 'visue-spark-arena.onrender.com';
    const serverUrl = `${protocol}://${host}`;
    const cleanTeamName = (team.teamName || 'Team').replace(/[^a-zA-Z0-9 _-]/g, '');
    const cleanPassKey = team.secretKey || team.passKey || passKey;
    const cleanUniversity = (team.university || 'University').replace(/[^a-zA-Z0-9 _-]/g, '');

    const arenaInfo = (store.getArenaInfo ? store.getArenaInfo() : null) || {};
    const arenaName = arenaInfo.name || 'V Spark 2026';
    const cleanArenaFilePrefix = arenaName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 24);

    const batContent = generateExamLockScript({
      passKey: cleanPassKey,
      teamName: cleanTeamName,
      university: cleanUniversity,
      serverUrl,
      arenaName: arenaName
    });

    const filename = `${cleanArenaFilePrefix}-ExamLock-${cleanTeamName.replace(/\s+/g, '_')}.bat`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(batContent);
  } catch (err) {
    return res.status(500).send('Error generating exam lock script: ' + err.message);
  }
});

module.exports = router;