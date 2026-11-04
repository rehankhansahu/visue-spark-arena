// ============================================================================
// VISUE SPARK 2026 - Sir / Judge Desk Controller
// Secure Admin Portal: Team Approvals, Question Bank, Kickout Control,
// Controlled Timer, 3-Option Code Downloads, & Official Results Publishing
// ============================================================================

let currentJudge = null;
let allSubmissions = [];
let pendingTeams = [];
let approvedTeams = [];
let questionBank = [];
let activeSlots = {};
let activeContestQuestions = [];
let activeContestPoints = 0;
let activeQuestionIds = [];
let questionMode = 'same';
let currentResultsPublished = false;
let currentContestTimer = null;

// 1. Check Sir Authentication
async function checkSirAuth() {
  const token = sessionStorage.getItem('sirToken');
  const loginGate = document.getElementById('sirLoginGate');
  const dashboard = document.getElementById('sirDashboard');

  if (!token) {
    if (loginGate) loginGate.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    return false;
  }

  try {
    const res = await fetch('/api/verify-auth', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      currentJudge = data.judge;
      const judgeNameEl = document.getElementById('sirJudgeNameDisplay');
      const judgeHeaderEl = document.getElementById('sirJudgeNameDisplayHeader');
      if (data.judge && data.judge.name) {
        if (judgeNameEl) judgeNameEl.textContent = data.judge.name;
        if (judgeHeaderEl) judgeHeaderEl.textContent = data.judge.name;
      }
      if (loginGate) loginGate.classList.add('hidden');
      if (dashboard) dashboard.classList.remove('hidden');
      loadPendingRequests();
      loadApprovedTeams();
      loadJudgeSubmissions();
      loadQuestionBank();
      checkTimerStatus();
      return true;
    } else {
      sessionStorage.removeItem('sirToken');
      if (loginGate) loginGate.classList.remove('hidden');
      if (dashboard) dashboard.classList.add('hidden');
      return false;
    }
  } catch (err) {
    console.error('Judge auth check failed:', err);
    return false;
  }
}

// 2. Sir Login Handler (Option A: Single-Judge Lock with Force Unlock Option)
async function handleSirLogin(e) {
  if (e) e.preventDefault();
  const usernameInput = document.getElementById('sirUsernameInput');
  const passwordInput = document.getElementById('sirPasswordInput');
  const errorMsg = document.getElementById('sirLoginError');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!username || !password) {
    if (errorMsg) errorMsg.textContent = 'Please enter both Judge Username and Password.';
    return;
  }

  await performSirLogin(username, password, false);
}

async function handleSirForceUnlock() {
  const usernameInput = document.getElementById('sirUsernameInput');
  const passwordInput = document.getElementById('sirPasswordInput');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!username || !password) {
    alert('Please enter judge credentials first.');
    return;
  }

  if (!confirm('Are you sure you want to FORCE UNLOCK? This will immediately terminate the active session on the other device and transfer control to this device.')) {
    return;
  }

  await performSirLogin(username, password, true);
}

async function performSirLogin(username, password, forceUnlock = false) {
  const usernameInput = document.getElementById('sirUsernameInput');
  const passwordInput = document.getElementById('sirPasswordInput');
  const errorMsg = document.getElementById('sirLoginError');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, forceUnlock })
    });

    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem('sirToken', data.token);
      currentJudge = data.judge;
      const judgeNameEl = document.getElementById('sirJudgeNameDisplay');
      const judgeHeaderEl = document.getElementById('sirJudgeNameDisplayHeader');
      if (data.judge && data.judge.name) {
        if (judgeNameEl) judgeNameEl.textContent = data.judge.name;
        if (judgeHeaderEl) judgeHeaderEl.textContent = data.judge.name;
      }
      showToast('Authenticated 🔓', data.message, 'success');
      if (errorMsg) errorMsg.innerHTML = '';
      if (passwordInput) passwordInput.value = '';
      if (usernameInput) usernameInput.value = '';

      document.getElementById('sirLoginGate').classList.add('hidden');
      document.getElementById('sirDashboard').classList.remove('hidden');
      loadPendingRequests();
      loadApprovedTeams();
      loadJudgeSubmissions();
      loadQuestionBank();
      checkTimerStatus();
    } else if (data.error === 'SESSION_LOCKED') {
      // Option A: Active Session Lock detected on another device/browser
      if (errorMsg) {
        errorMsg.innerHTML = `
          <div class="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-left space-y-2 mt-2 shadow-lg">
            <div class="font-bold flex items-center gap-1.5 text-xs text-rose-200">
              <span>🔒</span>
              <span>Judge Portal Active on Another Device!</span>
            </div>
            <p class="text-[11px] text-slate-200 leading-relaxed">
              Dr. Rashid Jahangir is already logged in on another device/browser. <strong>Single-session lock</strong> is active. Please log out from the active device or click Force Unlock below.
            </p>
            <div class="pt-1.5 border-t border-rose-500/30">
              <button 
                type="button" 
                onclick="handleSirForceUnlock()" 
                class="w-full py-1.5 px-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-[11px] rounded-lg transition flex items-center justify-center gap-1.5 shadow-md">
                <span>⚡</span>
                <span>Force Unlock & Terminate Other Session</span>
              </button>
            </div>
          </div>
        `;
      }
      showToast('Access Blocked 🔒', 'Judge portal is currently open on another device.', 'warning');
    } else {
      if (errorMsg) errorMsg.textContent = data.message || 'Invalid judge credentials.';
      showToast('Access Denied', data.message || 'Invalid Username or Password', 'error');
    }
  } catch (err) {
    if (errorMsg) errorMsg.textContent = 'Server connection failed.';
  }
}

// 3. Sir Logout Handler
async function handleSirLogout() {
  const token = sessionStorage.getItem('sirToken');
  if (token) {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.warn('Logout notification error:', e);
    }
  }
  sessionStorage.removeItem('sirToken');
  currentJudge = null;
  const loginGate = document.getElementById('sirLoginGate');
  const dashboard = document.getElementById('sirDashboard');
  if (loginGate) loginGate.classList.remove('hidden');
  if (dashboard) dashboard.classList.add('hidden');
  const errorMsg = document.getElementById('sirLoginError');
  if (errorMsg) errorMsg.innerHTML = '';
  showToast('Logged Out 🔓', 'Judge session ended and lock released.', 'info');
}

// =========================================================================
// 4. TIMER CONTROLS (Sir Starts / Pauses / Resets Timer)
// =========================================================================
async function checkTimerStatus() {
  try {
    const res = await fetch('/api/timer');
    const data = await res.json();
    if (data.success && data.timer) {
      updateAdminTimerBadge(data.timer);
    }
  } catch (e) {}
}

function updateAdminTimerBadge(timer) {
  currentContestTimer = timer;
  const badge = document.getElementById('sirTimerStatusBadge');
  const clock = document.getElementById('sirTimerCountdownDisplay');
  const minsDisplay = document.getElementById('sirTimerMinsDisplay');
  const minsDisplayMetric = document.getElementById('sirTimerMinsDisplayMetric');

  if (timer && timer.durationMinutes) {
    if (minsDisplay) minsDisplay.textContent = timer.durationMinutes;
    if (minsDisplayMetric) minsDisplayMetric.textContent = timer.durationMinutes;
    document.querySelectorAll('.timer-duration-mins').forEach(el => el.textContent = timer.durationMinutes);
  }

  if (clock && timer && timer.remainingSeconds !== undefined) {
    const hrs = Math.floor(timer.remainingSeconds / 3600);
    const mins = Math.floor((timer.remainingSeconds % 3600) / 60);
    const s = timer.remainingSeconds % 60;
    clock.textContent = `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Manage contest running lock UI
  const isRunning = Boolean(timer && timer.status === 'running');
  const budgetPanel = document.getElementById('contestBudgetPanel');
  const bannerId = 'adminContestRunningLockedBanner';
  let banner = document.getElementById(bannerId);

  if (isRunning) {
    if (!banner && budgetPanel && budgetPanel.parentElement) {
      banner = document.createElement('div');
      banner.id = bannerId;
      banner.className = 'p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 mb-3 shadow-md animate-pulse';
      banner.innerHTML = `<span>🔒</span> <span>COMPETITION RUNNING: Question bank and assignments are locked while the timer is running. Pause or reset contest to modify questions.</span>`;
      budgetPanel.parentElement.insertBefore(banner, budgetPanel);
    }
  } else {
    if (banner) {
      banner.remove();
    }
  }

  if (!badge) return;

  if (timer.status === 'running') {
    badge.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    badge.textContent = '● RUNNING';
  } else if (timer.status === 'paused') {
    badge.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30';
    badge.textContent = '❚❚ PAUSED';
  } else if (timer.status === 'ended') {
    badge.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
    badge.textContent = '✕ TIME UP';
  } else {
    badge.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700';
    badge.textContent = '○ NOT STARTED';
  }
}

// Timer Duration Custom Controls
function toggleEditTimerModal(show) {
  const modal = document.getElementById('editTimerModal');
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
    const input = document.getElementById('customTimerMinutesInput');
    const currentMinsEl = document.getElementById('sirTimerMinsDisplay');
    if (input && currentMinsEl) {
      input.value = currentMinsEl.textContent.trim() || '90';
    }
  } else {
    modal.classList.add('hidden');
  }
}

async function setTimerDurationPreset(mins) {
  const input = document.getElementById('customTimerMinutesInput');
  if (input) input.value = mins;
  await submitTimerDuration(mins);
}

async function handleSaveTimerDuration(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('customTimerMinutesInput');
  const mins = input ? parseInt(input.value, 10) : 90;
  if (isNaN(mins) || mins <= 0 || mins > 300) {
    alert('Please enter a valid duration between 1 and 300 minutes.');
    return;
  }
  await submitTimerDuration(mins);
}

async function submitTimerDuration(mins) {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/timer/duration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ minutes: mins })
    });
    const data = await res.json();
    if (data.success) {
      toggleEditTimerModal(false);
      showToast('Timer Updated ⏱️', `Contest duration set to ${data.timer.durationMinutes} minutes!`, 'success');
      updateAdminTimerBadge(data.timer);
      if (window.handleTimerStateUpdate) {
        window.handleTimerStateUpdate(data.timer);
      }
    } else {
      showToast('Notice', data.message || 'Could not update timer duration', 'warning');
    }
  } catch (e) {
    showToast('Error', 'Failed to update timer duration', 'error');
  }
}

async function startContestTimer() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;
  try {
    const res = await fetch('/api/admin/timer/start', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Timer Started', 'Contest timer is now running!', 'success');
      updateAdminTimerBadge(data.timer);
      loadApprovedTeams();
    } else {
      alert(`Cannot Start Competition:\n\n${data.message || 'Please ensure all approved teams have 60-point challenges assigned in their language.'}`);
      showToast('Notice', data.message || 'Cannot start competition.', 'warning');
    }
  } catch (e) {
    showToast('Error', 'Failed to start timer', 'error');
  }
}

async function pauseContestTimer() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;
  try {
    const res = await fetch('/api/admin/timer/pause', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Timer Paused', 'Contest timer paused.', 'warning');
      updateAdminTimerBadge(data.timer);
    }
  } catch (e) {
    showToast('Error', 'Failed to pause timer', 'error');
  }
}

async function resetContestTimer() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;
  const minsDisplay = document.getElementById('sirTimerMinsDisplay');
  const curMins = minsDisplay ? minsDisplay.textContent.trim() : '90';

  const confirmMsg = `⚠️ FULL CONTEST RESET\n\nAre you sure you want to completely RESET the contest?\n\nThis will DELETE:\n• All registered & approved teams\n• All live code submissions & grades\n• All team progress\n• Reset countdown timer back to ${curMins} minutes\n\nStudents will return to the registration screen to sign up afresh.`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/admin/timer/reset', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Contest Reset', 'All teams and submissions cleared. Ready for fresh registrations.', 'info');
      currentResultsPublished = false;
      allSubmissions = [];
      updateResultsPublishBadge(false, true);
      updateAdminTimerBadge(data.timer);
      await loadApprovedTeams();
      await loadPendingRequests();
      await loadJudgeSubmissions();
      await loadQuestionBank();
      if (window.fetchInitialLeaderboard) {
        await window.fetchInitialLeaderboard();
      }
    } else {
      showToast('Error', data.message || 'Failed to reset contest', 'error');
    }
  } catch (e) {
    showToast('Error', 'Failed to reset contest', 'error');
  }
}

async function fullResetContestWipeAll() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  const confirmMsg = `🚨 FULL CONTEST & PODIUM WIPE\n\nAre you sure you want to COMPLETELY WIPE EVERYTHING?\n\nThis will DELETE:\n• All registered & approved teams\n• All code submissions and grading marks\n• All questions in the question bank and assignments\n• Reset countdown timer\n• AND COMPLETELY WIPE THE PODIUM STANDINGS & WINNERS HISTORY!\n\nBoth Arena and Podium will become completely fresh and blank.`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/admin/reset-contest-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Wiped Clean', 'Contest and podium have been completely reset fresh.', 'warning');
      currentResultsPublished = false;
      allSubmissions = [];
      updateResultsPublishBadge(false, true);
      updateAdminTimerBadge(data.timer);
      await loadApprovedTeams();
      await loadPendingRequests();
      await loadJudgeSubmissions();
      await loadQuestionBank();
      if (window.fetchInitialLeaderboard) {
        await window.fetchInitialLeaderboard();
      }
      if (window.renderPodiumLeaderboard) {
        window.renderPodiumLeaderboard([]);
      }
    } else {
      showToast('Error', data.message || 'Failed to wipe contest', 'error');
    }
  } catch (e) {
    showToast('Error', 'Failed to perform full reset', 'error');
  }
}

// =========================================================================
// 5. PENDING TEAM REQUESTS & APPROVALS
// =========================================================================
async function loadPendingRequests() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/pending-requests', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      pendingTeams = data.teams || [];
      renderPendingRequests(pendingTeams);
      updateJudgeMetrics();
    }
  } catch (err) {
    console.error('Failed to load pending requests:', err);
  }
}

function renderAdminTeamAvatar(team, sizeClass = 'w-10 h-10 text-sm', borderClass = 'border border-white/20') {
  if (typeof window.renderTeamAvatarHtml === 'function') {
    return window.renderTeamAvatarHtml(team, sizeClass, borderClass);
  }
  if (!team) return '';
  const initial = ((team.teamName || team.leaderName || 'T')[0] || 'T').toUpperCase();
  if (team.profilePic && team.profilePic.trim()) {
    return `
      <div class="${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${borderClass} bg-slate-900 shadow-md">
        <img src="${team.profilePic}" alt="${team.teamName || ''}" class="w-full h-full object-cover">
      </div>
    `;
  }
  return `
    <div class="${sizeClass} rounded-full flex-shrink-0 ${borderClass} bg-gradient-to-tr from-cyan-500 to-blue-500 text-white flex items-center justify-center font-black shadow-md select-none">
      <span>${initial}</span>
    </div>
  `;
}

function renderPendingRequests(teamsList) {
  const tbody = document.getElementById('pendingTeamsTableBody');
  const countBadge = document.getElementById('pendingRequestsBadge');

  if (countBadge) {
    countBadge.textContent = `${teamsList.length} Pending`;
    if (teamsList.length > 0) countBadge.classList.remove('hidden');
    else countBadge.classList.add('hidden');
  }

  if (!tbody) return;

  if (teamsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-slate-500 text-xs">
          No pending registration requests. All teams are approved.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = teamsList.map(t => `
    <tr class="border-b border-white/5 hover:bg-slate-800/40 transition">
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          ${renderAdminTeamAvatar(t, 'w-10 h-10 text-sm', 'border border-amber-500/40')}
          <div>
            <div class="font-bold text-slate-200 text-sm">${t.teamName}</div>
            <div class="text-[10px] font-mono text-cyan-400">${t.university}</div>
            <div class="text-[10px] font-mono text-amber-400 font-bold">🔑 PIN: ${t.secretKey || t.passKey}</div>
          </div>
        </div>
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
          t.teamType === 'duo' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-800 text-slate-300'
        }">
          ${t.teamType.toUpperCase()}
        </span>
      </td>
      <td class="px-4 py-3">
        <div class="text-xs text-slate-200 font-semibold">${t.leaderName}</div>
        <div class="text-[11px] font-mono text-emerald-400">${t.leaderRoll}</div>
        ${t.member2Name ? `
          <div class="text-xs text-slate-300 mt-1">${t.member2Name}</div>
          <div class="text-[11px] font-mono text-slate-400">${t.member2Roll}</div>
        ` : ''}
      </td>
      <td class="px-4 py-3 font-mono text-xs uppercase text-cyan-400">
        ${t.language}
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          ⏳ PENDING APPROVAL
        </span>
      </td>
      <td class="px-4 py-3 text-right space-x-2 whitespace-nowrap">
        <button 
          onclick="approveTeamRequest('${t.id}')"
          class="btn-cyber px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 transition">
          ✅ Approve Pass
        </button>
        <button 
          onclick="rejectTeamRequest('${t.id}')"
          class="px-2.5 py-1.5 rounded-lg text-xs font-mono text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 transition">
          ❌ Reject
        </button>
      </td>
    </tr>
  `).join('');
}

async function approveTeamRequest(teamId) {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/approve-team', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ teamId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Team Approved! ✅', data.message, 'success');
      loadPendingRequests();
      loadApprovedTeams();
    } else {
      showToast('Error', data.message || 'Could not approve team', 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to approve team', 'error');
  }
}

async function rejectTeamRequest(teamId) {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  if (!confirm('Reject and delete this team registration?')) return;

  try {
    const res = await fetch('/api/admin/reject-team', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ teamId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Registration Rejected', data.message || 'Team registration rejected and removed.', 'info');
      loadPendingRequests();
      loadApprovedTeams();
    }
  } catch (err) {
    showToast('Network Error', 'Failed to reject team', 'error');
  }
}

// =========================================================================
// 6. APPROVED TEAMS MANAGEMENT & KICKOUT (Sir's Control)
// =========================================================================
async function loadApprovedTeams() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/approved-teams', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      approvedTeams = data.teams || [];
      renderApprovedTeams(approvedTeams);
      updateJudgeMetrics();
      renderContestReadinessMeter(data.readiness || null);
    }
  } catch (err) {
    console.error('Failed to load approved teams:', err);
  }
}

function renderApprovedTeams(teamsList) {
  const tbody = document.getElementById('approvedTeamsTableBody');
  if (!tbody) return;

  if (teamsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-slate-500 text-xs">
          No approved teams yet. Pending requests will appear above.
        </td>
      </tr>
    `;
    return;
  }

  const isContestRunning = Boolean(currentContestTimer && currentContestTimer.status === 'running');

  tbody.innerHTML = teamsList.map(t => {
    const isLeftEarly = Boolean(t.leftEarly || t.status === 'left_early');
    const totalAssigned = t.totalAssignedCount || (t.assignedProblems ? t.assignedProblems.length : 3);
    const solvedCount = (t.solvedProblems || []).length;
    const isCompleted = Boolean(t.isCompleted || (totalAssigned > 0 && solvedCount >= totalAssigned));
    const timeTakenDisplay = t.timeTakenWords || t.timeTakenFormatted || (t.timeTakenSeconds ? `${Math.floor(t.timeTakenSeconds / 60)}m ${t.timeTakenSeconds % 60}s` : null);
    const totalPts = t.totalContestPoints || window.totalContestPoints || 60;
    const teamLang = (t.language || 'cpp').toUpperCase();

    const questionChipsHtml = (t.assignedProblems && t.assignedProblems.length > 0)
      ? t.assignedProblems.map((p, idx) => {
          const isSolved = t.solvedProblems && t.solvedProblems.includes(p.id);
          return `
            <span class="px-1.5 py-0.5 rounded font-bold ${isSolved ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}" title="#${p.id} ${p.title} (${p.difficulty} • ${p.points}p)">
              Q${idx + 1} #${p.id} ${isSolved ? '✓' : `(${p.points}p)`}
            </span>
          `;
        }).join('')
      : '';

    return `
    <tr class="border-b border-white/5 hover:bg-slate-800/40 transition">
      <td class="px-4 py-3">
        <div class="flex items-start gap-3">
          ${renderAdminTeamAvatar(t, 'w-10 h-10 text-sm', 'border border-cyan-500/40')}
          <div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-slate-200 text-sm">${t.teamName}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-black ${getLangBadgeClass(t.language)}" title="Team registered language: ${teamLang}">${teamLang}</span>
              ${isLeftEarly ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">🚪 Left Early</span>` : ''}
              ${isCompleted ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🏆 Finished</span>` : ''}
            </div>
            <div class="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5 flex-wrap mt-0.5">
              <span>${t.university}</span>
              <span class="text-slate-600">•</span>
              <span class="text-amber-300 font-bold">Language: ${teamLang}</span>
            </div>
            <div class="text-[10px] font-mono text-amber-400 font-bold">PIN: ${t.secretKey || t.passKey}</div>
            ${questionChipsHtml ? `<div class="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] font-mono">${questionChipsHtml}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
          t.teamType === 'duo' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-800 text-slate-300'
        }">
          ${t.teamType.toUpperCase()}
        </span>
      </td>
      <td class="px-4 py-3">
        <div class="text-xs text-slate-200 font-semibold">${t.leaderName} (${t.leaderRoll})</div>
        ${t.member2Name ? `<div class="text-[11px] text-slate-400 mt-0.5">${t.member2Name} (${t.member2Roll})</div>` : ''}
      </td>
      <td class="px-4 py-3 font-mono text-xs">
        ${isCompleted ? `
          <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <span>🏆</span>
            <span>${solvedCount}/${totalAssigned} Solved</span>
          </div>
          <div class="text-[11px] font-bold text-amber-300 mt-1 flex items-center gap-1 font-mono">
            <span>⏱️</span>
            <span>${timeTakenDisplay ? `Finished: ${timeTakenDisplay}` : 'All Solved'}</span>
          </div>
        ` : (isLeftEarly ? `
          <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <span>🚪</span>
            <span>Left Early</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">
            <span class="text-amber-400 font-bold">${solvedCount}/${totalAssigned} Solved</span>
          </div>
        ` : `
          <div class="flex items-center gap-1">
            <span class="text-emerald-400 font-bold">${solvedCount}/${totalAssigned}</span>
            <span class="text-slate-400 text-[11px]"> Solved</span>
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5 font-mono">In Progress...</div>
        `)}
      </td>
      <td class="px-4 py-3 font-mono text-sm font-black text-amber-400 whitespace-nowrap">
        ${t.score} <span class="text-xs font-bold text-slate-400">/ ${totalPts} pts</span>
      </td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <div class="inline-flex items-center gap-1.5 justify-end">
          <button 
            onclick="openAssignQuestionsForTeam('${t.id}')"
            ${isContestRunning ? 'disabled' : ''}
            class="px-2.5 py-1 text-xs font-mono font-bold rounded border transition inline-flex items-center gap-1 shadow-sm ${
              isContestRunning 
                ? 'text-slate-500 bg-slate-800/40 border-slate-700/40 cursor-not-allowed opacity-60' 
                : 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-500/40'
            }"
            title="${isContestRunning ? 'Question assignments are locked while competition is running' : 'Assign and view 60-point challenges for this team'}">
            <span>🎯</span>
            <span>Assign Questions</span>
          </button>
          <button 
            onclick="kickoutTeam('${t.id}', '${t.teamName}')"
            title="Remove or Disqualify team so they can re-register if needed"
            class="px-2.5 py-1 text-xs font-mono font-bold text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 rounded border border-rose-500/40 transition inline-flex items-center gap-1">
            <span>🗑️</span>
            <span>Remove</span>
          </button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

function openAssignQuestionsForTeam(teamId) {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question assignments and modifications are locked.');
    return;
  }
  const modal = document.getElementById('specifyQuestionsModal');
  if (modal) modal.classList.remove('hidden');
  selectTeamForQuestionAssignment(teamId);
}

async function kickoutTeam(teamId, teamName) {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  if (!confirm(`Are you sure you want to REMOVE / DISQUALIFY team "${teamName}"? Their pass will be revoked and team registration removed.`)) return;

  try {
    const res = await fetch('/api/admin/remove-team', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ teamId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Team Removed', data.message || `Team "${teamName}" removed successfully.`, 'warning');
      loadApprovedTeams();
      loadPendingRequests();
      loadJudgeSubmissions();
    } else {
      showToast('Error', data.message, 'error');
    }
  } catch (e) {
    showToast('Error', 'Failed to remove team', 'error');
  }
}

// =========================================================================
// 7. QUESTION BANK & ASSIGNMENT MANAGEMENT
// =========================================================================
async function loadQuestionBank() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/questions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      questionBank = data.bank || [];
      activeSlots = data.activeSlots || {};
      activeContestQuestions = data.activeQuestions || [];
      activeQuestionIds = data.activeIds || [];
      activeContestPoints = data.totalPoints || 0;
      questionMode = data.mode || 'same';

      renderContestReadinessMeter(data.readiness || null);
      renderQuestionBankTable(questionBank, activeQuestionIds);
    }
  } catch (err) {
    console.error('Failed to load question bank:', err);
  }
}

function renderContestReadinessMeter(readinessData = null) {
  const pointsDisplay = document.getElementById('contestBudgetPointsDisplay');
  const badgeContainer = document.getElementById('contestBudgetStatusBadge');
  const progressBar = document.getElementById('contestBudgetProgressBar');
  const labelEl = document.querySelector('.contest-budget-label');

  if (labelEl) {
    labelEl.textContent = 'Contest Question Readiness:';
  }

  let totalApproved = (approvedTeams || []).length;
  let readyTeamsCount = 0;
  let totalAssignedPoints = 0;
  let totalTargetPoints = totalApproved * 60;
  let percentage = 0;
  let unreadyLangs = [];

  if (readinessData && typeof readinessData.percentage === 'number') {
    percentage = readinessData.percentage;
    totalApproved = readinessData.totalApproved;
    readyTeamsCount = readinessData.readyTeamsCount;
    totalAssignedPoints = readinessData.totalAssignedPoints;
    totalTargetPoints = readinessData.totalTargetPoints;
    if (readinessData.teamBreakdown) {
      readinessData.teamBreakdown.forEach(t => {
        if (!t.isReady && !unreadyLangs.includes(t.language)) {
          unreadyLangs.push(t.language);
        }
      });
    }
  } else if (totalApproved === 0) {
    percentage = 0;
    totalAssignedPoints = 0;
    totalTargetPoints = 60;
  } else {
    for (const team of approvedTeams) {
      const problems = team.assignedProblems || [];
      const pts = problems.reduce((s, p) => s + (p.points || 0), 0);
      const isReady = (pts === 60);
      if (isReady) {
        readyTeamsCount++;
      } else {
        const langName = (team.language || 'cpp').toUpperCase();
        if (!unreadyLangs.includes(langName)) {
          unreadyLangs.push(langName);
        }
      }
      totalAssignedPoints += Math.min(60, pts);
    }
    percentage = totalTargetPoints > 0 
      ? Math.min(100, Math.round((totalAssignedPoints / totalTargetPoints) * 100))
      : 0;
  }

  // Update Points Display
  if (pointsDisplay) {
    if (totalApproved === 0) {
      pointsDisplay.textContent = '0 / 60 Points (Awaiting Teams)';
      pointsDisplay.className = 'text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30';
    } else {
      pointsDisplay.textContent = `${readyTeamsCount} / ${totalApproved} Teams Ready (${totalAssignedPoints} / ${totalTargetPoints} pts)`;
      if (percentage === 100) {
        pointsDisplay.className = 'text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30';
      } else if (percentage >= 50) {
        pointsDisplay.className = 'text-xs font-mono font-black text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/30';
      } else {
        pointsDisplay.className = 'text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30';
      }
    }
  }

  // Update Visual Progress Bar Line
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
    if (percentage === 100) {
      progressBar.className = 'bg-gradient-to-r from-emerald-500 to-lime-400 h-2.5 rounded-full transition-all duration-300';
    } else if (percentage >= 50) {
      progressBar.className = 'bg-gradient-to-r from-cyan-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300';
    } else if (percentage > 0) {
      progressBar.className = 'bg-gradient-to-r from-amber-500 to-yellow-400 h-2.5 rounded-full transition-all duration-300';
    } else {
      progressBar.className = 'bg-slate-700 h-2.5 rounded-full transition-all duration-300';
    }
  }

  // Update Status Badge
  if (badgeContainer) {
    if (totalApproved === 0) {
      badgeContainer.innerHTML = `
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-1">
          <span>⚠️</span>
          <span>Awaiting Approved Teams • Approve teams below to assign challenges</span>
        </span>
      `;
    } else if (percentage === 100) {
      badgeContainer.innerHTML = `
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm flex items-center gap-1">
          <span>✅</span>
          <span>100% Ready • All Approved Teams have 60-point challenges (${readyTeamsCount}/${totalApproved} Teams)</span>
        </span>
      `;
    } else if (readyTeamsCount > 0) {
      const needText = unreadyLangs.length > 0 ? `${unreadyLangs.join(', ')} track needs questions` : `Need ${totalTargetPoints - totalAssignedPoints} pts more`;
      badgeContainer.innerHTML = `
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm flex items-center gap-1">
          <span>⚡</span>
          <span>${percentage}% Ready (${readyTeamsCount}/${totalApproved} Teams Ready) • ${needText}</span>
        </span>
      `;
    } else {
      const needText = unreadyLangs.length > 0 ? `Assign questions to approved teams (${unreadyLangs.join(', ')})` : `Need ${totalTargetPoints - totalAssignedPoints} pts more`;
      badgeContainer.innerHTML = `
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-1">
          <span>⚠️</span>
          <span>Incomplete (${totalAssignedPoints}/${totalTargetPoints} pts) • ${needText}</span>
        </span>
      `;
    }
  }

  // Radio buttons & pills for mode
  updateModeToggleButtons();
}

function renderContestBudgetMeter(totalPoints, activeQuestions) {
  renderContestReadinessMeter(null);
}

function updateModeToggleButtons() {
  const modeSameRadio = document.getElementById('modeSameRadio');
  const modeDiffRadio = document.getElementById('modeDiffRadio');
  const modeBtnSame = document.getElementById('modeBtnSame');
  const modeBtnDiff = document.getElementById('modeBtnDiff');

  if (modeSameRadio && modeDiffRadio) {
    if (questionMode === 'same') modeSameRadio.checked = true;
    else modeDiffRadio.checked = true;
  }

  if (modeBtnSame && modeBtnDiff) {
    if (questionMode === 'same') {
      modeBtnSame.classList.add('active');
      modeBtnDiff.classList.remove('active');
    } else {
      modeBtnDiff.classList.add('active');
      modeBtnSame.classList.remove('active');
    }
  }
}

function setQuestionDistributionMode(mode) {
  handleQuestionModeChange(mode);
}

async function toggleContestQuestion(questionId, forceAddOrRemove = null) {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question modifications are locked.');
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/contest-questions/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ questionId, forceAction: forceAddOrRemove })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Contest Updated 🎯', data.message, 'success');
      loadQuestionBank();
    } else {
      showToast('60 Points Limit ⚠️', data.message || 'Cannot add question: exceeds 60 points!', 'warning');
    }
  } catch (err) {
    showToast('Error', 'Failed to update contest questions', 'error');
  }
}

async function handleApplyContestPreset(presetName) {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question modifications are locked.');
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/contest-questions/preset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ presetName })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Preset Applied 🎯', data.message, 'success');
      loadQuestionBank();
    } else {
      showToast('Error', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to apply preset', 'error');
  }
}

async function showPointsLimitWarning(questionId) {
  const q = (questionBank || []).find(item => item.id === questionId);
  if (!q) return;

  // In Same mode, if this question supports all languages and there is an existing question of the same difficulty active:
  if (questionMode === 'same' && doesQuestionSupportAllLanguages(q)) {
    const activeSameDiff = (activeContestQuestions || []).find(act => act.difficulty === q.difficulty || act.points === q.points);
    if (activeSameDiff && activeSameDiff.id !== q.id) {
      const confirmSwap = confirm(`Contest currently has ${q.difficulty} challenge #${activeSameDiff.id} ("${activeSameDiff.title}").\n\nDo you want to REPLACE it with #${q.id} ("${q.title}") for all teams?`);
      if (confirmSwap) {
        const remaining = activeQuestionIds.filter(id => id !== activeSameDiff.id);
        remaining.push(q.id);
        await applySameModeAssignment(remaining);
        return;
      }
    }
  }

  const qPts = q ? q.points : 10;
  const qTitle = q ? q.title : `#${questionId}`;
  showToast(
    'Cannot Exceed 60 Points ⚠️',
    `Contest is currently at ${activeContestPoints}/60 pts. Adding "${qTitle}" (${qPts} pts) would exceed the 60 points limit (${activeContestPoints + qPts} pts). Please remove a question first.`,
    'warning'
  );
}

let currentQBankFilter = 'all';

function filterQuestionBankByLang(lang) {
  currentQBankFilter = lang.toLowerCase();
  document.querySelectorAll('.q-lang-filter-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40');
    btn.classList.add('bg-slate-900', 'text-slate-400');
  });
  const activeBtn = document.getElementById(`qFilter_${lang}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40');
    activeBtn.classList.remove('bg-slate-900', 'text-slate-400');
  }
  renderQuestionBankTable(questionBank, activeContestIds);
}

function renderQuestionBankTable(bank, activeIds = []) {
  const tbody = document.getElementById('questionBankTableBody');
  if (!tbody) return;

  if (!bank || bank.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-6 text-slate-500 text-xs font-mono">
          Question bank is empty. Click "+ Add Question to Bank" or "Import Excel" above to create challenges.
        </td>
      </tr>
    `;
    return;
  }

  let filteredBank = bank;
  if (currentQBankFilter && currentQBankFilter !== 'all') {
    filteredBank = bank.filter(q => {
      const qLangs = (q.languages && q.languages.length > 0) ? q.languages : ['C', 'C++', 'Java', 'Python', 'HTML', 'JavaScript', 'Dart', 'PHP'];
      let targetLangs = [currentQBankFilter];
      if (currentQBankFilter === 'cpp') targetLangs = ['c++', 'cpp'];
      if (currentQBankFilter === 'javascript') targetLangs = ['javascript', 'js'];
      return qLangs.some(l => targetLangs.includes(l.toLowerCase()));
    });
  }

  const countSpan = document.getElementById('qBankFilterCount');
  if (countSpan) countSpan.textContent = filteredBank.length;

  if (filteredBank.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-6 text-slate-500 text-xs font-mono">
          No questions found matching "${currentQBankFilter.toUpperCase()}" filter. Click "All" or "+ Add Question to Bank".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredBank.map(q => {
    const qLangs = (q.languages && q.languages.length > 0) ? q.languages : ['C', 'C++', 'Java', 'Python', 'HTML', 'JavaScript', 'Dart', 'PHP'];
    const langBadges = qLangs.map(l => {
      const cleanL = l.toLowerCase();
      if (cleanL === 'c') return '<span class="lang-badge-c px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">C</span>';
      if (cleanL === 'c++' || cleanL === 'cpp') return '<span class="lang-badge-cpp px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">C++</span>';
      if (cleanL === 'java') return '<span class="lang-badge-java px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">Java</span>';
      if (cleanL === 'python' || cleanL === 'py') return '<span class="lang-badge-python px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">Python</span>';
      if (cleanL === 'html') return '<span class="lang-badge-html px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">HTML</span>';
      if (cleanL === 'javascript' || cleanL === 'js') return '<span class="lang-badge-javascript px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">JavaScript</span>';
      if (cleanL === 'dart') return '<span class="lang-badge-dart px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">Dart</span>';
      if (cleanL === 'php') return '<span class="lang-badge-php px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">PHP</span>';
      return `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">${l}</span>`;
    }).join(' ');

    return `
    <tr class="border-b border-white/5 hover:bg-slate-800/40 transition">
      <td class="px-2.5 py-3 text-center">
        <input 
          type="checkbox" 
          class="q-row-select-checkbox accent-cyan-500 cursor-pointer w-4 h-4 rounded" 
          data-id="${q.id}"
          onchange="handleQuestionRowSelect(this, ${q.id})"
          title="Select to auto-populate question details">
      </td>
      <td class="px-3 py-3 font-mono text-xs q-id text-slate-400">#${q.id}</td>
      <td class="px-3 py-3">
        <div class="text-xs font-bold q-title text-slate-200">${q.title}</div>
        <div class="text-[11px] q-desc text-slate-400 truncate max-w-sm">${q.description}</div>
      </td>
      <td class="px-3 py-3 whitespace-nowrap">
        <div class="flex items-center gap-1 flex-wrap">
          ${langBadges}
        </div>
      </td>
      <td class="px-3 py-3 font-mono text-xs">
        <span class="px-2 py-0.5 rounded font-bold ${
          q.difficulty === 'Easy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
          q.difficulty === 'Medium' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }">${q.difficulty}</span>
      </td>
      <td class="px-3 py-3 font-mono text-xs font-bold text-amber-400">${q.points} pts</td>
      <td class="px-3 py-3 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1.5">
          <button 
            type="button"
            onclick="openEditQuestionModal(${q.id})" 
            title="Edit question details or duplicate as new" 
            class="px-2.5 py-1 text-xs text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/60 rounded-lg border border-cyan-500/30 transition shadow-sm font-mono inline-flex items-center gap-1">
            <span>✏️</span> <span>Edit</span>
          </button>
          <button 
            type="button"
            onclick="deleteQuestionFromBank(${q.id})" 
            title="Delete this question permanently from bank" 
            class="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 rounded-lg border border-rose-500/30 transition shadow-sm font-mono inline-flex items-center gap-1">
            <span>🗑️</span> <span>Delete</span>
          </button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

async function assignQuestionToTeamDirectly(questionId) {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question assignments are locked.');
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) {
    showToast('Unauthorized', 'Please login to Sir Desk.', 'error');
    return;
  }

  const teamSelect = document.getElementById(`assignTeamForQ_${questionId}`);
  const slotSelect = document.getElementById(`assignSlotForQ_${questionId}`);

  if (!teamSelect || !teamSelect.value) {
    showToast('Select Team', 'Please choose an approved team from the dropdown first.', 'warning');
    return;
  }

  const teamId = teamSelect.value;
  const slot = slotSelect ? slotSelect.value : 'easy';
  const foundTeam = (approvedTeams || []).find(t => t.id === teamId);
  const teamLabel = foundTeam ? foundTeam.teamName : `Team #${teamId}`;

  try {
    const res = await fetch('/api/admin/assign-team-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ teamId, slot, questionId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Assigned to Team! 🎯', `Question #${questionId} successfully assigned to "${teamLabel}" as Slot ${slot.toUpperCase()}!`, 'success');
      loadApprovedTeams();
      loadQuestionBank();
    } else {
      showToast('Error', data.message || 'Failed to assign question to team', 'error');
    }
  } catch (e) {
    showToast('Error', 'Server connection failed', 'error');
  }
}

async function quickAssignSlot(slot, questionId) {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question assignments are locked.');
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/assign-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ slot, questionId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Assigned!', data.message, 'success');
      loadQuestionBank();
    }
  } catch (e) {
    showToast('Error', 'Failed to assign question', 'error');
  }
}

async function handleApplySlotAssignments() {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question assignments are locked.');
    return;
  }
  const selEasy = document.getElementById('selectAssignEasy');
  const selMed = document.getElementById('selectAssignMed');
  const selHard = document.getElementById('selectAssignHard');

  if (selEasy) await quickAssignSlot('easy', selEasy.value);
  if (selMed) await quickAssignSlot('medium', selMed.value);
  if (selHard) await quickAssignSlot('hard', selHard.value);
  showToast('Challenges Updated', 'Contest problems Q1, Q2, and Q3 updated!', 'success');
}

function doesQuestionSupportAllLanguages(q) {
  if (!q) return false;
  if (!q.languages || !Array.isArray(q.languages) || q.languages.length === 0) return true;
  const lower = q.languages.map(l => (l || '').toLowerCase().trim());
  if (lower.includes('all') || lower.includes('all languages')) return true;
  const hasC = lower.includes('c');
  const hasCpp = lower.includes('cpp') || lower.includes('c++');
  const hasJava = lower.includes('java');
  const hasPy = lower.includes('python') || lower.includes('py');
  return hasC && hasCpp && hasJava && hasPy;
}

async function handleQuestionModeChange(mode) {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Cannot change distribution mode while contest is active.');
    updateModeToggleButtons();
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  if (mode === 'same') {
    // 1. Filter bank for all questions that support all 4 languages (C, C++, Java, Python)
    const allLangQuestions = (questionBank || []).filter(q => doesQuestionSupportAllLanguages(q));

    const easyList = allLangQuestions.filter(q => q.difficulty === 'Easy' || q.points === 10);
    const medList = allLangQuestions.filter(q => q.difficulty === 'Medium' || q.points === 20);
    const hardList = allLangQuestions.filter(q => q.difficulty === 'Hard' || q.points === 30);

    // If there aren't questions to form 1E + 1M + 1H:
    if (easyList.length === 0 || medList.length === 0 || hardList.length === 0) {
      alert('To use "Same for All Teams", Question Bank must have at least 1 Easy (10p), 1 Medium (20p), and 1 Hard (30p) question supporting all languages (C, C++, Java, Python).\n\nPlease add questions supporting all languages first.');
      updateModeToggleButtons();
      return;
    }

    // Check if there are multiple questions for ANY difficulty (e.g. 2 Easy questions):
    // "agr sir 4 wala easy all languages me krte hai and phir Same for All Teams click krte hai to wo khe ke easy ke 2 questions hai kon sa choose kre ge sir choose kre and assign to whi questions assign hojaye"
    if (easyList.length > 1 || medList.length > 1 || hardList.length > 1) {
      openSameModeQuestionSelectModal({ easyList, medList, hardList });
      return;
    }

    // Exactly 1 of each exists ("Same for All Teams me agr 3 questions easy medium hard hai tab bhi thk hai"):
    const targetIds = [easyList[0].id, medList[0].id, hardList[0].id];
    await applySameModeAssignment(targetIds);
    return;
  }

  // mode === 'different'
  try {
    const res = await fetch('/api/admin/question-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ mode: 'different' })
    });
    const data = await res.json();
    if (data.success) {
      questionMode = 'different';
      updateModeToggleButtons();
      renderQuestionBankTable(questionBank);
      showToast('Question Mode', 'Distribution set to: Team-Specific Assignment', 'info');
    }
  } catch (e) {
    showToast('Error', 'Failed to update question mode', 'error');
  }
}

function openSameModeQuestionSelectModal({ easyList, medList, hardList }) {
  const modal = document.getElementById('chooseSameModeQuestionsModal');
  const container = document.getElementById('chooseSameModalBody');
  if (!modal || !container) return;

  const notices = [];
  if (easyList.length > 1) {
    notices.push(`Easy ke ${easyList.length} questions hain: kon sa choose karein ge?`);
  }
  if (medList.length > 1) {
    notices.push(`Medium ke ${medList.length} questions hain: kon sa choose karein ge?`);
  }
  if (hardList.length > 1) {
    notices.push(`Hard ke ${hardList.length} questions hain: kon sa choose karein ge?`);
  }

  let html = '';

  if (notices.length > 0) {
    html += `
      <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-1.5 shadow-sm">
        <div class="font-bold flex items-center gap-1.5 text-sm">
          <span>⚠️</span>
          <span>Multiple Challenges Available:</span>
        </div>
        ${notices.map(n => `<div class="ml-4 font-semibold text-slate-200">• ${n}</div>`).join('')}
      </div>
    `;
  }

  // Easy Section
  html += `
    <div class="space-y-2 pt-1 border-t border-white/5">
      <div class="flex items-center justify-between text-xs font-mono font-bold">
        <span class="text-emerald-400 uppercase tracking-wider">Easy Challenge (10 Points)</span>
        <span class="text-slate-400 text-[11px] font-mono">${easyList.length} available</span>
      </div>
  `;
  if (easyList.length === 1) {
    const q = easyList[0];
    html += `
      <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
        <div>
          <div class="text-xs font-bold text-white">#${q.id} ${q.title}</div>
          <div class="text-[11px] text-slate-400 font-mono truncate max-w-md">${q.description}</div>
        </div>
        <input type="hidden" name="sameModeSelectedEasy" value="${q.id}">
        <span class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">Auto (10p)</span>
      </div>
    `;
  } else {
    html += `<div class="space-y-2">`;
    easyList.forEach((q, idx) => {
      const isChecked = (activeQuestionIds || []).includes(q.id) || idx === 0;
      html += `
        <label class="flex items-start gap-3 p-3 rounded-xl border border-white/10 hover:border-emerald-500/40 bg-slate-900/70 hover:bg-slate-900 cursor-pointer transition">
          <input type="radio" name="sameModeSelectedEasy" value="${q.id}" ${isChecked ? 'checked' : ''} class="mt-0.5 accent-emerald-500">
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">#${q.id} ${q.title}</span>
              <span class="text-[10px] font-mono font-bold text-emerald-400">10 pts</span>
            </div>
            <div class="text-[11px] text-slate-400 font-mono line-clamp-1 mt-0.5">${q.description}</div>
          </div>
        </label>
      `;
    });
    html += `</div>`;
  }
  html += `</div>`;

  // Medium Section
  html += `
    <div class="space-y-2 pt-2 border-t border-white/5">
      <div class="flex items-center justify-between text-xs font-mono font-bold">
        <span class="text-cyan-400 uppercase tracking-wider">Medium Challenge (20 Points)</span>
        <span class="text-slate-400 text-[11px] font-mono">${medList.length} available</span>
      </div>
  `;
  if (medList.length === 1) {
    const q = medList[0];
    html += `
      <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
        <div>
          <div class="text-xs font-bold text-white">#${q.id} ${q.title}</div>
          <div class="text-[11px] text-slate-400 font-mono truncate max-w-md">${q.description}</div>
        </div>
        <input type="hidden" name="sameModeSelectedMed" value="${q.id}">
        <span class="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">Auto (20p)</span>
      </div>
    `;
  } else {
    html += `<div class="space-y-2">`;
    medList.forEach((q, idx) => {
      const isChecked = (activeQuestionIds || []).includes(q.id) || idx === 0;
      html += `
        <label class="flex items-start gap-3 p-3 rounded-xl border border-white/10 hover:border-cyan-500/40 bg-slate-900/70 hover:bg-slate-900 cursor-pointer transition">
          <input type="radio" name="sameModeSelectedMed" value="${q.id}" ${isChecked ? 'checked' : ''} class="mt-0.5 accent-cyan-500">
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">#${q.id} ${q.title}</span>
              <span class="text-[10px] font-mono font-bold text-cyan-400">20 pts</span>
            </div>
            <div class="text-[11px] text-slate-400 font-mono line-clamp-1 mt-0.5">${q.description}</div>
          </div>
        </label>
      `;
    });
    html += `</div>`;
  }
  html += `</div>`;

  // Hard Section
  html += `
    <div class="space-y-2 pt-2 border-t border-white/5">
      <div class="flex items-center justify-between text-xs font-mono font-bold">
        <span class="text-amber-400 uppercase tracking-wider">Hard Challenge (30 Points)</span>
        <span class="text-slate-400 text-[11px] font-mono">${hardList.length} available</span>
      </div>
  `;
  if (hardList.length === 1) {
    const q = hardList[0];
    html += `
      <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
        <div>
          <div class="text-xs font-bold text-white">#${q.id} ${q.title}</div>
          <div class="text-[11px] text-slate-400 font-mono truncate max-w-md">${q.description}</div>
        </div>
        <input type="hidden" name="sameModeSelectedHard" value="${q.id}">
        <span class="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">Auto (30p)</span>
      </div>
    `;
  } else {
    html += `<div class="space-y-2">`;
    hardList.forEach((q, idx) => {
      const isChecked = (activeQuestionIds || []).includes(q.id) || idx === 0;
      html += `
        <label class="flex items-start gap-3 p-3 rounded-xl border border-white/10 hover:border-amber-500/40 bg-slate-900/70 hover:bg-slate-900 cursor-pointer transition">
          <input type="radio" name="sameModeSelectedHard" value="${q.id}" ${isChecked ? 'checked' : ''} class="mt-0.5 accent-amber-500">
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">#${q.id} ${q.title}</span>
              <span class="text-[10px] font-mono font-bold text-amber-400">30 pts</span>
            </div>
            <div class="text-[11px] text-slate-400 font-mono line-clamp-1 mt-0.5">${q.description}</div>
          </div>
        </label>
      `;
    });
    html += `</div>`;
  }
  html += `</div>`;

  container.innerHTML = html;
  modal.classList.remove('hidden');
}

function closeSameModeQuestionSelectModal() {
  const modal = document.getElementById('chooseSameModeQuestionsModal');
  if (modal) modal.classList.add('hidden');
  updateModeToggleButtons();
}

async function confirmSameModeQuestionSelection() {
  const selectedEasyEl = document.querySelector('input[name="sameModeSelectedEasy"]:checked') || document.querySelector('input[name="sameModeSelectedEasy"]');
  const selectedMedEl = document.querySelector('input[name="sameModeSelectedMed"]:checked') || document.querySelector('input[name="sameModeSelectedMed"]');
  const selectedHardEl = document.querySelector('input[name="sameModeSelectedHard"]:checked') || document.querySelector('input[name="sameModeSelectedHard"]');

  if (!selectedEasyEl || !selectedMedEl || !selectedHardEl) {
    alert('Please select one Easy, one Medium, and one Hard challenge.');
    return;
  }

  const easyId = parseInt(selectedEasyEl.value, 10);
  const medId = parseInt(selectedMedEl.value, 10);
  const hardId = parseInt(selectedHardEl.value, 10);

  closeSameModeQuestionSelectModal();
  await applySameModeAssignment([easyId, medId, hardId]);
}

async function applySameModeAssignment(targetIds) {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    // 1. Assign questions
    const setRes = await fetch('/api/admin/contest-questions/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ questionIds: targetIds })
    });
    const setData = await setRes.json();
    if (!setData.success) {
      alert(`Could not assign questions:\n\n${setData.message}`);
      return;
    }

    // 2. Set mode to 'same'
    const modeRes = await fetch('/api/admin/question-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ mode: 'same' })
    });
    const modeData = await modeRes.json();

    questionMode = 'same';
    updateModeToggleButtons();

    showToast('Assigned! 🎯', 'Same questions assigned to all teams (60/60 pts).', 'success');
    loadQuestionBank();
  } catch (err) {
    showToast('Error', 'Failed to assign questions for all teams', 'error');
  }
}

async function deleteQuestionFromBank(id) {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question modifications are locked.');
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;
  if (!confirm(`Are you sure you want to permanently delete question #${id} from the bank?`)) return;
  try {
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Question Deleted', `Question #${id} has been removed.`, 'info');
      loadQuestionBank();
    } else {
      showToast('Error', data.message || 'Failed to delete question', 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to delete question', 'error');
  }
}

async function handleAddNewQuestion(e) {
  if (e) e.preventDefault();
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question modifications are locked.');
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  const title = document.getElementById('newQTitle').value.trim();
  const difficulty = document.getElementById('newQDifficulty').value;
  const description = document.getElementById('newQDesc').value.trim();
  const sampleInput = document.getElementById('newQSampleIn').value.trim();
  const sampleExpected = document.getElementById('newQSampleOut').value.trim();

  const langCheckboxes = document.querySelectorAll('input[name="newQLangCheckbox"]:checked');
  let selectedLanguages = Array.from(langCheckboxes).map(cb => cb.value);
  if (selectedLanguages.length === 0) {
    alert('Please select at least one supported language for this question (or select All).');
    return;
  }

  if (!title || !description) {
    alert('Please provide Title and Description.');
    return;
  }

  try {
    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        difficulty,
        description,
        languages: selectedLanguages,
        sampleCases: [{ input: sampleInput, expected: sampleExpected }]
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Question Added! ✨', data.message, 'success');
      document.getElementById('newQuestionForm').reset();
      toggleNewQuestionModal(false);
      loadQuestionBank();
    } else {
      showToast('Error', data.message, 'error');
    }
  } catch (e) {
    showToast('Error', 'Failed to add question', 'error');
  }
}

function openNewQuestionModal() {
  const modal = document.getElementById('newQuestionModal');
  if (!modal) return;

  const form = document.getElementById('newQuestionForm');
  if (form) form.reset();

  const editIdInput = document.getElementById('editingQuestionId');
  if (editIdInput) editIdInput.value = '';

  const modalIcon = document.getElementById('newQuestionModalIcon');
  if (modalIcon) modalIcon.textContent = '➕';

  const modalTitle = document.getElementById('newQuestionModalTitle');
  if (modalTitle) modalTitle.textContent = 'Add New Problem to Question Bank';

  const btnUpdate = document.getElementById('btnUpdateQuestion');
  if (btnUpdate) btnUpdate.classList.add('hidden');

  const btnSave = document.getElementById('btnSaveNewQuestion');
  if (btnSave) {
    btnSave.textContent = '➕ Save as New Question';
  }

  // Check all languages by default
  document.querySelectorAll('input[name="newQLangCheckbox"]').forEach(cb => {
    cb.checked = true;
    updateNewQLangChipState(cb);
  });
  const btn = document.getElementById('newQToggleAllLangsBtn');
  if (btn) btn.textContent = 'Deselect All';

  toggleNewQuestionModal(true);
}

function openEditQuestionModal(qId) {
  const numId = parseInt(qId, 10);
  const q = (questionBank || []).find(item => item.id === numId);
  if (!q) {
    showToast('Not Found', `Question #${qId} not found in Question Bank.`, 'error');
    return;
  }

  const modal = document.getElementById('newQuestionModal');
  if (!modal) return;

  // Set hidden ID
  const editIdInput = document.getElementById('editingQuestionId');
  if (editIdInput) editIdInput.value = q.id;

  // Populate fields
  const titleInput = document.getElementById('newQTitle');
  if (titleInput) titleInput.value = q.title || '';

  const diffSelect = document.getElementById('newQDifficulty');
  if (diffSelect) diffSelect.value = q.difficulty || 'Easy';

  const descInput = document.getElementById('newQDesc');
  if (descInput) descInput.value = q.description || q.statement || '';

  const sampleIn = document.getElementById('newQSampleIn');
  if (sampleIn) sampleIn.value = (q.sampleCases && q.sampleCases[0] && q.sampleCases[0].input) || '';

  const sampleOut = document.getElementById('newQSampleOut');
  if (sampleOut) sampleOut.value = (q.sampleCases && q.sampleCases[0] && q.sampleCases[0].expected) || '';

  // Synchronize language checkboxes
  const qLangs = (q.languages && q.languages.length > 0) 
    ? q.languages.map(l => l.toLowerCase()) 
    : ['c', 'c++', 'cpp', 'java', 'python', 'html', 'javascript', 'js', 'dart', 'php'];

  document.querySelectorAll('input[name="newQLangCheckbox"]').forEach(cb => {
    const val = cb.value.toLowerCase();
    const isMatched = qLangs.includes(val) || (val === 'c++' && qLangs.includes('cpp')) || (val === 'javascript' && qLangs.includes('js'));
    cb.checked = isMatched;
    updateNewQLangChipState(cb);
  });

  // Update modal header & buttons
  const modalIcon = document.getElementById('newQuestionModalIcon');
  if (modalIcon) modalIcon.textContent = '✏️';

  const modalTitle = document.getElementById('newQuestionModalTitle');
  if (modalTitle) modalTitle.textContent = `Edit Question #${q.id} (or Save as New)`;

  const btnUpdate = document.getElementById('btnUpdateQuestion');
  if (btnUpdate) {
    btnUpdate.classList.remove('hidden');
    btnUpdate.textContent = `💾 Update Question #${q.id}`;
  }

  const btnSave = document.getElementById('btnSaveNewQuestion');
  if (btnSave) {
    btnSave.textContent = '➕ Save as New Question';
  }

  toggleNewQuestionModal(true);
}

function handleQuestionRowSelect(checkbox, qId) {
  if (checkbox && checkbox.checked) {
    openEditQuestionModal(qId);
  }
}

async function handleUpdateQuestion(e) {
  if (e) e.preventDefault();
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question modifications are locked.');
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  const id = document.getElementById('editingQuestionId').value;
  if (!id) {
    alert('No question selected for update.');
    return;
  }

  const title = document.getElementById('newQTitle').value.trim();
  const difficulty = document.getElementById('newQDifficulty').value;
  const description = document.getElementById('newQDesc').value.trim();
  const sampleInput = document.getElementById('newQSampleIn').value.trim();
  const sampleExpected = document.getElementById('newQSampleOut').value.trim();

  const langCheckboxes = document.querySelectorAll('input[name="newQLangCheckbox"]:checked');
  let selectedLanguages = Array.from(langCheckboxes).map(cb => cb.value);
  if (selectedLanguages.length === 0) {
    alert('Please select at least one supported language for this question.');
    return;
  }

  if (!title || !description) {
    alert('Please provide Title and Description.');
    return;
  }

  try {
    const res = await fetch('/api/admin/questions/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id,
        title,
        difficulty,
        description,
        languages: selectedLanguages,
        sampleInput,
        sampleOutput: sampleExpected
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Question Updated! 💾', data.message, 'success');
      document.getElementById('newQuestionForm').reset();
      toggleNewQuestionModal(false);
      loadQuestionBank();
    } else {
      showToast('Error', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to update question', 'error');
  }
}

// Download Blank Excel Question Template (.xlsx) - Format only!
function downloadQuestionExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    alert('Excel export engine is loading. Please try again in a few seconds.');
    return;
  }

  // Pure template format headers - Clean format for Sir to fill in questions
  const headers = [
    'Title',
    'Description',
    'Difficulty',
    'Points',
    'Languages',
    'Sample Input',
    'Sample Output'
  ];

  // Create clean blank sheet with format header only
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');

  // Set friendly column widths
  ws['!cols'] = [
    { wch: 30 }, // Title
    { wch: 60 }, // Description
    { wch: 14 }, // Difficulty
    { wch: 10 }, // Points
    { wch: 35 }, // Languages
    { wch: 25 }, // Sample Input
    { wch: 25 }  // Sample Output
  ];

  XLSX.writeFile(wb, 'VISUE_SPARK_Question_Template.xlsx');
  showToast('Template Downloaded! 📥', 'Blank Excel format downloaded. Fill in your questions and click Import.', 'success');
}

// Import Questions from Excel File (.xlsx, .xls, .csv)
async function handleExcelQuestionImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question imports are locked.');
    event.target.value = '';
    return;
  }

  const token = sessionStorage.getItem('sirToken');
  if (!token) {
    showToast('Unauthorized', 'Please login to Sir Desk first.', 'error');
    event.target.value = '';
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('Excel engine is still loading. Please wait a moment and try again.');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      // Filter out completely blank rows
      const validRows = (rows || []).filter(r => {
        if (!r || typeof r !== 'object') return false;
        return Object.values(r).some(v => v !== null && v !== undefined && v.toString().trim() !== '');
      });

      if (validRows.length === 0) {
        alert('The uploaded Excel file contains no question rows. Please write your questions in the rows under the header columns and save before uploading.');
        showToast('Empty Excel File', 'No filled question rows found in file.', 'warning');
        return;
      }

      showToast('Importing...', `Processing ${validRows.length} question(s) from Excel file...`, 'info');

      const res = await fetch('/api/admin/questions/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ questions: validRows })
      });

      const result = await res.json();
      if (result.success) {
        showToast('Questions Imported! 🚀', result.message, 'success');
        await loadQuestionBank();
      } else {
        alert(`Excel Import Error:\n\n${result.message}`);
        showToast('Import Failed', result.message, 'error');
      }
    } catch (err) {
      console.error('[Excel Import Error]', err);
      alert('Failed to parse Excel file. Please ensure it follows the downloaded template format.');
      showToast('Import Error', 'Failed to read Excel workbook.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

function toggleAllNewQLanguages() {
  const checkboxes = document.querySelectorAll('input[name="newQLangCheckbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
    updateNewQLangChipState(cb);
  });
  const btn = document.getElementById('newQToggleAllLangsBtn');
  if (btn) btn.textContent = !allChecked ? 'Deselect All' : 'Select All';
}

function updateNewQLangChipState(input) {
  const label = input.closest('label');
  if (!label) return;
  if (input.checked) {
    label.classList.remove('opacity-40');
  } else {
    label.classList.add('opacity-40');
  }
}

function toggleNewQuestionModal(open = true) {
  if (open && currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question additions and modifications are locked.');
    return;
  }
  const modal = document.getElementById('newQuestionModal');
  if (modal) {
    if (open) {
      modal.classList.remove('hidden');
      document.querySelectorAll('input[name="newQLangCheckbox"]').forEach(cb => {
        cb.checked = true;
        updateNewQLangChipState(cb);
      });
      const btn = document.getElementById('newQToggleAllLangsBtn');
      if (btn) btn.textContent = 'Deselect All';
    } else {
      modal.classList.add('hidden');
    }
  }
}

// =========================================================================
// 8. RESULTS PUBLISHING & PODIUM CONTROL
// =========================================================================
async function publishOfficialResults() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  if (!confirm('Publish Official Results & Standings? The Podium will immediately become visible to all participants and screens!')) return;

  try {
    const res = await fetch('/api/admin/publish-results', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (data.success) {
      currentResultsPublished = true;
      showToast('Podium Published! 🏆', data.message, 'success');
      updateResultsPublishBadge(true);
    } else {
      alert(`Cannot Publish Results:\n\n${data.message}`);
      showToast('Cannot Publish Results', data.message, 'error');
    }
  } catch (e) {
    showToast('Error', 'Failed to publish results', 'error');
  }
}

async function unpublishOfficialResults() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  if (!confirm('Mask Official Results? Podium will be hidden from participants.')) return;

  try {
    const res = await fetch('/api/admin/unpublish-results', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (data.success) {
      currentResultsPublished = false;
      showToast('Results Masked', data.message, 'info');
      updateResultsPublishBadge(false);
    }
  } catch (e) {
    showToast('Error', 'Failed to mask results', 'error');
  }
}

function updateResultsPublishBadge(isPublished, isResetOrNoSubmissions = false) {
  const banner = document.getElementById('resultsPublishBanner');
  const btnPublish = document.getElementById('btnPublishResults');
  const btnUnpublish = document.getElementById('btnUnpublishResults');

  if (banner) {
    if (isPublished) {
      banner.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      banner.textContent = '● STANDINGS: PUBLISHED (VISIBLE)';
    } else {
      banner.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30';
      banner.textContent = '⏳ STANDINGS: HIDDEN';
    }
  }

  if (btnPublish && btnUnpublish) {
    const noSubmissions = isResetOrNoSubmissions || (!allSubmissions || allSubmissions.length === 0);
    if (noSubmissions) {
      btnPublish.classList.add('hidden');
      btnUnpublish.classList.add('hidden');
    } else if (isPublished) {
      btnPublish.classList.add('hidden');
      btnUnpublish.classList.remove('hidden');
    } else {
      btnPublish.classList.remove('hidden');
      btnUnpublish.classList.add('hidden');
    }
  }
}

// =========================================================================
// 9. SUBMISSIONS & 3 CODE DOWNLOAD / VIEW OPTIONS
// =========================================================================
async function loadJudgeSubmissions() {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/submissions');
    const data = await res.json();

    if (data.success) {
      allSubmissions = data.submissions || [];
      renderJudgeSubmissions(allSubmissions);
      updateJudgeMetrics();
      if (allSubmissions.length === 0) {
        currentResultsPublished = false;
        updateResultsPublishBadge(false, true);
      } else {
        updateResultsPublishBadge(currentResultsPublished);
      }
    }
  } catch (err) {
    console.error('Failed to load submissions:', err);
  }
}

function renderJudgeSubmissions(submissions) {
  const container = document.getElementById('sirSubmissionsByTeamContainer');
  const countBadge = document.getElementById('judgeTotalSubmissionsCountBadge');
  if (countBadge) {
    countBadge.textContent = `${submissions.length} Submissions`;
  }
  if (!container) return;

  if (submissions.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center glass-panel rounded-xl border border-white/5 space-y-2">
        <div class="text-3xl">📤</div>
        <div class="text-sm font-bold text-white">No Code Submissions Recorded Yet</div>
        <p class="text-xs text-slate-400 font-mono max-w-md mx-auto">
          When teams submit their solutions in the Arena, their submitted questions will be listed here separately per team.
        </p>
      </div>
    `;
    return;
  }

  // Group submissions by team
  const teamMap = new Map();
  submissions.forEach(sub => {
    const tKey = sub.teamId || sub.teamName;
    if (!teamMap.has(tKey)) {
      teamMap.set(tKey, {
        teamId: sub.teamId,
        teamName: sub.teamName,
        leaderName: sub.leaderName,
        leaderRoll: sub.leaderRoll,
        university: sub.university,
        language: sub.language || 'cpp',
        finishedDuration: null,
        submissions: []
      });
    }
    const group = teamMap.get(tKey);
    group.submissions.push(sub);
    if (sub.timeTakenWords || sub.timeTakenFormatted) {
      group.finishedDuration = sub.timeTakenWords || sub.timeTakenFormatted;
    }
  });

  const teamCardsHtml = Array.from(teamMap.values()).map(group => {
    // Helper to order questions strictly: Easy (1, 10p) -> Medium (2, 20p) -> Hard (3, 30p)
    function getDifficultyOrderRank(sub) {
      const diff = (sub.difficulty || '').toLowerCase();
      const pts = parseInt(sub.points, 10) || 0;
      if (diff === 'easy' || pts === 10) return 1;
      if (diff === 'medium' || pts === 20) return 2;
      if (diff === 'hard' || pts === 30) return 3;
      return 4;
    }
    // Sort submissions strictly: Easy -> Medium -> Hard (1, 2, 3 sequence)
    group.submissions.sort((a, b) => {
      const rankA = getDifficultyOrderRank(a);
      const rankB = getDifficultyOrderRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return (parseInt(a.problemId, 10) || 0) - (parseInt(b.problemId, 10) || 0);
    });

    const totalScore = group.submissions.reduce((sum, s) => sum + (s.scoreAwarded || 0) + (s.bonus || 0), 0);
    const solvedCount = group.submissions.length;
    const isCompleted = solvedCount >= 3;
    const langBadgeClass = getLangBadgeClass(group.language);
    const langUpper = (group.language || 'CPP').toUpperCase();

    const problemRowsHtml = group.submissions.map(sub => {
      const timeStr = new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const subLang = (sub.language || group.language || 'cpp').toLowerCase();
      const subLangUpper = subLang.toUpperCase();
      const ext = getLanguageExtension(subLang);
      const isExitSub = Boolean(sub.leftEarly || sub.status === 'LEFT_EARLY');

      return `
        <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors" id="submission-row-${sub.id}">
          <td class="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
            ${timeStr}
          </td>
          <td class="px-4 py-3">
            <div class="text-xs text-slate-200 font-bold flex items-center gap-1.5">
              <span>Problem #${sub.problemId}: ${sub.problemTitle}</span>
              ${sub.points ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-white/10">${sub.points}p</span>` : ''}
            </div>
            ${isExitSub ? `
              <div class="mt-1">
                <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  🚪 Left Early (Draft Saved)
                </span>
              </div>
            ` : ''}
          </td>
          <td class="px-4 py-3">
            <span class="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${getLangBadgeClass(subLang)}">
              ${subLangUpper}
            </span>
          </td>
          <td class="px-4 py-3 font-mono">
            ${isExitSub ? `
              <div class="text-xs text-rose-400 font-bold">+${sub.scoreAwarded} pts</div>
            ` : `
              <div class="text-xs text-emerald-400 font-bold">+${sub.scoreAwarded} pts</div>
            `}
            ${sub.bonus > 0 ? `<div class="text-[10px] text-amber-400 font-bold">★ +${sub.bonus} Bonus</div>` : ''}
            ${sub.judgeNotes ? `<div class="text-[10px] text-slate-400 italic mt-0.5 font-sans">"${sub.judgeNotes}"</div>` : ''}
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap space-x-1">
            <button 
              onclick="inspectCodeModal('${sub.id}')"
              title="View Code in Browser"
              class="px-2.5 py-1 text-xs rounded bg-slate-800 text-cyan-300 hover:text-white hover:bg-slate-700 transition border border-cyan-800/40 font-semibold inline-flex items-center gap-1 shadow-sm">
              <span>👁️</span> <span>View</span>
            </button>
            <button 
              onclick="downloadSubmissionTxt('${sub.id}')"
              title="Download Submission Audit (.txt)"
              class="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-white/10 font-mono inline-flex items-center gap-1">
              <span>📄</span> <span>.txt</span>
            </button>
            <button 
              onclick="downloadSubmissionSource('${sub.id}')"
              title="Download Raw Source Code (.${ext})"
              class="px-2 py-1 text-xs rounded bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 transition border border-emerald-500/40 font-mono font-bold inline-flex items-center gap-1">
              <span>💾</span> <span>.${ext}</span>
            </button>
            <button 
              onclick="promptGradeSubmission('${sub.id}')"
              title="Adjust Marks"
              class="px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition border border-amber-500/30 font-bold">
              ✏️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const groupTeamObj = approvedTeams.find(t => t.id === group.teamId || t.teamName === group.teamName);

    return `
      <div class="team-submission-card rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-md">
        <!-- Team Header -->
        <div class="p-3.5 bg-slate-950/70 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            ${renderAdminTeamAvatar(groupTeamObj || group, 'w-9 h-9 text-xs', 'border border-cyan-500/40')}
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm">${group.teamName}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${langBadgeClass}">${langUpper}</span>
                ${isCompleted ? `
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span>🏆</span> <span>3/3 Solved</span>
                  </span>
                ` : ''}
              </div>
              <div class="text-xs text-slate-400 font-mono mt-0.5">
                ${group.leaderName} (${group.leaderRoll}) • <span class="text-cyan-400">${group.university}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            ${group.finishedDuration ? `
              <div class="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <span>⏱️</span>
                <span>Finished: ${group.finishedDuration}</span>
              </div>
            ` : ''}
            <div class="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ${solvedCount} Questions Submitted
            </div>
            <div class="px-3 py-1 rounded text-xs font-mono font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">
              ${totalScore} pts
            </div>
          </div>
        </div>

        <!-- Team's Submitted Questions Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-950/40 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-white/5">
              <tr>
                <th class="px-4 py-2">Time</th>
                <th class="px-4 py-2">Submitted Question</th>
                <th class="px-4 py-2">Language</th>
                <th class="px-4 py-2">Score Awarded</th>
                <th class="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${problemRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = teamCardsHtml;
}

function getLanguageExtension(lang) {
  const l = (lang || '').toLowerCase();
  if (l === 'python' || l === 'py') return 'py';
  if (l === 'java') return 'java';
  if (l === 'c') return 'c';
  return 'cpp';
}

// Option 1: Browser Code Inspection Modal
function inspectCodeModal(submissionId) {
  const sub = allSubmissions.find(s => s.id === submissionId);
  if (!sub) return;

  const modal = document.getElementById('codeInspectModal');
  if (!modal) return;

  const ext = getLanguageExtension(sub.language);

  document.getElementById('inspectStudentName').textContent = `${sub.teamName} • ${sub.university}`;
  document.getElementById('inspectProblem').textContent = `Problem #${sub.problemId}: ${sub.problemTitle}`;
  document.getElementById('inspectLanguage').textContent = `${sub.language.toUpperCase()} (.${ext})`;
  document.getElementById('inspectStatus').textContent = `Verified Submission (+${sub.scoreAwarded} pts)`;
  document.getElementById('inspectCodeBody').textContent = sub.code;

  // Wire buttons inside modal
  const btnTxt = document.getElementById('inspectDownloadTxtBtn');
  if (btnTxt) btnTxt.onclick = () => downloadSubmissionTxt(sub.id);

  const btnSrc = document.getElementById('inspectDownloadSrcBtn');
  if (btnSrc) {
    btnSrc.innerHTML = `<span>💾 Download .${ext}</span>`;
    btnSrc.onclick = () => downloadSubmissionSource(sub.id);
  }

  const bonusBtn = document.getElementById('inspectBonusBtn');
  if (bonusBtn) {
    bonusBtn.onclick = () => {
      awardBonusPoints(sub.id, 10);
      closeInspectModal();
    };
  }

  const gradeBtn = document.getElementById('inspectGradeBtn');
  if (gradeBtn) {
    gradeBtn.onclick = () => {
      promptGradeSubmission(sub.id);
    };
  }

  modal.classList.remove('hidden');
}

function closeInspectModal() {
  const modal = document.getElementById('codeInspectModal');
  if (modal) modal.classList.add('hidden');
}

// Option 2: Download as .txt file
function downloadSubmissionTxt(submissionId) {
  const sub = allSubmissions.find(s => s.id === submissionId);
  if (!sub) return;

  const cleanTeam = (sub.teamName || 'Team').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanTeam}_Problem${sub.problemId}_${sub.difficulty || 'Solution'}.txt`;

  const report = [
    '================================================================================',
    '  VISUE SPARK 2026 - SUBMISSION AUDIT REPORT',
    '  Advanced Web Technologies (CS-302)',
    '================================================================================',
    `Submission ID : ${sub.id}`,
    `Team Name     : ${sub.teamName}`,
    `University    : ${sub.university}`,
    `Leader        : ${sub.leaderName} (${sub.leaderRoll})`,
    `Problem       : #${sub.problemId} - ${sub.problemTitle} (${sub.difficulty || ''})`,
    `Language      : ${sub.language.toUpperCase()}`,
    `Status        : ${sub.status}`,
    `Score Awarded : ${sub.scoreAwarded} pts (Bonus: ${sub.bonus || 0} pts)`,
    `Judge Notes   : ${sub.judgeNotes || 'None'}`,
    `Submitted At  : ${new Date(sub.submittedAt).toLocaleString()}`,
    '================================================================================',
    'SOURCE CODE:',
    '================================================================================',
    '',
    sub.code,
    '',
    '================================================================================',
    'END OF SUBMISSION FILE'
  ].join('\n');

  triggerFileDownload(filename, report, 'text/plain;charset=utf-8;');
  showToast('Downloaded .txt', `Audit file saved: ${filename}`, 'info');
}

// Option 3: Download with native source file extension (.py, .java, .cpp, .c)
function downloadSubmissionSource(submissionId) {
  const sub = allSubmissions.find(s => s.id === submissionId);
  if (!sub) return;

  const ext = getLanguageExtension(sub.language);
  const cleanTeam = (sub.teamName || 'Team').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanTeam}_Problem${sub.problemId}.${ext}`;

  triggerFileDownload(filename, sub.code, 'text/plain;charset=utf-8;');
  showToast(`Downloaded .${ext}`, `Source code saved: ${filename}`, 'success');
}

function triggerFileDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Prompt to adjust marks / grade
async function promptGradeSubmission(submissionId) {
  const sub = allSubmissions.find(s => s.id === submissionId);
  if (!sub) return;

  const currentScore = sub.scoreAwarded;
  const newMarksStr = prompt(`Enter new marks for ${sub.teamName} on Problem #${sub.problemId}:`, currentScore);
  if (newMarksStr === null) return;

  const newMarks = parseInt(newMarksStr, 10);
  if (isNaN(newMarks)) {
    alert('Please enter a valid numeric score.');
    return;
  }

  const notes = prompt('Enter Judge Remarks / Notes (optional):', sub.judgeNotes || '') || '';

  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/grade-submission', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        submissionId: sub.id,
        marks: newMarks,
        judgeNotes: notes
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Score Updated! ⭐', data.message, 'success');
      sub.scoreAwarded = newMarks;
      sub.judgeNotes = notes;
      renderJudgeSubmissions(allSubmissions);
      loadApprovedTeams();
      updateResultsPublishBadge(true);
      if (window.fetchInitialLeaderboard) {
        window.fetchInitialLeaderboard();
      }
    }
  } catch (e) {
    showToast('Error', 'Failed to update score', 'error');
  }
}

// Award Bonus
async function awardBonusPoints(submissionId, bonusAmount = 10) {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/submissions/bonus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ submissionId, bonus: bonusAmount })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Bonus Awarded! ⭐', data.message, 'success');
      const sub = allSubmissions.find(s => s.id === submissionId);
      if (sub) {
        sub.bonus = (sub.bonus || 0) + bonusAmount;
        renderJudgeSubmissions(allSubmissions);
      }
      loadApprovedTeams();
      updateResultsPublishBadge(true);
      if (window.fetchInitialLeaderboard) {
        window.fetchInitialLeaderboard();
      }
    }
  } catch (err) {
    showToast('Error', 'Failed to award bonus', 'error');
  }
}

function prependSubmissionToSirDesk(sub) {
  allSubmissions.unshift(sub);
  renderJudgeSubmissions(allSubmissions);
  updateJudgeMetrics();
  updateResultsPublishBadge(currentResultsPublished);

  setTimeout(() => {
    const row = document.getElementById(`submission-row-${sub.id}`);
    if (row) {
      row.classList.add('bg-emerald-500/20');
      setTimeout(() => row.classList.remove('bg-emerald-500/20'), 2500);
    }
  }, 50);
}

function updateJudgeMetrics() {
  const totalSubmissionsEl = document.getElementById('sirTotalSubmissions');
  const pendingRequestsEl = document.getElementById('sirPendingCount');
  const approvedCountEl = document.getElementById('sirApprovedCount');

  if (totalSubmissionsEl) totalSubmissionsEl.textContent = allSubmissions.length;
  if (pendingRequestsEl) pendingRequestsEl.textContent = pendingTeams.length;
  if (approvedCountEl) approvedCountEl.textContent = approvedTeams.length;
}

// Export Contest Audit Report (.txt)
function exportResultsTxt() {
  const teamsList = approvedTeams || [];
  const generatedAt = new Date().toLocaleString();

  let txt = '';
  txt += '================================================================================\n';
  txt += '  VISUE SPARK 2026 - INTER-UNIVERSITY PROGRAMMING ARENA\n';
  txt += '  OFFICIAL CONTEST AUDIT & RESULTS REPORT\n';
  txt += `  Generated: ${generatedAt}\n`;
  txt += '================================================================================\n\n';

  txt += '--------------------------------------------------------------------------------\n';
  txt += '  1. FINAL CONTEST STANDINGS & PODIUM RANKINGS\n';
  txt += '--------------------------------------------------------------------------------\n';

  if (teamsList.length === 0) {
    txt += '  No approved teams recorded in contest.\n';
  } else {
    teamsList.forEach((t, i) => {
      const rank = i + 1;
      const title = rank === 1 ? 'WINNER / CHAMPION 🏆' : (rank === 2 ? '1ST RUNNER UP 🥈' : (rank === 3 ? '2ND RUNNER UP 🥉' : 'HONORABLE MENTION'));
      const solvedCount = (t.solvedProblems || []).length;
      const timeTaken = t.timeTakenWords || t.timeTakenFormatted || (t.timeTakenSeconds ? `${Math.floor(t.timeTakenSeconds / 60)}m ${t.timeTakenSeconds % 60}s` : 'N/A');
      const langUpper = (t.language || 'cpp').toUpperCase();

      txt += `\n[RANK #${rank}] ${title}\n`;
      txt += `  • Team Name:        ${t.teamName} (${(t.teamType || 'solo').toUpperCase()})\n`;
      txt += `  • University:       ${t.university}\n`;
      txt += `  • Primary Language: ${langUpper}\n`;
      txt += `  • Total Score:      ${t.score} / 60 points\n`;
      txt += `  • Solved Status:    ${solvedCount} / 3 Challenges Solved\n`;
      txt += `  • Contest Duration: ${timeTaken}\n`;
      txt += `  • Leader:           ${t.leaderName} (Roll #${t.leaderRoll})\n`;
      if (t.member2Name) {
        txt += `  • Member 2:         ${t.member2Name} (Roll #${t.member2Roll || 'N/A'})\n`;
      }
      if (t.bonusMarks) {
        txt += `  • Bonus Marks:      +${t.bonusMarks} pts\n`;
      }
      if (t.leftEarly) {
        txt += `  • Early Exit:       Yes (Incomplete Draft Evaluated)\n`;
      }
    });
  }

  txt += '\n\n--------------------------------------------------------------------------------\n';
  txt += '  2. DETAILED LIVE CODE SUBMISSIONS & GRADING AUDIT\n';
  txt += '--------------------------------------------------------------------------------\n';

  if (allSubmissions.length === 0) {
    txt += '  No code submissions recorded in contest.\n';
  } else {
    allSubmissions.forEach((sub, idx) => {
      txt += `\n[SUBMISSION #${idx + 1}] ID: ${sub.id}\n`;
      txt += `  • Timestamp:        ${sub.submittedAt}\n`;
      txt += `  • Team Name:        ${sub.teamName} (${sub.university})\n`;
      txt += `  • Leader:           ${sub.leaderName} (Roll #${sub.leaderRoll})\n`;
      txt += `  • Question:         #${sub.problemId} - ${sub.problemTitle} (${sub.difficulty || 'Easy'})\n`;
      txt += `  • Language:         ${(sub.language || 'cpp').toUpperCase()}\n`;
      txt += `  • Status:           ${sub.status}\n`;
      txt += `  • Score Awarded:    ${sub.scoreAwarded} points (Bonus: +${sub.bonus || 0})\n`;
      if (sub.judgeNotes) {
        txt += `  • Judge Remarks:    ${sub.judgeNotes}\n`;
      }
      if (sub.code) {
        txt += `  • Submitted Code:\n`;
        const codeLines = sub.code.split('\n').map(l => '      ' + l).join('\n');
        txt += `${codeLines}\n`;
      }
    });
  }

  txt += '\n\n================================================================================\n';
  txt += 'Developed by Muhammad Rehan (BS Software Engineering)\n';
  txt += 'Portfolio: https://rehankhansahu.github.io/muhammad-rehan-portfolio/\n';
  txt += '================================================================================\n';

  triggerFileDownload(`VISUE_SPARK_2026_Contest_Audit_Report_${new Date().toISOString().slice(0, 10)}.txt`, txt, 'text/plain;charset=utf-8;');
  showToast('Audit Report Exported!', 'Contest audit report (.txt) downloaded with developer portfolio credit.', 'success');
}

// Backwards compatibility alias
function exportResultsCSV() {
  exportResultsTxt();
}

// Export Official Student Results in Excel (.xlsx) Format
function exportResultsExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Excel export engine is loading. Please try again.');
    return;
  }

  const teamsList = approvedTeams || [];
  const submissionsList = allSubmissions || [];

  // Sheet 1: Leaderboard & Official Results
  const resultsData = teamsList.map((t, idx) => {
    const rank = idx + 1;
    const award = rank === 1 ? 'Winner / Champion 🏆' : (rank === 2 ? '1st Runner Up 🥈' : (rank === 3 ? '2nd Runner Up 🥉' : 'Qualified Participant'));
    const totalContestPts = t.totalContestPoints || 60;
    const percentage = totalContestPts > 0 ? Math.round((t.score / totalContestPts) * 100) : 0;
    const duration = t.timeTakenWords || t.timeTakenFormatted || (t.timeTakenSeconds ? `${Math.floor(t.timeTakenSeconds / 60)}m ${t.timeTakenSeconds % 60}s` : 'N/A');

    return {
      'Rank': rank,
      'Standing / Award': award,
      'Team Name': t.teamName,
      'Team Type': (t.teamType || 'solo').toUpperCase(),
      'University / College': t.university,
      'Primary Language': (t.language || 'cpp').toUpperCase(),
      'Score': t.score,
      'Max Points': totalContestPts,
      'Percentage (%)': `${percentage}%`,
      'Challenges Solved': (t.solvedProblems || []).length,
      'Duration': duration,
      'Leader Name': t.leaderName,
      'Leader Roll No': t.leaderRoll || t.rollNo,
      'Member 2 Name': t.member2Name || 'N/A',
      'Member 2 Roll No': t.member2Roll || 'N/A',
      'Bonus Marks': t.bonusMarks ? `+${t.bonusMarks}` : '0',
      'Status': t.leftEarly ? 'Left Early (Incomplete)' : 'Completed'
    };
  });

  // Sheet 2: Code Submissions Audit
  const auditData = submissionsList.map((sub, idx) => {
    return {
      'Index': idx + 1,
      'Submission ID': sub.id,
      'Timestamp': sub.submittedAt,
      'Team Name': sub.teamName,
      'University': sub.university,
      'Leader Name': sub.leaderName,
      'Leader Roll No': sub.leaderRoll,
      'Question ID': `#${sub.problemId}`,
      'Question Title': sub.problemTitle,
      'Language': (sub.language || 'cpp').toUpperCase(),
      'Status': sub.status,
      'Points Awarded': sub.scoreAwarded,
      'Bonus Points': sub.bonus || 0,
      'Judge Remarks': sub.judgeNotes || 'Official AC'
    };
  });

  // Sheet 3: Developer & Contest Metadata
  const metaData = [
    { 'Key': 'Contest Title', 'Value': 'VISUE SPARK 2026 - Inter-University Programming Arena' },
    { 'Key': 'Export Timestamp', 'Value': new Date().toLocaleString() },
    { 'Key': 'Total Approved Teams', 'Value': teamsList.length },
    { 'Key': 'Total Code Submissions', 'Value': submissionsList.length },
    { 'Key': 'Lead Developer', 'Value': 'Muhammad Rehan (BS Software Engineering)' },
    { 'Key': 'Portfolio Website', 'Value': 'https://rehankhansahu.github.io/muhammad-rehan-portfolio/' },
    { 'Key': 'Institution', 'Value': 'COMSATS University Islamabad, Vehari Campus' }
  ];

  const wb = XLSX.utils.book_new();

  const wsResults = XLSX.utils.json_to_sheet(resultsData.length > 0 ? resultsData : [{ 'Notice': 'No approved teams yet' }]);
  XLSX.utils.book_append_sheet(wb, wsResults, 'Leaderboard');

  const wsAudit = XLSX.utils.json_to_sheet(auditData.length > 0 ? auditData : [{ 'Notice': 'No submissions yet' }]);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'Submissions Audit');

  const wsMeta = XLSX.utils.json_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Contest Info');

  const fileName = `VISUE_SPARK_2026_Student_Results_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('Excel Exported! 📊', `Student results exported successfully to ${fileName}`, 'success');
}

// Export Official Student Results in PDF Format
function exportResultsPDF() {
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    alert('PDF export engine is loading. Please try again in a few moments.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const teamsList = approvedTeams || [];
  const generatedAt = new Date().toLocaleString();

  // Header Branded Banner
  doc.setFillColor(10, 13, 22);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 85, 'F');

  // Neon Accent Line
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 85, doc.internal.pageSize.getWidth(), 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('VISUE SPARK 2026 - INTER-UNIVERSITY PROGRAMMING ARENA', 40, 35);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129);
  doc.text('OFFICIAL CONTEST RESULTS & STUDENT PERFORMANCE AUDIT', 40, 52);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${generatedAt}  |  Chief Judge: Dr. Rashid Jahangir  |  Target Budget: 60 pts`, 40, 68);

  // Table Body Rows
  const tableRows = teamsList.map((t, idx) => {
    const rank = idx + 1;
    const award = rank === 1 ? 'Champion (1st)' : (rank === 2 ? 'Runner Up (2nd)' : (rank === 3 ? '3rd Place' : 'Qualified'));
    const totalContestPts = t.totalContestPoints || 60;
    const percentage = totalContestPts > 0 ? Math.round((t.score / totalContestPts) * 100) : 0;
    const duration = t.timeTakenWords || t.timeTakenFormatted || (t.timeTakenSeconds ? `${Math.floor(t.timeTakenSeconds / 60)}m` : 'N/A');

    return [
      `#${rank}`,
      t.teamName || 'Solo',
      `${t.leaderName} (${t.leaderRoll || t.rollNo || ''})`,
      t.university || 'COMSATS',
      (t.language || 'cpp').toUpperCase(),
      `${(t.solvedProblems || []).length} / 3`,
      duration,
      `${t.score} / ${totalContestPts} (${percentage}%)`,
      award
    ];
  });

  if (tableRows.length === 0) {
    tableRows.push(['-', 'No Teams', 'N/A', 'N/A', 'N/A', '0/3', 'N/A', '0 / 60', 'No Records']);
  }

  // Render Table via AutoTable
  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      startY: 105,
      head: [['Rank', 'Team Name', 'Leader (Roll #)', 'University', 'Lang', 'Solved', 'Time', 'Score (%)', 'Award']],
      body: tableRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 5,
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 40, right: 40 }
    });
  }

  // Footer Credit
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Developed by Muhammad Rehan (BS Software Engineering)', 40, pageHeight - 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(14, 165, 233);
  doc.text('Portfolio: https://rehankhansahu.github.io/muhammad-rehan-portfolio/', 340, pageHeight - 20);

  const fileName = `VISUE_SPARK_2026_Student_Results_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
  showToast('PDF Exported! 📕', `Official results downloaded to ${fileName}`, 'success');
}

// =========================================================================
// PERMANENT COMPETITION HISTORY CONTROLLER
// =========================================================================
let competitionHistoryCache = [];

async function openCompetitionHistoryModal() {
  const modal = document.getElementById('competitionHistoryModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const listView = document.getElementById('historyListView');
  const detailView = document.getElementById('historyDetailView');
  if (listView) listView.classList.remove('hidden');
  if (detailView) detailView.classList.add('hidden');

  await loadCompetitionHistory();
}

function closeCompetitionHistoryModal() {
  const modal = document.getElementById('competitionHistoryModal');
  if (modal) modal.classList.add('hidden');
}

async function loadCompetitionHistory() {
  const container = document.getElementById('historyListContainer');
  const badge = document.getElementById('historyTotalBadge');
  if (!container) return;

  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  container.innerHTML = `
    <div class="text-center py-8 text-slate-400 font-mono text-xs">
      <span class="animate-spin inline-block mr-2">↻</span> Loading permanently archived competitions...
    </div>
  `;

  try {
    const res = await fetch('/api/admin/competitions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      competitionHistoryCache = data.history || [];
      if (badge) badge.textContent = `${competitionHistoryCache.length} Contests`;

      if (competitionHistoryCache.length === 0) {
        container.innerHTML = `
          <div class="text-center py-12 p-6 glass-panel rounded-xl border border-white/5 space-y-2">
            <div class="text-3xl">📜</div>
            <h4 class="text-sm font-bold text-white">No Previous Competitions Yet</h4>
            <p class="text-xs text-slate-400 max-w-md mx-auto">
              Whenever a contest concludes or is reset by Sir, a permanent historical snapshot is automatically frozen in <code class="text-purple-300">data/competitions.json</code>.
            </p>
          </div>
        `;
        return;
      }

      container.innerHTML = competitionHistoryCache.map((comp, idx) => {
        const winner = comp.winner;
        const totalTeams = comp.totalTeams || (comp.teams ? comp.teams.length : 0);
        const totalQuestions = comp.totalQuestions || (comp.questions ? comp.questions.length : 0);

        return `
          <div class="glass-panel p-4 sm:p-5 rounded-xl border border-white/10 hover:border-purple-500/40 transition space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  ${comp.id}
                </span>
                <h4 class="text-sm font-bold text-white">${comp.title}</h4>
              </div>
              <div class="text-[11px] font-mono text-slate-400">
                📅 ${comp.dateFormatted || new Date(comp.timestamp).toLocaleString()}
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div class="bg-slate-950/50 p-2 rounded-lg border border-white/5">
                <span class="text-slate-400 block text-[10px] uppercase">Contest Duration</span>
                <span class="text-white font-bold">${comp.durationMinutes || 90} Minutes</span>
              </div>
              <div class="bg-slate-950/50 p-2 rounded-lg border border-white/5">
                <span class="text-slate-400 block text-[10px] uppercase">Total Teams</span>
                <span class="text-cyan-300 font-bold">${totalTeams} Teams</span>
              </div>
              <div class="bg-slate-950/50 p-2 rounded-lg border border-white/5">
                <span class="text-slate-400 block text-[10px] uppercase">Preserved Questions</span>
                <span class="text-amber-300 font-bold">${totalQuestions} Challenges</span>
              </div>
              <div class="bg-slate-950/50 p-2 rounded-lg border border-white/5">
                <span class="text-slate-400 block text-[10px] uppercase">Champion Team</span>
                <span class="text-emerald-300 font-bold truncate block">${winner ? winner.teamName : 'Evaluated'}</span>
              </div>
            </div>

            <div class="flex items-center justify-between pt-1 flex-wrap gap-2">
              <div class="text-[11px] text-slate-400">
                ${winner ? `🏆 Winner: <strong>${winner.teamName}</strong> (${winner.university || 'COMSATS'}) - ${winner.score}/60 pts` : 'Podium archived'}
              </div>
              <button 
                type="button" 
                onclick="viewCompetitionSnapshot('${comp.id}')"
                class="btn-cyber px-3.5 py-1.5 rounded-lg text-xs font-bold text-purple-300 bg-purple-950/60 border border-purple-500/40 hover:bg-purple-900/50 transition flex items-center gap-1.5 shadow-sm">
                <span>🔍</span>
                <span>Inspect Snapshot & Questions</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="text-rose-400 p-4 text-xs font-mono">Error loading history: ${err.message}</div>`;
  }
}

async function viewCompetitionSnapshot(id) {
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  const detailContainer = document.getElementById('historyDetailContainer');
  if (!detailContainer) return;

  detailContainer.innerHTML = `
    <div class="text-center py-8 text-slate-400 font-mono text-xs">
      <span class="animate-spin inline-block mr-2">↻</span> Loading competition snapshot #${id}...
    </div>
  `;

  document.getElementById('historyListView').classList.add('hidden');
  document.getElementById('historyDetailView').classList.remove('hidden');

  try {
    const res = await fetch(`/api/admin/competitions/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success || !data.competition) {
      detailContainer.innerHTML = `<div class="text-rose-400 p-4 text-xs font-mono">Failed to load competition snapshot.</div>`;
      return;
    }

    const comp = data.competition;
    const questions = comp.questions || [];
    const teams = comp.teams || [];

    const questionsHtml = questions.length > 0 ? questions.map((q, idx) => {
      const qLangs = (q.languages && q.languages.length > 0) ? q.languages.join(', ') : 'All Languages';
      const hasOptions = q.optionA || q.optionB || q.optionC || q.optionD || q.options;
      const optA = q.optionA || (q.options && q.options.a) || '';
      const optB = q.optionB || (q.options && q.options.b) || '';
      const optC = q.optionC || (q.options && q.options.c) || '';
      const optD = q.optionD || (q.options && q.options.d) || '';

      return `
        <div class="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs font-bold text-slate-400">#${idx + 1} (QID: ${q.id})</span>
              <h5 class="text-xs sm:text-sm font-bold text-white">${q.title}</h5>
            </div>
            <div class="flex items-center gap-1.5 font-mono text-[10px]">
              <span class="px-2 py-0.5 rounded font-bold ${
                q.difficulty === 'Easy' ? 'bg-emerald-500/20 text-emerald-400' :
                q.difficulty === 'Medium' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'
              }">${q.difficulty || 'Easy'}</span>
              <span class="px-2 py-0.5 rounded font-bold text-amber-300 bg-amber-500/20">${q.points || 10} pts</span>
              <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300">${qLangs}</span>
            </div>
          </div>

          <div class="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-white/5 whitespace-pre-wrap font-sans">
            ${q.description || q.statement || 'No description recorded.'}
          </div>

          ${hasOptions ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-mono pt-1">
              ${optA ? `<div class="p-1.5 rounded bg-slate-950/40 border border-white/5 text-slate-300"><strong>A:</strong> ${optA}</div>` : ''}
              ${optB ? `<div class="p-1.5 rounded bg-slate-950/40 border border-white/5 text-slate-300"><strong>B:</strong> ${optB}</div>` : ''}
              ${optC ? `<div class="p-1.5 rounded bg-slate-950/40 border border-white/5 text-slate-300"><strong>C:</strong> ${optC}</div>` : ''}
              ${optD ? `<div class="p-1.5 rounded bg-slate-950/40 border border-white/5 text-slate-300"><strong>D:</strong> ${optD}</div>` : ''}
            </div>
          ` : ''}

          ${q.correctAnswer ? `
            <div class="text-[11px] font-mono text-emerald-400 pt-1 flex items-center gap-1">
              <span>✅ Correct Answer:</span>
              <strong class="text-white bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">${q.correctAnswer}</strong>
            </div>
          ` : ''}
        </div>
      `;
    }).join('') : '<div class="text-xs text-slate-400 font-mono py-2">No question snapshot found for this contest.</div>';

    const teamsHtml = teams.length > 0 ? `
      <div class="overflow-x-auto rounded-lg border border-white/5">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-white/10">
            <tr>
              <th class="px-3 py-2">Rank</th>
              <th class="px-3 py-2">Team Name</th>
              <th class="px-3 py-2">Leader (Roll #)</th>
              <th class="px-3 py-2">University</th>
              <th class="px-3 py-2">Language</th>
              <th class="px-3 py-2">Solved</th>
              <th class="px-3 py-2">Score (/60)</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map((t, idx) => `
              <tr class="border-b border-white/5">
                <td class="px-3 py-2 font-mono font-bold ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}">#${idx + 1}</td>
                <td class="px-3 py-2 font-bold text-white">${t.teamName}</td>
                <td class="px-3 py-2 text-slate-300">${t.leaderName} (${t.leaderRoll || t.rollNo || ''})</td>
                <td class="px-3 py-2 text-slate-300">${t.university}</td>
                <td class="px-3 py-2 font-mono uppercase text-cyan-300">${t.language || 'cpp'}</td>
                <td class="px-3 py-2 font-mono text-slate-300">${(t.solvedProblems || []).length} / 3</td>
                <td class="px-3 py-2 font-mono font-bold text-emerald-400">${t.score} pts</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="text-xs text-slate-400 font-mono py-2">No team records in this contest.</div>';

    detailContainer.innerHTML = `
      <div class="space-y-4">
        <!-- Back Navigation & Header -->
        <div class="flex items-center justify-between gap-3 border-b border-white/10 pb-3 flex-wrap">
          <button 
            type="button" 
            onclick="backToHistoryList()" 
            class="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5">
            <span>← Back to Competitions List</span>
          </button>

          <div class="flex items-center gap-2">
            <span class="text-[11px] font-mono text-purple-300 bg-purple-500/20 px-2.5 py-1 rounded-md border border-purple-500/40 font-bold">
              🔒 Preserved Snapshot (Read-Only)
            </span>
          </div>
        </div>

        <!-- Competition Overview Banner -->
        <div class="glass-panel p-4 rounded-xl border border-purple-500/30 space-y-2 bg-gradient-to-r from-purple-950/30 via-slate-900/60 to-slate-950/60">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h4 class="text-base font-black text-white">${comp.title}</h4>
            <span class="text-xs font-mono text-slate-400">📅 ${comp.dateFormatted || comp.timestamp}</span>
          </div>
          <div class="text-xs text-slate-300 flex items-center gap-4 flex-wrap font-mono">
            <span>Duration: <strong>${comp.durationMinutes || 90} mins</strong></span>
            <span>Total Points: <strong>${comp.totalPoints || 60} pts</strong></span>
            <span>Teams: <strong>${teams.length}</strong></span>
            <span>Questions: <strong>${questions.length}</strong></span>
          </div>
          ${comp.winner ? `
            <div class="pt-2 border-t border-white/5 flex items-center gap-2 text-xs">
              <span>🏆 Champion / 1st Place:</span>
              <strong class="text-amber-300">${comp.winner.teamName}</strong>
              <span class="text-slate-400">(${comp.winner.university || 'COMSATS'})</span>
              <span class="text-emerald-400 font-bold font-mono">• ${comp.winner.score} / 60 points</span>
            </div>
          ` : ''}
        </div>

        <!-- Questions Preserved in this Competition -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <h5 class="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>📚</span>
              <span>Questions Included in this Competition (${questions.length})</span>
            </h5>
            <span class="text-[10px] text-slate-400 font-mono">Original questions & options frozen</span>
          </div>
          <div class="space-y-3">
            ${questionsHtml}
          </div>
        </div>

        <!-- Teams Standings -->
        <div class="space-y-2.5 pt-2">
          <h5 class="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span>🏆</span>
            <span>Final Team Standings (${teams.length})</span>
          </h5>
          ${teamsHtml}
        </div>
      </div>
    `;
  } catch (err) {
    detailContainer.innerHTML = `<div class="text-rose-400 p-4 text-xs font-mono">Error viewing snapshot: ${err.message}</div>`;
  }
}

function backToHistoryList() {
  const detailView = document.getElementById('historyDetailView');
  const listView = document.getElementById('historyListView');
  if (detailView) detailView.classList.add('hidden');
  if (listView) listView.classList.remove('hidden');
}

// =========================================================================
// SPECIFY QUESTIONS BY TEAM (Sir Dynamic Language-Gated Assignment)
// =========================================================================
let currentSpecifyTeamId = null;
let currentSpecifyTeamData = null;

function getLangBadgeClass(lang) {
  const clean = (lang || '').toLowerCase().trim();
  if (clean === 'java') return 'lang-badge-java bg-amber-500/20 text-amber-300 border border-amber-500/40';
  if (clean === 'python' || clean === 'py') return 'lang-badge-python bg-blue-500/20 text-blue-300 border border-blue-500/40';
  if (clean === 'cpp' || clean === 'c++') return 'lang-badge-cpp bg-indigo-500/20 text-indigo-300 border border-indigo-500/40';
  if (clean === 'c') return 'lang-badge-c bg-slate-700/40 text-slate-300 border border-slate-500/40';
  if (clean === 'html') return 'lang-badge-html bg-orange-500/20 text-orange-400 border border-orange-500/40';
  if (clean === 'javascript' || clean === 'js') return 'lang-badge-javascript bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
  if (clean === 'dart') return 'lang-badge-dart bg-sky-500/20 text-sky-400 border border-sky-500/40';
  if (clean === 'php') return 'lang-badge-php bg-purple-500/20 text-purple-300 border border-purple-500/40';
  return 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
}

function getDifficultyBadgeClass(diff) {
  if (diff === 'Easy') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  if (diff === 'Medium') return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
  return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
}

function openSpecifyQuestionsModal() {
  const modal = document.getElementById('specifyQuestionsModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  backToSpecifyTeamsList();
  loadSpecifyTeamsList();
}

function closeSpecifyQuestionsModal() {
  const modal = document.getElementById('specifyQuestionsModal');
  if (modal) modal.classList.add('hidden');
  currentSpecifyTeamId = null;
  currentSpecifyTeamData = null;
  loadQuestionBank();
}

function backToSpecifyTeamsList() {
  currentSpecifyTeamId = null;
  currentSpecifyTeamData = null;

  const btnBack = document.getElementById('btnBackToSpecifyTeams');
  const title = document.getElementById('specifyModalTitle');
  const sub = document.getElementById('specifyModalSubtitle');
  const view1 = document.getElementById('specifyTeamsListView');
  const view2 = document.getElementById('specifyTeamAssignView');

  if (btnBack) btnBack.classList.add('hidden');
  if (title) title.textContent = 'Specify Questions by Team';
  if (sub) sub.textContent = 'Select an approved team to customize their 60-point challenges matching their registered language.';
  if (view1) view1.classList.remove('hidden');
  if (view2) view2.classList.add('hidden');

  loadSpecifyTeamsList();
}

async function loadSpecifyTeamsList() {
  const container = document.getElementById('specifyTeamsContainer');
  const badge = document.getElementById('specifyTeamsCountBadge');
  if (!container) return;

  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/teams-with-questions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="col-span-2 text-center py-6 text-rose-400 font-mono text-xs">${data.message || 'Failed to load teams.'}</div>`;
      return;
    }

    const teams = data.teams || [];
    if (badge) badge.textContent = `${teams.length} Approved Teams`;

    if (teams.length === 0) {
      container.innerHTML = `
        <div class="col-span-2 p-8 text-center glass-panel rounded-xl border border-white/5 space-y-2">
          <div class="text-3xl">👥</div>
          <div class="text-sm font-bold text-white">No Approved Teams Found</div>
          <p class="text-xs text-slate-400 font-mono max-w-md mx-auto">
            Please approve registered teams in Section 2 (Pending Team Registration Requests) first before specifying challenges.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = teams.map(t => {
      const isReady = t.totalPoints === 60;
      const langBadgeClass = getLangBadgeClass(t.language);
      const langUpper = (t.language || 'Python').toUpperCase();

      return `
        <div onclick="selectTeamForQuestionAssignment('${t.id}')" 
             class="group p-4 rounded-xl border ${isReady ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-white/10 bg-slate-900/60'} hover:border-cyan-500/50 hover:bg-slate-800/80 transition cursor-pointer flex flex-col justify-between gap-3 shadow-md">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-sm text-white group-hover:text-cyan-300 transition">${t.teamName}</span>
              <span class="px-2.5 py-0.5 rounded text-[10px] font-mono font-black ${langBadgeClass}">${langUpper}</span>
            </div>
            <div class="text-xs text-slate-400 font-mono">${t.university} • Leader: ${t.leaderName}</div>
          </div>

          <div class="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
            <div class="${isReady ? 'text-emerald-400 font-bold' : 'text-amber-400'}">
              ${isReady ? '✅ 60 / 60 Pts Ready' : `${t.totalPoints || 0} / 60 Pts (${(t.assignedQuestionIds || []).length} assigned)`}
            </div>
            <span class="text-cyan-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
              <span>Select Questions</span>
              <span>➔</span>
            </span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load specify teams list:', err);
    if (container) container.innerHTML = `<div class="col-span-2 text-center py-6 text-rose-400 font-mono text-xs">Error connecting to server.</div>`;
  }
}

async function selectTeamForQuestionAssignment(teamId) {
  currentSpecifyTeamId = teamId;
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  const btnBack = document.getElementById('btnBackToSpecifyTeams');
  const title = document.getElementById('specifyModalTitle');
  const sub = document.getElementById('specifyModalSubtitle');
  const view1 = document.getElementById('specifyTeamsListView');
  const view2 = document.getElementById('specifyTeamAssignView');

  if (btnBack) btnBack.classList.remove('hidden');
  if (view1) view1.classList.add('hidden');
  if (view2) view2.classList.remove('hidden');

  try {
    const res = await fetch(`/api/admin/team-questions/${teamId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success) {
      showToast('Error', data.message || 'Failed to load team questions', 'error');
      backToSpecifyTeamsList();
      return;
    }

    currentSpecifyTeamData = data;
    renderTeamAssignmentView(data);

  } catch (err) {
    console.error('Failed to load team questions:', err);
    showToast('Error', 'Server connection failed', 'error');
  }
}

function renderTeamAssignmentView(data) {
  const team = data.team;
  const assignedIds = data.questionIds || [];
  const totalPoints = data.totalPoints || 0;
  const available = data.availableQuestions || [];

  const teamNameEl = document.getElementById('assignViewTeamName');
  const teamLangEl = document.getElementById('assignViewTeamLangBadge');
  const teamUnivEl = document.getElementById('assignViewTeamUniv');
  const pointsEl = document.getElementById('assignViewPointsDisplay');
  const noticeLangEl = document.getElementById('assignNoticeLangText');
  const availableCountEl = document.getElementById('assignAvailableCount');
  const container = document.getElementById('assignQuestionsListContainer');
  const title = document.getElementById('specifyModalTitle');
  const sub = document.getElementById('specifyModalSubtitle');

  const langUpper = (team.language || 'Python').toUpperCase();

  if (title) title.textContent = `Assign Questions for ${team.teamName}`;
  if (sub) sub.textContent = `Team registered in ${langUpper}. Only ${langUpper} compatible challenges can be assigned.`;

  if (teamNameEl) teamNameEl.textContent = team.teamName;
  if (teamLangEl) {
    teamLangEl.textContent = langUpper;
    teamLangEl.className = `px-2.5 py-0.5 rounded text-[11px] font-mono font-black uppercase shadow-sm ${getLangBadgeClass(team.language)}`;
  }
  if (teamUnivEl) teamUnivEl.textContent = `${team.university} • Key: ${team.passKey || '******'}`;
  
  if (pointsEl) {
    const isReady = (totalPoints === 60);
    pointsEl.textContent = `${totalPoints} / 60 Points ${isReady ? '✅ Ready' : ''}`;
    pointsEl.className = `text-sm font-mono font-black ${isReady ? 'text-emerald-400' : 'text-amber-400'}`;
  }

  if (noticeLangEl) noticeLangEl.textContent = langUpper;
  if (availableCountEl) availableCountEl.textContent = available.length;

  if (!container) return;

  if (available.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center glass-panel rounded-xl border border-white/5 space-y-2">
        <div class="text-3xl">⚠️</div>
        <div class="text-sm font-bold text-white">No ${langUpper} Questions Found in Bank</div>
        <p class="text-xs text-slate-400 font-mono max-w-md mx-auto">
          Please click "+ Add Question to Bank" in Section 1, make sure to check <strong>${langUpper}</strong>, and add challenges for this team.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = available.map(q => {
    const isAssigned = assignedIds.includes(q.id);
    const wouldExceed = !isAssigned && (totalPoints + (q.points || 10) > 60);

    return `
      <div class="p-3.5 rounded-xl border ${isAssigned ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-white/10 bg-slate-900/60'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition">
        <div class="space-y-1 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-mono font-bold text-slate-400">#${q.id}</span>
            <span class="font-bold text-sm text-white">${q.title}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${getDifficultyBadgeClass(q.difficulty)}">${q.difficulty}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">${q.points} pts</span>
          </div>
          <div class="text-xs text-slate-400 font-mono line-clamp-1">${q.description}</div>
        </div>

        <div class="shrink-0 flex items-center gap-2 w-full sm:w-auto justify-end">
          ${isAssigned ? `
            <button 
              type="button"
              onclick="toggleTeamQuestionAssignment('${team.id}', ${q.id}, false)"
              class="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-rose-900/50 hover:bg-rose-800 text-rose-200 border border-rose-500/40 transition flex items-center gap-1.5 shadow-sm">
              <span>✕</span>
              <span>Assigned (Remove)</span>
            </button>
          ` : (wouldExceed ? `
            <button 
              type="button"
              onclick="showToast('Cannot Exceed 60 Points ⚠️', 'Team budget is currently at ${totalPoints}/60 pts. Adding #${q.id} (${q.points} pts) would exceed 60 points limit. Remove another question first.', 'warning')"
              class="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-900 text-slate-500 border border-white/5 hover:border-amber-500/30 transition">
              ➕ Assign (${q.points}p) <span class="text-[10px] text-amber-400">[Exceeds 60]</span>
            </button>
          ` : `
            <button 
              type="button"
              onclick="toggleTeamQuestionAssignment('${team.id}', ${q.id}, true)"
              class="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-sm">
              <span>➕</span>
              <span>Assign (${q.points} pts)</span>
            </button>
          `)}
        </div>
      </div>
    `;
  }).join('');
}

async function toggleTeamQuestionAssignment(teamId, questionId, shouldAssign) {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question assignments and modifications are locked.');
    return;
  }
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  if (!currentSpecifyTeamData) return;
  let qIds = [...(currentSpecifyTeamData.questionIds || [])];

  if (shouldAssign) {
    if (!qIds.includes(questionId)) qIds.push(questionId);
  } else {
    qIds = qIds.filter(id => id !== questionId);
  }

  try {
    const res = await fetch('/api/admin/team-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ teamId, questionIds: qIds })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Updated 🎯', data.message, 'success');
      selectTeamForQuestionAssignment(teamId);
      loadApprovedTeams();
    } else {
      showToast('Error', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to update team questions', 'error');
  }
}

async function handleApplyTeamPreset(presetName = 'standard') {
  if (currentContestTimer && currentContestTimer.status === 'running') {
    alert('Competition is currently running! Question assignments and modifications are locked.');
    return;
  }
  if (!currentSpecifyTeamId) return;
  const token = sessionStorage.getItem('sirToken');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/team-questions/preset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ teamId: currentSpecifyTeamId, presetName })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Preset Applied 🎯', data.message, 'success');
      selectTeamForQuestionAssignment(currentSpecifyTeamId);
      loadApprovedTeams();
    } else {
      showToast('Preset Error', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to apply preset for team', 'error');
  }
}

// Window bindings
window.checkSirAuth = checkSirAuth;
window.handleSirLogin = handleSirLogin;
window.handleSirForceUnlock = handleSirForceUnlock;
window.handleSirLogout = handleSirLogout;
window.loadPendingRequests = loadPendingRequests;
window.approveTeamRequest = approveTeamRequest;
window.rejectTeamRequest = rejectTeamRequest;
window.loadApprovedTeams = loadApprovedTeams;
window.kickoutTeam = kickoutTeam;
window.startContestTimer = startContestTimer;
window.pauseContestTimer = pauseContestTimer;
window.resetContestTimer = resetContestTimer;
window.toggleEditTimerModal = toggleEditTimerModal;
window.setTimerDurationPreset = setTimerDurationPreset;
window.handleSaveTimerDuration = handleSaveTimerDuration;
window.loadQuestionBank = loadQuestionBank;
window.toggleContestQuestion = toggleContestQuestion;
window.handleApplyContestPreset = handleApplyContestPreset;
window.showPointsLimitWarning = showPointsLimitWarning;
window.quickAssignSlot = quickAssignSlot;
window.assignQuestionToTeamDirectly = assignQuestionToTeamDirectly;
window.handleApplySlotAssignments = handleApplySlotAssignments;
window.handleQuestionModeChange = handleQuestionModeChange;
window.handleAddNewQuestion = handleAddNewQuestion;
window.toggleNewQuestionModal = toggleNewQuestionModal;
window.toggleAllNewQLanguages = toggleAllNewQLanguages;
window.updateNewQLangChipState = updateNewQLangChipState;
window.filterQuestionBankByLang = filterQuestionBankByLang;
window.openSpecifyQuestionsModal = openSpecifyQuestionsModal;
window.openAssignQuestionsForTeam = openAssignQuestionsForTeam;
window.closeSpecifyQuestionsModal = closeSpecifyQuestionsModal;
window.backToSpecifyTeamsList = backToSpecifyTeamsList;
window.loadSpecifyTeamsList = loadSpecifyTeamsList;
window.selectTeamForQuestionAssignment = selectTeamForQuestionAssignment;
window.toggleTeamQuestionAssignment = toggleTeamQuestionAssignment;
window.handleApplyTeamPreset = handleApplyTeamPreset;
window.publishOfficialResults = publishOfficialResults;
window.unpublishOfficialResults = unpublishOfficialResults;
window.updateResultsPublishBadge = updateResultsPublishBadge;
window.loadJudgeSubmissions = loadJudgeSubmissions;
window.prependSubmissionToSirDesk = prependSubmissionToSirDesk;
window.inspectCodeModal = inspectCodeModal;
window.closeInspectModal = closeInspectModal;
window.downloadSubmissionTxt = downloadSubmissionTxt;
window.downloadSubmissionSource = downloadSubmissionSource;
window.promptGradeSubmission = promptGradeSubmission;
window.awardBonusPoints = awardBonusPoints;
window.exportResultsCSV = exportResultsCSV;
window.exportResultsTxt = exportResultsTxt;
window.fullResetContestWipeAll = fullResetContestWipeAll;
window.deleteQuestionFromBank = deleteQuestionFromBank;
window.setQuestionDistributionMode = setQuestionDistributionMode;
window.closeSameModeQuestionSelectModal = closeSameModeQuestionSelectModal;
window.confirmSameModeQuestionSelection = confirmSameModeQuestionSelection;
window.renderContestReadinessMeter = renderContestReadinessMeter;
window.renderContestBudgetMeter = renderContestBudgetMeter;
window.openNewQuestionModal = openNewQuestionModal;
window.openEditQuestionModal = openEditQuestionModal;
window.handleQuestionRowSelect = handleQuestionRowSelect;
window.handleUpdateQuestion = handleUpdateQuestion;
window.downloadQuestionExcelTemplate = downloadQuestionExcelTemplate;
window.handleExcelQuestionImport = handleExcelQuestionImport;
window.exportResultsExcel = exportResultsExcel;
window.exportResultsPDF = exportResultsPDF;
window.openCompetitionHistoryModal = openCompetitionHistoryModal;
window.closeCompetitionHistoryModal = closeCompetitionHistoryModal;
window.loadCompetitionHistory = loadCompetitionHistory;
window.viewCompetitionSnapshot = viewCompetitionSnapshot;
window.backToHistoryList = backToHistoryList;