// ============================================================================
// V Spark 2026 - Student & Public API Routes
// REST APIs (L5) & Real-Time Event Synchronization (L7)
// ============================================================================

const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { validateRegister } = require('../middleware/validator');

/**
 * POST /api/register
 * Register Solo or Duo Team from any University
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
      message: `Registration submitted! Secret Key: ${team.secretKey}. Request sent to Sir/Judge for approval.`,
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
    let team = store.getTeamByPassKey(query);
    if (!team) {
      team = store.getTeamByRoll(query);
    }
    if (!team) {
      team = store.getTeamById(query);
    }
    if (!team) {
      return res.status(404).json({ success: false, message: `No team found with Secret Key or Roll Number "${query}". Please check your 6-digit key or register.` });
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

module.exports = router;