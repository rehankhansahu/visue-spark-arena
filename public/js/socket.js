// ============================================================================
// V Spark 2026 - Socket.IO Client Module
// Real-Time Event Engine: Leaderboard Sync, Live Approvals, Timer, & Results
// ============================================================================

let socket = null;

function initSocketClient() {
  try {
    socket = io();

    const liveStatusText = document.getElementById('liveStatusText');
    const livePulseDot = document.getElementById('livePulseDot');
    const activeUsersCount = document.getElementById('activeUsersCount');

    // Socket connected
    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to arena server. Session ID:', socket.id);
      if (liveStatusText) liveStatusText.textContent = 'LIVE CONNECTED';
      if (livePulseDot) {
        livePulseDot.classList.remove('bg-red-500');
        livePulseDot.classList.add('bg-emerald-500');
      }
    });

    // Socket disconnected
    socket.on('disconnect', () => {
      console.warn('[Socket.IO] Disconnected from arena server');
      if (liveStatusText) liveStatusText.textContent = 'OFFLINE (RECONNECTING)';
      if (livePulseDot) {
        livePulseDot.classList.remove('bg-emerald-500');
        livePulseDot.classList.add('bg-red-500');
      }
    });

    // Server stats
    socket.on('statsUpdate', (data) => {
      if (activeUsersCount && data.activeUsers) {
        activeUsersCount.textContent = `${data.activeUsers} Live`;
      }
    });

    // Contest Timer Status Change (Start, Pause, Reset by Sir)
    socket.on('timerStatusChange', (data) => {
      console.log('[Socket.IO] Timer status changed:', data);
      if (window.handleTimerStateUpdate && data.timer) {
        window.handleTimerStateUpdate(data.timer);
      }
      if (window.loadProblems) {
        window.loadProblems();
      }
      if (window.refreshArenaState) {
        window.refreshArenaState();
      }
      if (data.timer.status === 'running') {
        showToast('⏳ Contest Started!', 'The 90-minute countdown is now running.', 'info');
      } else if (data.timer.status === 'paused') {
        showToast('⏸️ Timer Paused', 'Contest timer has been paused by Sir/Judge.', 'warning');
      } else if (data.timer.status === 'not_started') {
        showToast('🔄 Timer Reset', 'Contest timer has been reset by Sir/Judge.', 'info');
      }
    });

    // Contest Completely Reset by Sir (Full wipe of teams, submissions, timer)
    socket.on('contestReset', (data) => {
      console.log('[Socket.IO] Contest reset event received:', data);
      showToast('⚠️ Contest Reset', data && data.message ? data.message : 'The contest has been reset by Sir. All teams and submissions have been cleared.', 'warning');

      // Clear student local storage and session
      localStorage.removeItem('visue_team');
      sessionStorage.removeItem('visue_team');
      window.isContestTimeUp = false;

      // Clean all saved code drafts from localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('visue_code_') || key.startsWith('visue_submitted_')) {
          localStorage.removeItem(key);
        }
      });

      if (window.setCurrentTeam) {
        window.setCurrentTeam(null);
      }
      if (window.updateTeamProfile) {
        window.updateTeamProfile(null);
      }
      if (window.switchView) {
        window.switchView('pass');
      }

      if (data && data.wipePodium) {
        if (window.renderLeaderboard) {
          window.renderLeaderboard([], false, false);
        }
      } else {
        // Re-fetch leaderboard to keep archived podium winners visible!
        if (window.fetchInitialLeaderboard) {
          window.fetchInitialLeaderboard();
        }
      }

      // If Sir's Desk is active, refresh the panels
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
      if (window.loadPendingRequests) {
        window.loadPendingRequests();
      }
      if (window.loadJudgeSubmissions) {
        window.loadJudgeSubmissions();
      }
      if (window.loadQuestionBank) {
        window.loadQuestionBank();
      }
      if (window.updateResultsPublishBadge) {
        window.updateResultsPublishBadge(false, true);
      }
    });

    socket.on('podiumWiped', () => {
      if (window.renderLeaderboard) {
        window.renderLeaderboard([], false, false);
      }
      if (window.updateResultsPublishBadge) {
        window.updateResultsPublishBadge(false, true);
      }
    });

    // Leaderboard broadcast
    socket.on('leaderboardUpdate', (payload) => {
      console.log('[Socket.IO] Leaderboard updated via broadcast:', payload.event);
      if (window.renderLeaderboard) {
        window.renderLeaderboard(payload.leaderboard, payload.published, Boolean(payload.isArchived));
      }

      // Sync active student profile if updated
      const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
      if (currentTeam && payload.leaderboard && payload.leaderboard.length > 0) {
        const found = payload.leaderboard.find(t => t.id === currentTeam.id || t.passKey === currentTeam.passKey);
        if (found) {
          window.updateTeamProfile(found);
        }
      }

      // Ticker notification
      if (payload.event === 'NEW_SUBMISSION' && payload.submission) {
        const s = payload.submission;
        showToast(
          `🚀 Submission: ${s.teamName}`,
          `${s.university} submitted "${s.problemTitle}" (${s.language.toUpperCase()})`,
          'info'
        );
      } else if (payload.event === 'BONUS_AWARDED' && payload.detail) {
        const d = payload.detail;
        showToast(
          `⭐ Bonus Marks Awarded!`,
          `Sir awarded +${d.bonusAdded} marks to ${d.teamName}`,
          'success'
        );
      }
    });

    // Team Approved by Sir
    socket.on('teamApproved', (data) => {
      console.log('[Socket.IO] Team approved event:', data);
      const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
      if (currentTeam && (currentTeam.id === data.teamId || currentTeam.passKey === data.passKey || currentTeam.leaderRoll === data.leaderRoll)) {
        currentTeam.status = 'approved';
        window.updateTeamProfile(currentTeam);
        showToast(
          '🎉 Pass Approved by Sir!',
          `Your team "${data.teamName}" has been verified! Welcome to the Speed Arena.`,
          'success'
        );
        // Refresh Arena view to unlock workspace and fetch problems
        if (window.loadProblems) window.loadProblems();
        if (window.refreshArenaState) window.refreshArenaState();
      }

      if (window.loadPendingRequests) {
        window.loadPendingRequests();
      }
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
    });

    // Team Rejected by Sir
    socket.on('teamRejected', (data) => {
      const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
      if (currentTeam && (currentTeam.id === data.teamId || currentTeam.passKey === data.passKey || currentTeam.secretKey === data.passKey)) {
        showToast('Registration Rejected', `Your registration for "${data.teamName}" was rejected by Sir. You can register again with updated details.`, 'warning');
        if (window.handleUnlinkTeam) {
          window.handleUnlinkTeam(false);
        } else if (window.updateTeamProfile) {
          window.updateTeamProfile(null);
        }
        if (window.switchView) window.switchView('pass');
      }
      if (window.loadPendingRequests) {
        window.loadPendingRequests();
      }
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
    });

    // Team Kicked Out / Removed by Sir
    socket.on('teamKickedOut', (data) => {
      console.log('[Socket.IO] Team kicked out / removed:', data);
      const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
      if (currentTeam && (currentTeam.id === data.teamId || currentTeam.passKey === data.passKey || currentTeam.secretKey === data.passKey)) {
        alert(`⚠️ Notice: Your team "${data.teamName}" has been removed / disqualified by Sir / Judge. You may register again or consult Sir.`);
        if (window.handleUnlinkTeam) {
          window.handleUnlinkTeam(false);
        } else if (window.updateTeamProfile) {
          window.updateTeamProfile(null);
        }
        if (window.switchView) window.switchView('pass');
      }
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
      if (window.loadPendingRequests) {
        window.loadPendingRequests();
      }
    });

    // Team Left Contest Early (Incomplete)
    socket.on('teamLeftEarly', (data) => {
      console.log('[Socket.IO] Team left contest early:', data);
      const sirToken = sessionStorage.getItem('sirToken');
      if (sirToken) {
        showToast(
          '🚪 Team Left Contest Early',
          `Team "${data.teamName}" exited early. Their solutions have been submitted for review.`,
          'warning'
        );
      }
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
      if (window.loadJudgeSubmissions) {
        window.loadJudgeSubmissions();
      }
    });

    // New Registration Request (For Sir's Desk Live Alert)
    socket.on('newRegistrationRequest', (data) => {
      console.log('[Socket.IO] New pending registration:', data);
      if (window.loadPendingRequests) {
        window.loadPendingRequests();
      }
      const sirToken = sessionStorage.getItem('sirToken');
      if (sirToken) {
        showToast('👥 New Registration Request', `Team "${data.team.teamName}" (${data.team.university}) awaiting approval.`, 'info');
      }
    });

    // Live submission feed for Sir's Desk
    socket.on('newSubmission', (sub) => {
      console.log('[Socket.IO] Live submission received:', sub);
      if (window.prependSubmissionToSirDesk) {
        window.prependSubmissionToSirDesk(sub);
      }
    });

    // Results Published by Sir!
    socket.on('resultsPublished', (data) => {
      console.log('[Socket.IO] Official Results Published by Sir!');
      showToast(
        '🏆 Official Standings Released!',
        'Sir has published the official competition results & podium.',
        'success'
      );
      if (window.renderLeaderboard) {
        window.renderLeaderboard(data.leaderboard, true);
      }
      if (window.showPodiumButtonInArena) {
        window.showPodiumButtonInArena();
      }
    });

    // Results Unpublished by Sir
    socket.on('resultsUnpublished', () => {
      console.log('[Socket.IO] Official Results Masked by Sir');
      if (window.renderLeaderboard) {
        window.renderLeaderboard([], false);
      }
      if (window.hidePodiumButtonInArena) {
        window.hidePodiumButtonInArena();
      }
    });

    // Questions updated in Bank
    socket.on('questionsUpdated', () => {
      if (window.loadProblems) {
        window.loadProblems();
      }
      if (window.loadQuestionBank) {
        window.loadQuestionBank();
      }
    });

    // Custom Team Questions updated by Sir
    socket.on('teamQuestionsUpdated', (data) => {
      console.log('[Socket.IO] Custom team questions updated:', data);
      const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
      if (currentTeam && currentTeam.id === data.teamId) {
        showToast('🎯 Challenge Update', 'Sir has assigned customized contest questions to your team!', 'info');
      }
      if (window.loadProblems) {
        window.loadProblems();
      }
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
      if (window.renderContestReadinessMeter) {
        window.renderContestReadinessMeter();
      }
    });

    // Global Website Lock / Read-Only Mode Changed by Super Admin
    socket.on('websiteLockChanged', (data) => {
      console.log('[Socket.IO] Website Lock Status Changed:', data);
      if (window.applyWebsiteLockState) {
        window.applyWebsiteLockState(data.locked);
      }
      showToast(
        data.locked ? '🔒 Read-Only Mode Active' : '🔓 Normal Mode Restored',
        data.message || (data.locked ? 'Website has been locked in Read-Only mode by Super Admin.' : 'Website has been unlocked.'),
        data.locked ? 'warning' : 'success'
      );
    });

    // Teacher Profile Picture or Details Updated by Super Admin
    socket.on('teacherProfileUpdated', (data) => {
      console.log('[Socket.IO] Teacher profile updated:', data);
      if (window.updateSirHeaderProfile && data.teacher) {
        window.updateSirHeaderProfile(data.teacher);
      }
    });

    // Contest Questions Readiness Updated (Live progress bar update across all screens)
    socket.on('contestReadinessUpdated', (data) => {
      console.log('[Socket.IO] Contest readiness updated:', data);
      if (window.renderContestReadinessMeter) {
        window.renderContestReadinessMeter(data);
      }
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
    });

    // Judge Session Force-Unlocked or Changed from another device (Option A)
    socket.on('judgeSessionChanged', (data) => {
      console.log('[Socket.IO] Judge session changed:', data);
      const token = sessionStorage.getItem('sirToken');
      if (token) {
        fetch('/api/verify-auth', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(authData => {
          if (!authData.success) {
            sessionStorage.removeItem('sirToken');
            if (window.currentJudge) window.currentJudge = null;
            const gate = document.getElementById('sirLoginGate');
            const dash = document.getElementById('sirDashboard');
            if (gate) gate.classList.remove('hidden');
            if (dash) dash.classList.add('hidden');
            const errEl = document.getElementById('sirLoginError');
            if (errEl) {
              errEl.innerHTML = `
                <div class="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-left text-xs space-y-1">
                  <div class="font-bold flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Session Ended</span>
                  </div>
                  <p class="text-[11px] text-slate-300">
                    Your Judge session has ended because the portal was unlocked on another device.
                  </p>
                </div>
              `;
            }
            if (window.showToast) {
              window.showToast('Session Ended ⚠️', 'Judge Portal was unlocked on another device.', 'warning');
            }
          }
        })
        .catch(() => {});
      }
    });

    // All 3 Challenges Completed by a Team
    socket.on('allChallengesCompleted', (data) => {
      console.log('[Socket.IO] All challenges completed by team:', data);
      const sirToken = sessionStorage.getItem('sirToken');
      if (sirToken) {
        showToast(
          '🏆 ALL 3 SOLVED!',
          `Team "${data.teamName}" (${data.university}) completed all challenges in ${data.timeTakenWords || data.timeTakenFormatted || 'record time'}!`,
          'success'
        );
        if (window.loadApprovedTeams) window.loadApprovedTeams();
        if (window.loadJudgeSubmissions) window.loadJudgeSubmissions();
      }

      const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
      if (currentTeam && currentTeam.id === data.teamId) {
        currentTeam.isCompleted = true;
        currentTeam.timeTakenSeconds = data.timeTakenSeconds;
        currentTeam.timeTakenFormatted = data.timeTakenFormatted;
        currentTeam.timeTakenWords = data.timeTakenWords;
        if (window.updateTeamProfile) window.updateTeamProfile(currentTeam);
        if (window.freezeTeamTimer) window.freezeTeamTimer(data.timeTakenFormatted, data.timeTakenWords);
        if (window.checkAllProblemsCompleted) window.checkAllProblemsCompleted();
      }
    });

    // All Teams in Arena have finished (clock automatically paused/stopped)
    socket.on('allTeamsFinished', (data) => {
      console.log('[Socket.IO] All teams finished contest:', data);
      showToast('🎉 All Teams Finished!', data.message || 'Contest clock has stopped.', 'info');
      if (data.timer && window.handleTimerStateUpdate) {
        window.handleTimerStateUpdate(data.timer);
      }
      if (window.loadApprovedTeams) window.loadApprovedTeams();
    });

    // Judge Logged Out broadcast
    socket.on('judgeLoggedOut', () => {
      console.log('[Socket.IO] Judge logged out broadcast received');
      const errEl = document.getElementById('sirLoginError');
      if (errEl) errEl.innerHTML = '';
    });

    // PC Exam-Lock Status Changed (Locked / Unlocked / Tamper)
    socket.on('teamLockStatusChanged', (data) => {
      console.log('[Socket.IO] PC Lock status changed:', data);
      const curTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
      if (curTeam && (curTeam.id === data.teamId || curTeam.passKey === data.passKey || curTeam.secretKey === data.passKey)) {
        curTeam.pcLockStatus = data.pcLockStatus;
        if (window.updateStudentPCLockBadge) {
          window.updateStudentPCLockBadge(data.pcLockStatus);
        }
      }
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
    });

    // PC Exam-Lock Tamper Alert (Script stopped / terminated during active contest)
    socket.on('teamTamperAlert', (data) => {
      console.warn('[Socket.IO] PC Exam-Lock Tamper Alert:', data);
      const sirToken = sessionStorage.getItem('sirToken');
      if (sirToken) {
        showToast(
          '⚠️ Exam Lock Tamper Alert!',
          data.message || `Team "${data.teamName}" PC lock script stopped or closed!`,
          'error'
        );
      }
      if (window.loadApprovedTeams) {
        window.loadApprovedTeams();
      }
    });

    // Arena Session Metadata Updated (Name, Description, Date & Time)
    socket.on('arenaInfoUpdated', (data) => {
      console.log('[Socket.IO] Arena info updated:', data);
      if (window.updateArenaInfoUI) {
        window.updateArenaInfoUI(data.arenaInfo);
      }
      if (window.handleArenaInfoUpdate) {
        window.handleArenaInfoUpdate(data.arenaInfo);
      }
    });

  } catch (err) {
    console.error('[Socket.IO Init Failed]', err);
  }
}

// Request immediate leaderboard refresh
function requestServerLeaderboard() {
  if (socket && socket.connected) {
    socket.emit('requestLeaderboard');
  }
}

window.initSocketClient = initSocketClient;
window.requestServerLeaderboard = requestServerLeaderboard;