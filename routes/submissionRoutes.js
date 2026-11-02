// ============================================================================
// VISUE SPARK 2026 - Submission & Admin Management Routes
// REST APIs (L5) & Real-Time Event Synchronization (L7)
// ============================================================================

const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { verifySirToken } = require('../middleware/auth');
const { validateSubmit, validateBonus } = require('../middleware/validator');

/**
 * GET /api/problems
 * Return contest challenges for the active contest (dynamically scaled, totaling 60 points)
 * Supports ?teamId=... for custom assigned question sets
 */
router.get('/problems', (req, res) => {
  const { teamId } = req.query;
  const problems = store.getProblemsForTeam(teamId);
  const totalPoints = problems.reduce((s, p) => s + (p.points || 0), 0);

  let teamLang = null;
  if (teamId) {
    const t = store.getTeamById(teamId) || store.getTeamByPassKey(teamId) || store.getTeamByRoll(teamId);
    if (t) teamLang = t.language;
  }

  return res.status(200).json({
    success: true,
    mode: store.getQuestionMode(),
    teamLanguage: teamLang,
    totalPoints: totalPoints,
    isReady: (totalPoints === 60),
    problems: problems
  });
});

/**
 * POST /api/submit
 * Student / Team code submission endpoint
 * Works directly from browser Arena, VS Code, or external IDE
 */
router.post('/submit', validateSubmit, (req, res) => {
  try {
    const { teamId, rollNo, passKey, problemId, code, language } = req.body;

    const identifier = teamId || passKey || rollNo;
    let team = store.getTeamById(identifier) || store.getTeamByPassKey(identifier) || store.getTeamByRoll(identifier);

    if (!team) {
      return res.status(400).json({
        success: false,
        message: 'Team record not found. Please register first.'
      });
    }

    if (team.status === 'kicked_out') {
      return res.status(403).json({
        success: false,
        message: 'Your team has been removed/kicked out from this contest by Sir/Judge.'
      });
    }

    if (team.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your registration is still PENDING Sir\'s approval. Please wait for approval.'
      });
    }

    const teamProblems = store.getProblemsForTeam(team.id);
    const totalAssignedPoints = (teamProblems || []).reduce((s, p) => s + (p.points || 0), 0);
    if (!teamProblems || teamProblems.length === 0 || totalAssignedPoints !== 60) {
      return res.status(400).json({
        success: false,
        message: `Contest Arena is locked: Contest questions must total exactly 60 points (Current: ${totalAssignedPoints}/60 pts) before submissions can be accepted.`
      });
    }

    const contestTimer = store.getContestTimer();
    if (contestTimer.status === 'ended' || (contestTimer.remainingSeconds !== undefined && contestTimer.remainingSeconds <= 0 && contestTimer.status !== 'not_started')) {
      return res.status(403).json({
        success: false,
        message: 'Contest time has expired! No further submissions are accepted. Workspace is in read-only mode.'
      });
    }

    const result = store.addSubmission({
      teamId: team.id,
      problemId,
      code,
      language: language || team.language,
      status: 'AC'
    });

    const io = req.app.get('io');
    if (io) {
      const lbData = store.getLeaderboard(false);
      io.emit('leaderboardUpdate', {
        published: lbData.published,
        leaderboard: lbData.leaderboard,
        event: 'NEW_SUBMISSION',
        submission: result.submission,
        team: result.team
      });

      // Stream to Sir's Desk
      io.emit('newSubmission', result.submission);

      // If team finished all challenges, broadcast milestone alert
      if (result.allChallengesSolved || result.allThreeSolved) {
        io.emit('allChallengesCompleted', {
          teamId: team.id,
          teamName: team.teamName,
          university: team.university,
          score: result.team.score,
          totalAssignedCount: result.totalAssignedCount,
          timeTakenSeconds: result.team.timeTakenSeconds,
          timeTakenFormatted: result.team.timeTakenFormatted,
          timeTakenWords: result.team.timeTakenWords
        });

        // Check if all approved teams have finished (or single team in testing)
        const approved = store.getApprovedTeams();
        const allApprovedFinished = approved.length > 0 && approved.every(t => {
          const tProbs = store.getProblemsForTeam(t.id);
          const solved = (t.solvedProblems && tProbs.length > 0 && tProbs.every(p => t.solvedProblems.includes(p.id)));
          return solved || t.leftEarly || t.isCompleted;
        });

        if (allApprovedFinished) {
          const pausedTimer = store.pauseTimer();
          io.emit('timerStatusChange', { timer: pausedTimer });
          io.emit('allTeamsFinished', {
            message: 'All approved teams have completed their challenges! Contest clock stopped.',
            timer: pausedTimer
          });
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `Solution Accepted! +${result.submission.scoreAwarded} points awarded.`,
      submission: result.submission,
      team: result.team,
      teamScore: result.team.score,
      solvedProblems: result.team.solvedProblems,
      submittedSolutions: result.team.submittedSolutions,
      allThreeSolved: result.allChallengesSolved || result.allThreeSolved,
      allChallengesSolved: result.allChallengesSolved || result.allThreeSolved,
      totalAssignedCount: result.totalAssignedCount,
      timeTakenSeconds: result.team.timeTakenSeconds,
      timeTakenFormatted: result.team.timeTakenFormatted,
      timeTakenWords: result.team.timeTakenWords
    });
  } catch (err) {
    console.error('[Submit Error]', err.message);
    return res.status(400).json({
      success: false,
      message: err.message || 'Submission failed'
    });
  }
});

/**
 * POST /api/leave-contest
 * Student/Team chooses to leave contest early (Incomplete)
 * Submits all current work to Sir and flags the team as left_early
 */
router.post('/leave-contest', (req, res) => {
  try {
    const { teamId, passKey, draftCodeMap = {}, language, isTimeUp } = req.body;
    const identifier = teamId || passKey;
    const team = store.getTeamById(identifier) || store.getTeamByPassKey(identifier) || store.getTeamByRoll(identifier);

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team record not found.' });
    }

    if (team.status === 'kicked_out') {
      return res.status(403).json({ success: false, message: 'Your team has already been disqualified by Sir.' });
    }

    const result = store.leaveContestEarly({
      teamId: team.id,
      draftCodeMap,
      language: language || team.language,
      isTimeUp: Boolean(isTimeUp)
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('teamLeftEarly', {
        teamId: result.team.id,
        teamName: result.team.teamName,
        leaderName: result.team.leaderName,
        leaderRoll: result.team.leaderRoll,
        university: result.team.university,
        solvedCount: (result.team.solvedProblems || []).length,
        score: result.team.score,
        leftAt: result.team.leftAt
      });

      // Stream recorded partial submissions to Sir's desk
      if (result.recordedSubmissions) {
        result.recordedSubmissions.forEach(sub => {
          io.emit('newSubmission', sub);
        });
      }

      // Update leaderboard
      const lbData = store.getLeaderboard(true);
      io.emit('leaderboardUpdate', {
        published: true,
        totalPoints: lbData.totalPoints,
        leaderboard: lbData.leaderboard,
        event: 'TEAM_LEFT_EARLY',
        team: result.team
      });
    }

    return res.status(200).json({
      success: true,
      message: 'You have left the contest early. Your work has been submitted to the Chief Judge for evaluation.',
      team: result.team,
      recordedSubmissionsCount: result.recordedSubmissions ? result.recordedSubmissions.length : 0
    });
  } catch (err) {
    console.error('[Leave Contest Error]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to process early contest exit' });
  }
});

/**
 * GET /api/submissions
 * Get all contest submissions for Sir's Desk
 */
router.get('/submissions', (req, res) => {
  try {
    const submissions = store.getAllSubmissions();
    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions: submissions
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve submissions'
    });
  }
});

/**
 * GET /api/admin/pending-requests
 * Retrieve all pending registration requests
 */
router.get('/admin/pending-requests', (req, res) => {
  try {
    const pending = store.getPendingTeams();
    return res.status(200).json({
      success: true,
      count: pending.length,
      teams: pending
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get pending requests' });
  }
});

/**
 * GET /api/admin/approved-teams
 * Retrieve all approved teams for management & kickout control
 */
router.get('/admin/approved-teams', verifySirToken, (req, res) => {
  try {
    const approved = store.getApprovedTeams();
    const readiness = store.getContestReadiness();
    return res.status(200).json({
      success: true,
      count: approved.length,
      teams: approved,
      readiness: readiness
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve teams' });
  }
});

/**
 * POST /api/admin/approve-team
 * Sir approves a pending team
 */
router.post('/admin/approve-team', verifySirToken, (req, res) => {
  try {
    const { teamId } = req.body;
    const team = store.approveTeam(teamId);

    const io = req.app.get('io');
    if (io) {
      io.emit('teamApproved', {
        teamId: team.id,
        passKey: team.passKey,
        teamName: team.teamName,
        leaderRoll: team.leaderRoll
      });

      const lbData = store.getLeaderboard(false);
      io.emit('leaderboardUpdate', {
        published: lbData.published,
        leaderboard: lbData.leaderboard,
        event: 'TEAM_APPROVED'
      });

      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }

    return res.status(200).json({
      success: true,
      message: `Team "${team.teamName}" approved successfully! Pass activated.`,
      team: team
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/reject-team
 * Sir rejects a pending team
 */
router.post('/admin/reject-team', verifySirToken, (req, res) => {
  try {
    const { teamId } = req.body;
    const team = store.rejectTeam(teamId);

    const io = req.app.get('io');
    if (io) {
      io.emit('teamRejected', {
        teamId: team.id,
        passKey: team.passKey,
        teamName: team.teamName
      });
      io.emit('pendingRequestsUpdated', store.getPendingTeams());
    }

    return res.status(200).json({
      success: true,
      message: `Team "${team.teamName}" registration rejected and removed.`,
      team: team
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/kickout-team
 * Sir kicks out / disqualifies / removes a team from the competition
 */
router.post('/admin/kickout-team', verifySirToken, (req, res) => {
  try {
    const { teamId } = req.body;
    const team = store.kickoutTeam(teamId);

    const io = req.app.get('io');
    if (io) {
      io.emit('teamKickedOut', {
        teamId: team.id,
        passKey: team.passKey,
        teamName: team.teamName
      });
      io.emit('approvedTeamsUpdated', store.getApprovedTeams());
      io.emit('pendingRequestsUpdated', store.getPendingTeams());

      const lbData = store.getLeaderboard(false);
      io.emit('leaderboardUpdate', {
        published: lbData.published,
        leaderboard: lbData.leaderboard,
        event: 'TEAM_KICKED_OUT'
      });
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }

    return res.status(200).json({
      success: true,
      message: `Team "${team.teamName}" has been removed and pass revoked.`,
      team: team
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/remove-team
 * Sir explicitly removes a team (Pending or Approved)
 */
router.post('/admin/remove-team', verifySirToken, (req, res) => {
  try {
    const { teamId } = req.body;
    const team = store.deleteTeam(teamId);

    const io = req.app.get('io');
    if (io) {
      io.emit('teamKickedOut', {
        teamId: team.id,
        passKey: team.passKey,
        teamName: team.teamName
      });
      io.emit('approvedTeamsUpdated', store.getApprovedTeams());
      io.emit('pendingRequestsUpdated', store.getPendingTeams());

      const lbData = store.getLeaderboard(false);
      io.emit('leaderboardUpdate', {
        published: lbData.published,
        leaderboard: lbData.leaderboard,
        event: 'TEAM_REMOVED'
      });
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }

    return res.status(200).json({
      success: true,
      message: `Team "${team.teamName}" removed successfully.`,
      team: team
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * TIMER MANAGEMENT ENDPOINTS (Sir's Control)
 */
router.post('/admin/timer/start', verifySirToken, (req, res) => {
  try {
    const timer = store.startTimer();
    const io = req.app.get('io');
    if (io) {
      io.emit('timerStatusChange', { timer });
      io.emit('questionsUpdated', {});
    }
    return res.status(200).json({ success: true, message: 'Contest timer started!', timer });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/timer/pause', verifySirToken, (req, res) => {
  try {
    const timer = store.pauseTimer();
    const io = req.app.get('io');
    if (io) {
      io.emit('timerStatusChange', { timer });
      io.emit('questionsUpdated', {});
    }
    return res.status(200).json({ success: true, message: 'Contest timer paused.', timer });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/timer/reset', verifySirToken, (req, res) => {
  try {
    const result = store.resetContestFull();
    const timer = result.timer;
    const io = req.app.get('io');
    if (io) {
      io.emit('timerStatusChange', { timer });
      io.emit('contestReset', {
        message: 'Contest has been completely reset by Sir. All teams and submissions have been cleared for a new contest round.'
      });
      // Retain archived podium/leaderboard if available so students and public can view previous winners
      if (store.hasArchivedPodium()) {
        io.emit('leaderboardUpdate', {
          published: true,
          isArchived: true,
          archivedAt: store.getArchivedAt(),
          totalPoints: 60,
          leaderboard: store.getArchivedLeaderboard(),
          event: 'CONTEST_RESET_ARCHIVED'
        });
      } else {
        io.emit('leaderboardUpdate', {
          published: false,
          isArchived: false,
          totalPoints: 60,
          leaderboard: [],
          event: 'CONTEST_RESET'
        });
      }
      io.emit('questionsUpdated', {});
      io.emit('pendingRequestsUpdated', []);
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }
    return res.status(200).json({
      success: true,
      message: 'Contest timer and all teams/submissions have been completely reset. Previous podium standings archived.',
      timer,
      hasArchivedPodium: store.hasArchivedPodium()
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Alias for full contest reset
router.post('/admin/reset-contest', verifySirToken, (req, res, next) => {
  req.url = '/admin/timer/reset';
  router.handle(req, res, next);
});

/**
 * POST /api/admin/reset-contest-all
 * Full Contest & Podium Reset: Wipes all teams, submissions, questions, timer, AND podium archive
 */
router.post('/admin/reset-contest-all', verifySirToken, (req, res) => {
  try {
    const result = store.resetContestWipeAll();
    const timer = result.timer;
    const io = req.app.get('io');
    if (io) {
      io.emit('timerStatusChange', { timer });
      io.emit('contestReset', {
        message: 'Contest and podium have been completely wiped clean by Sir.',
        wipePodium: true
      });
      io.emit('podiumWiped', {});
      io.emit('leaderboardUpdate', {
        published: false,
        isArchived: false,
        totalPoints: 60,
        leaderboard: [],
        event: 'CONTEST_FULL_WIPED'
      });
      io.emit('questionsUpdated', {});
      io.emit('pendingRequestsUpdated', []);
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }
    return res.status(200).json({
      success: true,
      message: 'Full contest and podium have been completely wiped clean.',
      timer
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/timer/duration', verifySirToken, (req, res) => {
  try {
    const { minutes } = req.body;
    const timer = store.setContestDuration(minutes);
    const io = req.app.get('io');
    if (io) io.emit('timerStatusChange', { timer, event: 'DURATION_CHANGED' });
    return res.status(200).json({
      success: true,
      message: `Contest duration updated to ${timer.durationMinutes} minutes.`,
      timer
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * QUESTION BANK & 60-POINT CONTEST ASSIGNMENT ENDPOINTS
 */
router.get('/admin/questions', verifySirToken, (req, res) => {
  try {
    const bank = store.getQuestionBank();
    const activeQuestions = store.getActiveContestQuestions();
    const activeIds = store.getActiveContestQuestionIds();
    const totalPoints = store.getActiveContestPoints();
    const slots = store.getActiveGlobalSlots();
    const mode = store.getQuestionMode();
    const readiness = store.getContestReadiness();
    return res.status(200).json({
      success: true,
      bank,
      activeIds,
      activeQuestions,
      totalPoints,
      isReady: (totalPoints === 60),
      activeSlots: slots,
      mode,
      readiness
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/readiness
 * Returns comprehensive team question readiness & progress across all approved teams
 */
router.get('/admin/readiness', verifySirToken, (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      readiness: store.getContestReadiness()
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Guard: Locked while contest is running
 */
const ensureContestNotRunning = (req, res, next) => {
  const timer = store.getContestTimer();
  if (timer.status === 'running') {
    return res.status(403).json({
      success: false,
      message: 'Competition is currently RUNNING! Question modifications are locked while the contest is active. Pause the timer first if modifications are required.'
    });
  }
  next();
};

router.post('/admin/contest-questions/toggle', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { questionId, forceAction } = req.body;
    const result = store.toggleContestQuestion(questionId, forceAction);
    const io = req.app.get('io');
    if (io) {
      io.emit('questionsUpdated', {
        activeIds: result.activeIds,
        activeQuestions: result.activeQuestions,
        totalPoints: result.totalPoints,
        isReady: result.isReady
      });
    }
    return res.status(200).json({
      success: true,
      message: `Contest questions updated! Total Points: ${result.totalPoints}/60 pts.`,
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/contest-questions/set', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { questionIds } = req.body;
    const result = store.setContestQuestions(questionIds);
    const io = req.app.get('io');
    if (io) {
      io.emit('questionsUpdated', {
        activeIds: result.activeIds,
        activeQuestions: result.activeQuestions,
        totalPoints: result.totalPoints,
        isReady: result.isReady
      });
    }
    return res.status(200).json({
      success: true,
      message: `Contest questions updated! Total Points: ${result.totalPoints}/60 pts.`,
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/contest-questions/preset', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { presetName } = req.body;
    const result = store.applyContestPreset(presetName);
    const io = req.app.get('io');
    if (io) {
      io.emit('questionsUpdated', {
        activeIds: result.activeIds,
        activeQuestions: result.activeQuestions,
        totalPoints: result.totalPoints,
        isReady: result.isReady,
        preset: presetName
      });
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }
    return res.status(200).json({
      success: true,
      message: `Preset "${presetName}" applied! Total Points: ${result.totalPoints}/60 pts.`,
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/questions', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const newQ = store.addQuestionToBank(req.body);
    const io = req.app.get('io');
    if (io) {
      io.emit('questionsUpdated', { bankCount: store.getQuestionBank().length });
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }
    return res.status(201).json({
      success: true,
      message: `Question #${newQ.id} ("${newQ.title}") added to bank!`,
      question: newQ
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/admin/questions/:id', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { id } = req.params;
    store.removeQuestionFromBank(id);
    const io = req.app.get('io');
    if (io) {
      io.emit('questionsUpdated', { bankCount: store.getQuestionBank().length });
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }
    return res.status(200).json({
      success: true,
      message: `Question #${id} removed from bank.`
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/assign-question', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { slot, questionId } = req.body;
    const slots = store.assignGlobalSlot(slot, questionId);
    const io = req.app.get('io');
    if (io) {
      io.emit('questionsUpdated', { activeSlots: slots });
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }
    return res.status(200).json({
      success: true,
      message: `Slot "${slot}" assigned to Question #${questionId}.`,
      activeSlots: slots
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/question-mode', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { mode } = req.body;
    const newMode = store.setQuestionMode(mode);
    const io = req.app.get('io');
    if (io) io.emit('questionsUpdated', { mode: newMode });
    return res.status(200).json({
      success: true,
      message: `Question mode updated to: ${newMode}.`,
      mode: newMode
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/teams-with-questions
 * Sir views all approved teams with their registered language, assigned questions, and points
 */
router.get('/admin/teams-with-questions', verifySirToken, (req, res) => {
  try {
    const approved = store.getApprovedTeams();
    const bank = store.getQuestionBank();

    const teamsData = approved.map(team => {
      const teamAssignment = store.getTeamQuestions(team.id);
      const matchingBankCount = bank.filter(q => store.doesQuestionMatchLanguage(q, team.language)).length;

      return {
        id: team.id,
        teamName: team.teamName,
        university: team.university,
        language: team.language || 'python',
        rollNo: team.rollNo,
        leaderName: team.leaderName,
        member2Name: team.member2Name,
        assignedQuestionIds: teamAssignment.questionIds,
        assignedQuestions: teamAssignment.questions,
        totalPoints: teamAssignment.totalPoints,
        isReady: teamAssignment.isReady,
        matchingBankCount
      };
    });

    return res.status(200).json({
      success: true,
      teams: teamsData,
      totalTeams: teamsData.length
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/team-questions/:teamId
 * Sir gets a team's questions and available matching bank questions
 */
router.get('/admin/team-questions/:teamId', verifySirToken, (req, res) => {
  try {
    const { teamId } = req.params;
    const teamAssignment = store.getTeamQuestions(teamId);
    const bank = store.getQuestionBank();

    // Filter available bank questions strictly matching the team's language!
    const availableQuestions = bank.filter(q => store.doesQuestionMatchLanguage(q, teamAssignment.team.language));

    return res.status(200).json({
      success: true,
      team: teamAssignment.team,
      questionIds: teamAssignment.questionIds,
      questions: teamAssignment.questions,
      totalPoints: teamAssignment.totalPoints,
      isReady: teamAssignment.isReady,
      availableQuestions: availableQuestions
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/team-questions
 * Sir updates the custom question assignment for a team
 */
router.post('/admin/team-questions', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { teamId, questionIds } = req.body;
    const result = store.setTeamQuestionsDirect(teamId, questionIds);

    const io = req.app.get('io');
    if (io) {
      io.emit('teamQuestionsUpdated', {
        teamId: result.teamId,
        questionIds: result.questionIds,
        questions: result.questions,
        totalPoints: result.totalPoints,
        isReady: result.isReady
      });
      io.emit('questionsUpdated', { mode: 'different' });
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }

    return res.status(200).json({
      success: true,
      message: `Questions updated for team! Total Points: ${result.totalPoints}/60 pts.`,
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/team-questions/preset
 * Sir auto-assigns 1E + 1M + 1H in the team's registered language
 */
router.post('/admin/team-questions/preset', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { teamId, presetName = 'standard' } = req.body;
    const result = store.autoAssignTeamPreset(teamId, presetName);

    const io = req.app.get('io');
    if (io) {
      io.emit('teamQuestionsUpdated', {
        teamId: result.teamId,
        questionIds: result.questionIds,
        questions: result.questions,
        totalPoints: result.totalPoints,
        isReady: result.isReady
      });
      io.emit('questionsUpdated', { mode: 'different' });
      io.emit('contestReadinessUpdated', store.getContestReadiness());
    }

    return res.status(200).json({
      success: true,
      message: `Standard preset applied for team! Total: 60/60 pts.`,
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/assign-team-question
 * Sir assigns a specific question to a specific team (Custom Assignment)
 */
router.post('/admin/assign-team-question', verifySirToken, ensureContestNotRunning, (req, res) => {
  try {
    const { teamId, slot, questionId } = req.body;
    const current = store.assignTeamQuestion(teamId, slot, Number(questionId));
    store.setQuestionMode('different');
    const io = req.app.get('io');
    if (io) {
      io.emit('teamQuestionsUpdated', { teamId, slots: current });
      io.emit('questionsUpdated', { mode: 'different' });
    }
    return res.status(200).json({
      success: true,
      message: `Question #${questionId} successfully assigned to Team!`,
      slots: current
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * RESULTS PUBLISHING & GRADING ENDPOINTS (Sir's Control)
 */
router.post('/admin/publish-results', verifySirToken, (req, res) => {
  try {
    store.publishResults();
    const fullLeaderboard = store.getLeaderboard(true);
    const io = req.app.get('io');
    if (io) {
      io.emit('resultsPublished', {
        published: true,
        leaderboard: fullLeaderboard.leaderboard
      });
      io.emit('leaderboardUpdate', {
        published: true,
        leaderboard: fullLeaderboard.leaderboard,
        event: 'RESULTS_PUBLISHED'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Official results and podium published successfully! Visible to all.',
      leaderboard: fullLeaderboard.leaderboard
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/unpublish-results', verifySirToken, (req, res) => {
  try {
    store.unpublishResults();
    const io = req.app.get('io');
    if (io) {
      io.emit('resultsUnpublished', { published: false });
      io.emit('leaderboardUpdate', {
        published: false,
        leaderboard: [],
        event: 'RESULTS_UNPUBLISHED'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Official results masked. Podium is now hidden from participants.'
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/admin/grade-submission', verifySirToken, (req, res) => {
  try {
    const { submissionId, marks, judgeNotes } = req.body;
    const result = store.gradeSubmission({ submissionId, marks, judgeNotes });

    const io = req.app.get('io');
    if (io) {
      const lbData = store.getLeaderboard(true);
      io.emit('leaderboardUpdate', {
        published: true,
        totalPoints: lbData.totalPoints,
        leaderboard: lbData.leaderboard,
        event: 'GRADE_UPDATED'
      });

      // Unmask and reveal podium to all screens immediately
      io.emit('resultsPublished', {
        published: true,
        totalPoints: lbData.totalPoints,
        leaderboard: lbData.leaderboard
      });
    }

    return res.status(200).json({
      success: true,
      message: `Score updated to ${marks} marks for submission #${submissionId}.`,
      submission: result.submission,
      team: result.team
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/submissions/bonus
 * Judge awards bonus marks
 */
router.post('/submissions/bonus', verifySirToken, validateBonus, (req, res) => {
  try {
    const { submissionId, bonus = 10 } = req.body;
    const result = store.awardBonus(submissionId, bonus);

    const io = req.app.get('io');
    if (io) {
      const lbData = store.getLeaderboard(true);
      io.emit('leaderboardUpdate', {
        published: true,
        totalPoints: lbData.totalPoints,
        leaderboard: lbData.leaderboard,
        event: 'BONUS_AWARDED',
        detail: {
          teamName: result.team.teamName,
          bonusAdded: bonus,
          newScore: result.team.score
        }
      });

      io.emit('resultsPublished', {
        published: true,
        totalPoints: lbData.totalPoints,
        leaderboard: lbData.leaderboard
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully awarded +${bonus} bonus marks to ${result.team.teamName}!`,
      submission: result.submission,
      team: result.team
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to award bonus'
    });
  }
});

module.exports = router;