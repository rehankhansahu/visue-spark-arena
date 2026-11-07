// ============================================================================
// V Spark 2026 - Main Application Controller
// Topics: REST (L5), Socket.IO (L7), Multi-University Teams, 90-Min Timer,
// Masked / Published Official Podium, and Holographic Pass Engine
// ============================================================================

let currentView = 'arena';
let currentTeam = null;
let lastLeaderboard = [];
let isOfficialResultsPublished = false;
let leaderboardFilter = '';
let selectedTeamType = 'solo';
let timerInterval = null;
let timerData = {
  status: 'not_started',
  remainingSeconds: 5400
};

// 1. App Initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('⚡ Initializing V Spark 2026 Programming Arena...');

  // Initialize Dark / Light Theme
  initTheme();

  // Initialize Socket.IO Client
  if (window.initSocketClient) {
    window.initSocketClient();
  }

  // Restore Team from SessionStorage (isolated per tab) or LocalStorage
  let savedTeam = sessionStorage.getItem('visue_team');
  if (!savedTeam) {
    savedTeam = localStorage.getItem('visue_team');
    if (savedTeam) {
      sessionStorage.setItem('visue_team', savedTeam);
    }
  }
  if (savedTeam) {
    try {
      currentTeam = JSON.parse(savedTeam);
      updateNavbarStudentBadge();
      checkLiveTeamStatus(currentTeam.secretKey || currentTeam.passKey);
    } catch (e) {
      currentTeam = null;
    }
  }

  // Setup code editor
  if (window.setupCodeEditor) {
    window.setupCodeEditor();
  }

  // Load contest challenges
  if (window.loadProblems) {
    window.loadProblems();
  }

  // Fetch initial leaderboard
  fetchInitialLeaderboard();

  // Sync Timer from Backend
  fetchTimerState();

  // Sync Global Website Lock Status from Backend
  syncInitialLockState();

  // Default view
  switchView('arena');
});

// =========================================================================
// 1.5 GLOBAL WEBSITE LOCK (READ-ONLY MODE) HANDLER
// =========================================================================
window.isWebsiteLocked = false;

function applyWebsiteLockState(isLocked) {
  window.isWebsiteLocked = Boolean(isLocked);
  const banner = document.getElementById('websiteLockBanner');
  if (banner) {
    if (isLocked) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // Registration Button
  const regBtn = document.getElementById('submitRegisterBtn');
  if (regBtn) {
    if (isLocked) {
      regBtn.disabled = true;
      regBtn.innerHTML = '<span>🔒 Registration Locked (Read-Only Mode)</span>';
      regBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      regBtn.disabled = false;
      regBtn.innerHTML = '<span>🚀 Generate Arena Pass & Enter</span>';
      regBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  // Speed Arena Submit Button
  const submitCodeBtn = document.getElementById('submitCodeBtn');
  if (submitCodeBtn) {
    if (isLocked) {
      submitCodeBtn.disabled = true;
      submitCodeBtn.classList.add('opacity-50', 'cursor-not-allowed');
      submitCodeBtn.title = 'Submissions are paused. Website is in Read-Only mode.';
    } else {
      submitCodeBtn.disabled = false;
      submitCodeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      submitCodeBtn.removeAttribute('title');
    }
  }

  // Update Sir's Desk lock UI if available
  if (typeof window.applySirLockState === 'function') {
    window.applySirLockState(window.isWebsiteLocked);
  }
}
window.applyWebsiteLockState = applyWebsiteLockState;

async function syncInitialLockState() {
  try {
    const res = await fetch('/api/system-status');
    const data = await res.json();
    if (data.success && data.locked !== undefined) {
      applyWebsiteLockState(data.locked);
    }
  } catch (err) {
    // Network retry or offline
  }
}

// =========================================================================
// 2. CONTEST COUNTDOWN TIMER (Controlled by Sir)
// =========================================================================
async function fetchTimerState() {
  try {
    const res = await fetch('/api/timer');
    const data = await res.json();
    if (data.success && data.timer) {
      handleTimerStateUpdate(data.timer);
    }
  } catch (e) {
    handleTimerStateUpdate({ status: 'not_started', remainingSeconds: 5400 });
  }
}

function freezeTeamTimer(timeFormatted, timeWords) {
  const timerEl = document.getElementById('timerCountdown');
  const arenaEl = document.getElementById('arenaTimerCountdown');
  const arenaLabel = document.getElementById('arenaTimerLabel');
  const labelEl = document.getElementById('timerStatusLabel');
  const timerBadge = document.getElementById('timerStateBadge');
  const timerIcon = document.getElementById('timerIcon');
  const completedDisplay = document.getElementById('arenaCompletedTimeDisplay');

  const displayTime = timeFormatted || '00:00';
  const displayWords = timeWords || timeFormatted || 'All 3 Solved';

  if (arenaEl) arenaEl.textContent = displayTime;
  if (arenaLabel) arenaLabel.textContent = '🏆 Finished:';
  if (completedDisplay) completedDisplay.textContent = displayWords;
  if (timerEl) timerEl.textContent = displayTime;
  if (labelEl) labelEl.textContent = `(Finished in ${displayWords})`;
  if (timerBadge) timerBadge.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
  if (timerIcon) timerIcon.textContent = '🏆';
}

function updateAllTimerClocks(formattedText, statusLabel = '') {
  const timerEl = document.getElementById('timerCountdown');
  const sirEl = document.getElementById('sirTimerCountdownDisplay');
  const arenaEl = document.getElementById('arenaTimerCountdown');
  const labelEl = document.getElementById('timerStatusLabel');

  if (sirEl) sirEl.textContent = formattedText;

  // If student's team has completed all 3 challenges, keep their workspace clock frozen!
  if (currentTeam && currentTeam.solvedProblems && currentTeam.solvedProblems.length >= 3) {
    freezeTeamTimer(currentTeam.timeTakenFormatted, currentTeam.timeTakenWords);
  } else {
    if (timerEl) timerEl.textContent = formattedText;
    if (arenaEl) arenaEl.textContent = formattedText;
    if (labelEl && statusLabel) labelEl.textContent = statusLabel;
    const arenaLabel = document.getElementById('arenaTimerLabel');
    if (arenaLabel) arenaLabel.textContent = '⏱️ Time:';
  }
}

function updateRegistrationLockUI(timer) {
  const banner = document.getElementById('regContestLockedBanner');
  const lockedTitle = document.getElementById('regLockedTitle');
  const lockedMsg = document.getElementById('regLockedMessage');
  const submitBtn = document.getElementById('regSubmitBtn');
  const modeContainer = document.getElementById('regModeSelectorContainer');
  const form = document.getElementById('registrationForm');
  const formFields = form ? form.querySelectorAll('input, select, button[type="button"]') : [];

  const isLocked = Boolean(timer && timer.status && timer.status !== 'not_started');

  if (banner) {
    if (isLocked) {
      banner.classList.remove('hidden');
      if (timer.status === 'ended') {
        if (lockedTitle) lockedTitle.textContent = 'REGISTRATION LOCKED • CONTEST ENDED';
        if (lockedMsg) lockedMsg.textContent = 'The previous contest has ended. Sir / Chief Judge must reset the competition before new registrations can be accepted.';
      } else {
        if (lockedTitle) lockedTitle.textContent = 'REGISTRATION LOCKED • CONTEST IN PROGRESS';
        if (lockedMsg) lockedMsg.textContent = 'A contest is currently in progress. Sir / Chief Judge must reset the competition before new registrations can be accepted.';
      }
    } else {
      banner.classList.add('hidden');
    }
  }

  formFields.forEach(field => {
    field.disabled = isLocked;
  });

  if (submitBtn) {
    submitBtn.disabled = isLocked;
    if (isLocked) {
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
    } else {
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
    }
  }

  if (modeContainer) {
    if (isLocked) {
      modeContainer.classList.add('opacity-50', 'pointer-events-none');
    } else {
      modeContainer.classList.remove('opacity-50', 'pointer-events-none');
    }
  }
}
window.updateRegistrationLockUI = updateRegistrationLockUI;

function handleTimerStateUpdate(timer) {
  timerData = timer;
  window.timerData = timer;
  if (timerInterval) clearInterval(timerInterval);
  updateRegistrationLockUI(timer);

  const timerContainer = document.getElementById('navbarTimerContainer');
  const timerBadge = document.getElementById('timerStateBadge');
  const timerIcon = document.getElementById('timerIcon');

  if (timerContainer) {
    timerContainer.classList.remove('hidden');
  }

  // Sync duration displays across UI
  if (timer && timer.durationMinutes) {
    const minsLabels = document.querySelectorAll('.timer-duration-mins');
    minsLabels.forEach(el => el.textContent = timer.durationMinutes);
  }

  if (!timer || timer.status === 'not_started') {
    const totalSec = (timer && timer.totalSeconds !== undefined) ? timer.totalSeconds :
                     ((timer && timer.durationMinutes) ? timer.durationMinutes * 60 : 5400);
    const formatted = formatSeconds(totalSec);
    updateAllTimerClocks(formatted, '(Ready)');
    if (timerBadge) timerBadge.className = 'w-2.5 h-2.5 rounded-full bg-slate-500';
    if (timerIcon) timerIcon.textContent = '⏳';
    if (window.refreshArenaState) window.refreshArenaState();
    return;
  }

  if (timer.status === 'paused') {
    const formatted = formatSeconds(timer.remainingSeconds);
    updateAllTimerClocks(formatted, '(PAUSED)');
    if (timerBadge) timerBadge.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse';
    if (timerIcon) timerIcon.textContent = '⏸️';
    if (window.refreshArenaState) window.refreshArenaState();
    return;
  }

  if (timer.status === 'ended') {
    updateAllTimerClocks('00:00', '(TIME UP)');
    if (timerBadge) timerBadge.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
    if (timerIcon) timerIcon.textContent = '⚠️';
    if (window.autoSubmitOnTimeUp) window.autoSubmitOnTimeUp();
    if (window.refreshArenaState) window.refreshArenaState();
    return;
  }

  // Running State
  if (timerBadge) timerBadge.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse';
  if (timerIcon) timerIcon.textContent = '⏱️';
  startCountdown(timer.remainingSeconds);
  if (window.loadProblems) window.loadProblems();
  if (window.refreshArenaState) window.refreshArenaState();
}

let countdownTargetEndTime = null;

function startCountdown(seconds) {
  if (timerInterval) clearInterval(timerInterval);
  countdownTargetEndTime = Date.now() + (seconds * 1000);

  function update() {
    const now = Date.now();
    const remaining = Math.max(0, Math.round((countdownTargetEndTime - now) / 1000));

    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      countdownTargetEndTime = null;
      updateAllTimerClocks('00:00', '(TIME UP)');
      const timerBadge = document.getElementById('timerStateBadge');
      if (timerBadge) timerBadge.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
      if (window.autoSubmitOnTimeUp) window.autoSubmitOnTimeUp();
      return;
    }

    const formatted = formatSeconds(remaining);
    updateAllTimerClocks(formatted, '(RUNNING)');
  }

  update();
  timerInterval = setInterval(update, 1000);
}

// Sync timer and reload arena immediately when switching browser tabs or focusing window
function syncTimerOnFocusOrVisibility() {
  if (countdownTargetEndTime && timerData && timerData.status === 'running') {
    const now = Date.now();
    const remaining = Math.max(0, Math.round((countdownTargetEndTime - now) / 1000));
    const formatted = formatSeconds(remaining);
    updateAllTimerClocks(formatted, '(RUNNING)');
    if (remaining <= 0) {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = null;
      countdownTargetEndTime = null;
      updateAllTimerClocks('00:00', '(TIME UP)');
      if (window.autoSubmitOnTimeUp) window.autoSubmitOnTimeUp();
    }
  }
  if (window.loadProblems) window.loadProblems();
  if (window.refreshArenaState) window.refreshArenaState();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    syncTimerOnFocusOrVisibility();
  }
});
window.addEventListener('focus', syncTimerOnFocusOrVisibility);

function formatSeconds(sec) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// =========================================================================
// 3. VIEW NAVIGATION
// =========================================================================
function switchView(viewName) {
  currentView = viewName;

  const views = ['arena', 'leaderboard', 'pass', 'admin', 'superadmin'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const navBtn = document.getElementById(`nav-btn-${v}`);
    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
        el.classList.add('view-fade-in');
      } else {
        el.classList.add('hidden');
      }
    }
    if (navBtn) {
      if (v === viewName) {
        navBtn.classList.remove('text-slate-400', 'border-transparent');
        navBtn.classList.add('text-emerald-400', 'border-emerald-500', 'bg-white/5');
      } else {
        navBtn.classList.remove('text-emerald-400', 'border-emerald-500', 'bg-white/5');
        navBtn.classList.add('text-slate-400', 'border-transparent');
      }
    }
  });

  // Always reset scroll position to top when switching views
  const mainEl = document.getElementById('mainContainer') || document.querySelector('main');
  if (mainEl) mainEl.scrollTop = 0;

  if (viewName === 'arena') {
    if (window.loadProblems) window.loadProblems();
    if (window.refreshArenaState) window.refreshArenaState();
  } else if (viewName === 'leaderboard') {
    fetchInitialLeaderboard();
  } else if (viewName === 'pass') {
    renderContestPassView();
  } else if (viewName === 'admin') {
    if (window.checkSirAuth) window.checkSirAuth();
  } else if (viewName === 'superadmin') {
    if (window.checkSuperAdminAuth) window.checkSuperAdminAuth();
  }
}

// 4. Team Type Selector
function setParticipationMode(mode) {
  selectedTeamType = mode;
  const soloBtn = document.getElementById('modeSoloBtn');
  const duoBtn = document.getElementById('modeDuoBtn');
  const member2Section = document.getElementById('member2Section');

  if (mode === 'duo') {
    if (soloBtn) {
      soloBtn.classList.remove('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500');
      soloBtn.classList.add('bg-slate-900', 'text-slate-400');
    }
    if (duoBtn) {
      duoBtn.classList.remove('bg-slate-900', 'text-slate-400');
      duoBtn.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500');
    }
    if (member2Section) member2Section.classList.remove('hidden');
  } else {
    if (duoBtn) {
      duoBtn.classList.remove('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500');
      duoBtn.classList.add('bg-slate-900', 'text-slate-400');
    }
    if (soloBtn) {
      soloBtn.classList.remove('bg-slate-900', 'text-slate-400');
      soloBtn.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500');
    }
    if (member2Section) member2Section.classList.add('hidden');
  }
}

// Selected Profile Picture Data URL
let currentSelectedProfilePic = null;

function handleProfilePicSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('Please choose an image file smaller than 5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      // Resize to max 256x256 to ensure fast transport and lightweight base64 DataURL
      const canvas = document.createElement('canvas');
      const maxDim = 256;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      currentSelectedProfilePic = optimizedDataUrl;

      const previewImg = document.getElementById('regPhotoPreviewImg');
      const placeholder = document.getElementById('regPhotoPlaceholder');
      const removeBtn = document.getElementById('btnRemovePhoto');

      if (previewImg) {
        previewImg.src = optimizedDataUrl;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function clearSelectedProfilePic() {
  currentSelectedProfilePic = null;
  const input = document.getElementById('regProfilePicInput');
  const previewImg = document.getElementById('regPhotoPreviewImg');
  const placeholder = document.getElementById('regPhotoPlaceholder');
  const removeBtn = document.getElementById('btnRemovePhoto');

  if (input) input.value = '';
  if (previewImg) {
    previewImg.src = '';
    previewImg.classList.add('hidden');
  }
  if (placeholder) placeholder.classList.remove('hidden');
  if (removeBtn) removeBtn.classList.add('hidden');
}

function renderTeamAvatarHtml(team, sizeClass = 'w-10 h-10', borderClass = 'border border-white/20') {
  if (!team) return '';
  const initial = ((team.teamName || team.leaderName || 'T')[0] || 'T').toUpperCase();
  const gradients = [
    'from-emerald-500 to-teal-400 text-slate-950',
    'from-cyan-500 to-blue-500 text-white',
    'from-purple-500 to-indigo-400 text-white',
    'from-amber-500 to-yellow-300 text-slate-950',
    'from-rose-500 to-pink-500 text-white'
  ];
  let charCodeSum = 0;
  for (let i = 0; i < (team.teamName || '').length; i++) {
    charCodeSum += team.teamName.charCodeAt(i);
  }
  const grad = gradients[charCodeSum % gradients.length];

  if (team.profilePic && team.profilePic.trim()) {
    return `
      <div class="${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${borderClass} bg-slate-900 shadow-md">
        <img src="${team.profilePic}" alt="${team.teamName}" class="w-full h-full object-cover">
      </div>
    `;
  }
  return `
    <div class="${sizeClass} rounded-full flex-shrink-0 ${borderClass} bg-gradient-to-tr ${grad} flex items-center justify-center font-black shadow-md select-none">
      <span>${initial}</span>
    </div>
  `;
}
window.renderTeamAvatarHtml = renderTeamAvatarHtml;

// 5. Team Registration
async function handleTeamRegister(e) {
  if (e) e.preventDefault();

  const teamNameInput = document.getElementById('regTeamName');
  const uniInput = document.getElementById('regUniversity');
  const leaderNameInput = document.getElementById('regLeaderName');
  const leaderRollInput = document.getElementById('regLeaderRoll');
  const member2NameInput = document.getElementById('regMember2Name');
  const member2RollInput = document.getElementById('regMember2Roll');
  const langInput = document.getElementById('regLanguage');
  const secretKeyInput = document.getElementById('regSecretKey');
  const errorEl = document.getElementById('regErrorMsg');

  const teamName = teamNameInput ? teamNameInput.value.trim() : '';
  const university = uniInput ? uniInput.value.trim() : '';
  const leaderName = leaderNameInput ? leaderNameInput.value.trim() : '';
  const leaderRoll = leaderRollInput ? leaderRollInput.value.trim() : '';
  const member2Name = (selectedTeamType === 'duo' && member2NameInput) ? member2NameInput.value.trim() : '';
  const member2Roll = (selectedTeamType === 'duo' && member2RollInput) ? member2RollInput.value.trim() : '';
  const language = langInput ? langInput.value : 'cpp';
  const secretKey = secretKeyInput ? secretKeyInput.value.trim() : '';

  if (errorEl) errorEl.textContent = '';

  if (timerData && timerData.status && timerData.status !== 'not_started') {
    const lockMsg = 'Registration Closed: The contest is currently in progress or has ended. Sir / Chief Judge must reset the previous contest before new registrations can be accepted.';
    if (errorEl) errorEl.textContent = lockMsg;
    showToast('Registration Locked 🔒', lockMsg, 'error');
    return;
  }

  if (!leaderName || !leaderRoll || !university) {
    if (errorEl) errorEl.textContent = 'Please fill all required fields (Name, Roll No, University).';
    return;
  }

  if (selectedTeamType === 'duo' && (!member2Name || !member2Roll)) {
    if (errorEl) errorEl.textContent = 'Please enter details for Member 2 (Name & Roll No).';
    return;
  }

  if (secretKey && !/^\d{6}$/.test(secretKey)) {
    if (errorEl) errorEl.textContent = 'Secret Key must be exactly 6 digits (e.g. 123456).';
    return;
  }

  try {
    const payload = {
      teamType: selectedTeamType,
      teamName: teamName || `${leaderName}'s Team`,
      university,
      leaderName,
      leaderRoll,
      member2Name,
      member2Roll,
      language,
      secretKey,
      profilePic: currentSelectedProfilePic || null
    };

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      updateTeamProfile(data.team);
      showToast('Registration Submitted! ⏳', data.message, 'info');

      if (window.handleLanguageChange) {
        window.handleLanguageChange(language);
        const langSelect = document.getElementById('editorLanguageSelect');
        if (langSelect) langSelect.value = language;
      }

      clearSelectedProfilePic();
      renderContestPassView();
      if (window.loadProblems) window.loadProblems();

      if (data.team.status === 'approved') {
        setTimeout(() => switchView('arena'), 800);
      }
    } else {
      if (errorEl) errorEl.textContent = data.message || 'Registration failed.';
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Server connection error during registration.';
  }
}

// Quick 6-Digit Secret Key / PIN / Roll No Session Restore
async function handlePassKeyRestore(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('restorePassKeyInput');
  const errorEl = document.getElementById('restorePassError');
  const query = input ? input.value.trim() : '';

  if (!query) {
    if (errorEl) errorEl.textContent = 'Please enter your 6-digit Secret Key (e.g. 123456) or Roll Number.';
    return;
  }

  try {
    const res = await fetch(`/api/team-status/${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.success && data.team) {
      updateTeamProfile(data.team);
      if (window.loadProblems) window.loadProblems();
      showToast('Session Restored! 🔑', `Welcome back ${data.team.teamName}! Your contest session is active.`, 'success');
      if (errorEl) errorEl.textContent = '';
      if (input) input.value = '';
      if (data.team.status === 'approved') {
        setTimeout(() => switchView('arena'), 500);
      } else {
        switchView('pass');
      }
    } else {
      if (errorEl) errorEl.textContent = data.message || 'No team found with this 6-digit Secret Key. Please verify with Sir.';
      showToast('Invalid Key', 'Secret Key does not match any registered team.', 'error');
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Server connection error.';
  }
}

// Unlink current pass on this browser / tab
function handleUnlinkTeam(promptConfirm = true) {
  if (promptConfirm && !confirm('Switch team or register a new team on this browser tab? You can restore this pass anytime with your 6-digit Secret Key.')) return;
  currentTeam = null;
  sessionStorage.removeItem('visue_team');
  localStorage.removeItem('visue_team');
  updateNavbarStudentBadge();
  renderContestPassView();
  showToast('Session Cleared', 'Ready for new team registration or Secret Key login.', 'info');
  switchView('pass');
}

// Focus the Secret Key restore input
function promptSecretKeyLogin() {
  handleUnlinkTeam(false);
  setTimeout(() => {
    const input = document.getElementById('restorePassKeyInput');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 150);
}

// Check live team approval & kickout status
async function checkLiveTeamStatus(passKey) {
  if (!passKey) return;
  try {
    const res = await fetch(`/api/team-status/${encodeURIComponent(passKey)}`);
    const data = await res.json();
    if (data.success && data.team && data.team.status !== 'rejected' && data.team.status !== 'kicked_out' && data.team.status !== 'deleted') {
      updateTeamProfile(data.team);
      if (data.resultsPublished !== undefined) {
        isOfficialResultsPublished = data.resultsPublished;
      }
    } else {
      // Clear obsolete team from local storage if not found or rejected/kicked out in server
      currentTeam = null;
      sessionStorage.removeItem('visue_team');
      localStorage.removeItem('visue_team');
      updateNavbarStudentBadge();
      renderContestPassView();
      if (window.refreshArenaState) window.refreshArenaState();
    }
  } catch (e) {}
}

function updateTeamProfile(team) {
  currentTeam = team;
  if (team) {
    sessionStorage.setItem('visue_team', JSON.stringify(team));
    localStorage.setItem('visue_team', JSON.stringify(team));
  } else {
    sessionStorage.removeItem('visue_team');
    localStorage.removeItem('visue_team');
  }
  updateNavbarStudentBadge();
  updateStudentPCLockBadge();
  renderContestPassView();
  if (window.refreshArenaState) window.refreshArenaState();
}

function updateStudentPCLockBadge(status) {
  const badge = document.getElementById('studentPCLockBadge');
  if (!badge) return;

  const currentStatus = status || (currentTeam ? currentTeam.pcLockStatus : null);
  if (currentStatus === 'locked') {
    badge.classList.remove('hidden');
    badge.classList.add('inline-flex');
  } else {
    badge.classList.remove('inline-flex');
    badge.classList.add('hidden');
  }
}

function setCurrentTeam(team) {
  updateTeamProfile(team);
}

function updateNavbarStudentBadge() {
  const badgeContainer = document.getElementById('navStudentBadge');
  if (!badgeContainer) return;

  if (currentTeam) {
    const isApproved = currentTeam.status === 'approved';
    const isKicked = currentTeam.status === 'kicked_out';

    badgeContainer.innerHTML = `
      <div class="flex items-center gap-1.5">
        <div onclick="switchView('pass')" class="flex items-center gap-2 cursor-pointer bg-slate-900/80 hover:bg-slate-800 border ${
          isApproved ? 'border-emerald-500/30' : (isKicked ? 'border-rose-500/50' : 'border-amber-500/40')
        } px-2.5 py-1.5 rounded-lg transition" title="Click to view Team Pass / Secret Key">
          ${renderTeamAvatarHtml(currentTeam, 'w-7 h-7 text-xs', 'border border-cyan-400/40')}
          <span class="w-2 h-2 rounded-full ${
            isApproved ? 'bg-emerald-400' : (isKicked ? 'bg-rose-500' : 'bg-amber-400 animate-pulse')
          }"></span>
          <div class="text-left text-xs">
            <div class="font-bold text-slate-200 leading-tight truncate max-w-[130px]">${currentTeam.teamName}</div>
            <div class="font-mono text-[10px] ${
              isApproved ? 'text-emerald-400' : (isKicked ? 'text-rose-400' : 'text-amber-400')
            }">
              ${isApproved ? `${currentTeam.score} / 60 pts • Verified` : (isKicked ? 'Disqualified' : 'Pending Sir Approval')}
            </div>
          </div>
        </div>
        <button 
          type="button" 
          onclick="handleUnlinkTeam(false)" 
          title="Switch Team / Register Another Team" 
          class="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-white/10 transition text-xs font-mono">
          🔄
        </button>
      </div>
    `;
  } else {
    badgeContainer.innerHTML = `
      <button onclick="switchView('pass')" class="btn-cyber flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition">
        <span>🎟️ Team Registration / Login</span>
      </button>
    `;
  }
}

function getCurrentTeam() {
  return currentTeam;
}

function isResultsPublishedGlobally() {
  return isOfficialResultsPublished;
}

// =========================================================================
// 6. HOLOGRAPHIC CONTEST PASS
// =========================================================================
function renderContestPassView() {
  const container = document.getElementById('passCardContainer');
  const regCard = document.getElementById('teamRegistrationCard');
  if (!container) return;

  if (regCard) {
    if (currentTeam) {
      regCard.classList.add('hidden');
    } else {
      regCard.classList.remove('hidden');
    }
  }

  if (!currentTeam) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 glass-panel rounded-2xl border border-white/5 max-w-sm mx-auto">
        <div class="text-3xl mb-2">🎫</div>
        <h3 class="text-base font-bold text-slate-200">No Contest Pass Generated Yet</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Fill the registration form to generate your official team pass and claim your contest credentials.</p>
      </div>
    `;
    return;
  }

  const isLeftEarly = Boolean(currentTeam.leftEarly || currentTeam.status === 'left_early');
  const isApproved = currentTeam.status === 'approved' && !isLeftEarly;
  const isKicked = currentTeam.status === 'kicked_out';
  const p1Solved = currentTeam.solvedProblems && currentTeam.solvedProblems.includes(1);
  const p2Solved = currentTeam.solvedProblems && currentTeam.solvedProblems.includes(2);
  const p3Solved = currentTeam.solvedProblems && currentTeam.solvedProblems.includes(3);

  container.innerHTML = `
    <div class="holographic-pass rounded-2xl p-6 text-white max-w-md w-full mx-auto relative border ${
      isLeftEarly ? 'border-rose-500/50 shadow-2xl bg-gradient-to-b from-rose-950/20 to-slate-900/40' :
      (isApproved ? 'border-cyan-500/40 shadow-2xl' : (isKicked ? 'border-rose-500/50 shadow-2xl' : 'border-amber-500/50 shadow-2xl'))
    }">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <span class="text-[10px] font-mono tracking-widest text-cyan-300 uppercase">OFFICIAL CONTEST PASS</span>
          <h3 class="text-lg font-black tracking-tight text-white mt-0.5">V Spark 2026</h3>
          <div class="text-[11px] font-mono text-slate-300">${currentTeam.university}</div>
        </div>
        <div class="text-right">
          <span class="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold ${
            isLeftEarly ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
            (isApproved ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
            (isKicked ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'))
          }">
            ${isLeftEarly ? '🚪 LEFT EARLY (Incomplete)' : (isApproved ? '● VERIFIED PASS' : (isKicked ? '✕ DISQUALIFIED' : '⏳ PENDING SIR APPROVAL'))}
          </span>
          <div class="text-[10px] font-mono text-slate-400 mt-1 uppercase">${currentTeam.teamType} SQUAD</div>
        </div>
      </div>

      <!-- Team Details -->
      <div class="py-4 space-y-3">
        <div class="flex items-center gap-3">
          ${renderTeamAvatarHtml(currentTeam, 'w-12 h-12 text-lg', 'border-2 border-cyan-400/50 shadow-md')}
          <div>
            <div class="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Team / Alias</div>
            <div class="text-xl font-black text-slate-100">${currentTeam.teamName}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="bg-black/30 p-2.5 rounded-lg border border-white/5">
            <div class="text-[10px] font-mono text-cyan-400 uppercase font-semibold">Leader</div>
            <div class="font-bold text-slate-200 mt-0.5">${currentTeam.leaderName}</div>
            <div class="font-mono text-[11px] text-slate-400">${currentTeam.leaderRoll}</div>
          </div>
          ${currentTeam.teamType === 'duo' && currentTeam.member2Name ? `
            <div class="bg-black/30 p-2.5 rounded-lg border border-white/5">
              <div class="text-[10px] font-mono text-cyan-400 uppercase font-semibold">Member 2</div>
              <div class="font-bold text-slate-200 mt-0.5">${currentTeam.member2Name}</div>
              <div class="font-mono text-[11px] text-slate-400">${currentTeam.member2Roll}</div>
            </div>
          ` : `
            <div class="bg-black/30 p-2.5 rounded-lg border border-white/5 flex flex-col justify-center">
              <div class="text-[10px] font-mono text-slate-500 uppercase font-semibold">Solo Mode</div>
              <div class="font-bold text-slate-400 text-xs mt-0.5">Individual Entry</div>
            </div>
          `}
        </div>

        <div class="flex items-center justify-between text-xs pt-1">
          <div>
            <span class="text-slate-400 font-mono text-[11px]">Language: </span>
            <span class="font-mono font-bold text-cyan-300 uppercase">${currentTeam.language}</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400 font-mono text-[11px]">🔑 Secret PIN: </span>
            <span class="font-mono font-black text-amber-400 text-sm tracking-widest">${currentTeam.secretKey || currentTeam.passKey}</span>
          </div>
        </div>
      </div>

      <!-- Problem Solved Progress -->
      <div class="pt-3 border-t border-white/10">
        <div class="text-[10px] font-mono uppercase text-slate-400 mb-2 flex items-center justify-between">
          <span>Contest Milestones (60 Pts Total)</span>
          <span class="text-amber-400 font-bold font-mono">${currentTeam.score || 0} / 60 pts</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center text-xs font-mono">
          <div class="p-2 rounded-lg border ${p1Solved ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-black/30 border-white/5 text-slate-500'}">
            <div class="text-[10px] uppercase font-bold">Q1 (10pts)</div>
            <div class="font-bold mt-0.5">${p1Solved ? '✓ SOLVED' : 'PENDING'}</div>
          </div>
          <div class="p-2 rounded-lg border ${p2Solved ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-black/30 border-white/5 text-slate-500'}">
            <div class="text-[10px] uppercase font-bold">Q2 (20pts)</div>
            <div class="font-bold mt-0.5">${p2Solved ? '✓ SOLVED' : 'PENDING'}</div>
          </div>
          <div class="p-2 rounded-lg border ${p3Solved ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-black/30 border-white/5 text-slate-500'}">
            <div class="text-[10px] uppercase font-bold">Q3 (30pts)</div>
            <div class="font-bold mt-0.5">${p3Solved ? '✓ SOLVED' : 'PENDING'}</div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="pt-5 flex flex-col items-center gap-2">
        ${isLeftEarly ? `
          <button 
            onclick="switchView('arena')" 
            class="btn-cyber w-full py-2.5 rounded-xl text-xs font-black uppercase text-rose-200 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 transition flex items-center justify-center gap-1.5 shadow">
            <span>🚪 Review Submitted Solutions (Arena)</span>
          </button>
        ` : (isApproved ? `
          <button 
            onclick="switchView('arena')" 
            class="btn-cyber w-full py-2.5 rounded-xl text-xs font-black uppercase text-slate-950 bg-gradient-to-r from-emerald-400 to-lime-400 hover:from-emerald-300 hover:to-lime-300 transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20">
            <span>🚀 Enter Speed Arena</span>
          </button>
        ` : (isKicked ? `
          <div class="w-full text-center py-2.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs font-mono text-rose-300">
            Pass Revoked by Judge
          </div>
        ` : `
          <div class="w-full text-center py-2.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs font-mono text-amber-300 flex items-center justify-center gap-2">
            <span class="animate-spin text-sm">⏳</span>
            <span>Awaiting Sir's Approval to Unlock Arena...</span>
          </div>
        `))}

        <!-- Download Windows Exam-Lock Script (.bat) -->
        <div class="w-full pt-2">
          <a 
            href="/api/team/exam-lock-script/${encodeURIComponent(currentTeam.secretKey || currentTeam.passKey || currentTeam.id)}" 
            download
            class="btn-cyber w-full py-2.5 rounded-xl text-xs font-mono font-bold text-cyan-200 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 transition flex items-center justify-center gap-2 shadow-md">
            <span>🛡️</span>
            <span>Download Exam-Lock Tool (.bat)</span>
            <span class="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/40">Windows</span>
          </a>
          <p class="text-[10px] text-slate-400 text-center mt-1 leading-snug">
            Locks Windows internet to V Spark Arena during exam. Automatically restores & deletes upon contest completion.
          </p>
        </div>

        <!-- Multi-Team Quick Actions (Allows multiple teams across tabs/browsers) -->
        <div class="w-full pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono">
          <button 
            type="button" 
            onclick="handleUnlinkTeam(false)" 
            class="text-[11px] text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1">
            <span>➕</span>
            <span>Register Another Team</span>
          </button>
          <button 
            type="button" 
            onclick="promptSecretKeyLogin()" 
            class="text-[11px] text-amber-400 hover:text-amber-300 transition flex items-center gap-1">
            <span>🔑</span>
            <span>Switch Team (Enter PIN)</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// 7. LEADERBOARD & PODIUM (Empty / Masked until Sir Publishes)
// =========================================================================
async function fetchInitialLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    if (data.success) {
      const isPub = Boolean(data.published ?? data.isResultsPublished);
      isOfficialResultsPublished = isPub;
      renderLeaderboard(data.leaderboard || [], isPub, Boolean(data.isArchived));
    }
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
  }
}

function renderLeaderboard(list, isPublished = false, isArchived = false) {
  lastLeaderboard = list || [];
  isOfficialResultsPublished = Boolean(isPublished);

  const pendingNotice = document.getElementById('podiumPendingNotice');
  const podiumContainer = document.getElementById('podiumContainer');
  const tableContainer = document.getElementById('leaderboardTableCard');
  const archiveBanner = document.getElementById('podiumArchiveBanner');

  // If results are published OR any team has received marks / scored OR archived results exist, unmask the podium!
  const hasEvaluatedScores = lastLeaderboard.some(t => t.score > 0 || (t.solvedProblems && t.solvedProblems.length > 0));
  const shouldReveal = isPublished || hasEvaluatedScores || isArchived;

  if (!shouldReveal) {
    // Masked / Hidden State: Only shown if no teams have scores yet and Sir hasn't published
    if (pendingNotice) pendingNotice.classList.remove('hidden');
    if (podiumContainer) podiumContainer.classList.add('hidden');
    if (tableContainer) tableContainer.classList.add('hidden');
    if (archiveBanner) archiveBanner.classList.add('hidden');
    return;
  }

  // Published / Evaluated State: Reveal podium and full leaderboard
  if (pendingNotice) pendingNotice.classList.add('hidden');
  if (podiumContainer) podiumContainer.classList.remove('hidden');
  if (tableContainer) {
    if (lastLeaderboard.length > 3) {
      tableContainer.classList.remove('hidden');
    } else {
      tableContainer.classList.add('hidden');
    }
  }

  if (archiveBanner) {
    if (isArchived) {
      archiveBanner.classList.remove('hidden');
    } else {
      archiveBanner.classList.add('hidden');
    }
  }

  renderPodium(lastLeaderboard);
  renderLeaderboardTable(lastLeaderboard);
}

function renderPodium(list) {
  const winner = list[0] || null;       // 1st: Winner / Champion
  const runnerUp = list[1] || null;     // 2nd: Runner Up
  const secondRunner = list[2] || null; // 3rd: 2nd Runner Up
  const totalPoints = (list[0] && list[0].totalContestPoints) || 60;

  const podiumContainer = document.getElementById('podiumContainer');
  if (!podiumContainer) return;

  function renderBreakdownBadges(qb) {
    if (!qb || Object.keys(qb).length === 0) return '';
    return Object.values(qb).map(item => `
      <span class="text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
        item.difficulty === 'Easy' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
        item.difficulty === 'Medium' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
        'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      }">
        ${item.difficulty}: +${item.scoreAwarded}p
      </span>
    `).join('');
  }

  podiumContainer.innerHTML = `
    <!-- Rank 2: RUNNER UP (Left) -->
    <div class="podium-card ${runnerUp ? 'podium-silver' : 'border border-white/5'} rounded-2xl p-5 flex flex-col items-center text-center relative bg-slate-900/80 transition-all">
      <div class="relative mb-2">
        ${renderTeamAvatarHtml(runnerUp, 'w-14 h-14 text-xl', 'border-2 border-slate-300 ring-4 ring-slate-400/20')}
        <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-300 text-slate-950 flex items-center justify-center text-xs font-black border border-white shadow">🥈</div>
      </div>
      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-500/40 mb-2 uppercase">
        RUNNER UP • RANK #2
      </span>
      <h4 class="font-extrabold text-base text-slate-100 truncate w-full">${runnerUp ? runnerUp.teamName : 'Awaiting Runner Up'}</h4>
      <div class="font-mono text-xs text-cyan-400 truncate w-full mt-0.5">${runnerUp ? runnerUp.university : '----'}</div>
      <div class="font-mono text-[11px] text-slate-400 mt-1">${runnerUp ? `${runnerUp.leaderName} (${runnerUp.leaderRoll})` : ''}</div>
      <div class="mt-3 font-mono text-2xl font-black text-slate-200">
        ${runnerUp ? `${runnerUp.score} <span class="text-xs font-bold text-slate-400">/ ${totalPoints} pts</span>` : `0 / ${totalPoints} pts`}
      </div>
      ${runnerUp && runnerUp.questionBreakdown && Object.keys(runnerUp.questionBreakdown).length > 0 ? `
        <div class="mt-2 flex items-center justify-center gap-1 flex-wrap">
          ${renderBreakdownBadges(runnerUp.questionBreakdown)}
        </div>
      ` : ''}
      <div class="mt-2 text-[11px] font-mono text-emerald-400 uppercase font-semibold">
        ${runnerUp ? `Solved: ${runnerUp.solvedProblems ? runnerUp.solvedProblems.length : 0}/3 • ${runnerUp.language}` : ''}
      </div>
      ${runnerUp && (runnerUp.timeTakenWords || runnerUp.timeTakenFormatted) ? `
        <div class="mt-1 text-[11px] font-mono font-bold text-slate-300">⏱️ Finished in ${runnerUp.timeTakenWords || runnerUp.timeTakenFormatted}</div>
      ` : ''}
    </div>

    <!-- Rank 1: WINNER / CHAMPION (Center - Elevated) -->
    <div class="podium-card ${winner ? 'podium-gold' : 'border border-white/5'} rounded-2xl p-6 flex flex-col items-center text-center relative bg-slate-900/90 md:-mt-2 shadow-2xl transition-all">
      <div class="relative mb-2">
        ${renderTeamAvatarHtml(winner, 'w-16 h-16 text-2xl', 'border-2 border-amber-400 ring-4 ring-amber-400/30')}
        <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 text-2xl select-none filter drop-shadow">👑</div>
        <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-xs font-black border border-amber-300 shadow">🥇</div>
      </div>
      <span class="px-3 py-1 rounded-full text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/50 mb-2 uppercase">
        🏆 FIRST PLACE • WINNER
      </span>
      <h3 class="font-black text-xl text-white truncate w-full">${winner ? winner.teamName : 'Awaiting Champion'}</h3>
      <div class="font-mono text-xs text-cyan-300 font-bold truncate w-full mt-0.5">${winner ? winner.university : '----'}</div>
      <div class="font-mono text-xs text-slate-300 mt-1">${winner ? `${winner.leaderName} (${winner.leaderRoll})` : ''}</div>
      <div class="mt-4 font-mono text-3xl font-black text-amber-400">
        ${winner ? `${winner.score} <span class="text-base font-bold text-slate-300">/ ${totalPoints} pts</span>` : `0 / ${totalPoints} pts`}
      </div>
      ${winner && winner.questionBreakdown && Object.keys(winner.questionBreakdown).length > 0 ? `
        <div class="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
          ${renderBreakdownBadges(winner.questionBreakdown)}
        </div>
      ` : ''}
      <div class="mt-2 text-xs font-mono text-emerald-300 uppercase font-bold">
        ${winner ? `⚡ Solved: ${winner.solvedProblems ? winner.solvedProblems.length : 0}/3 • ${winner.language}` : ''}
      </div>
      ${winner && (winner.timeTakenWords || winner.timeTakenFormatted) ? `
        <div class="mt-1 text-xs font-mono font-black text-amber-300">⏱️ Finished in ${winner.timeTakenWords || winner.timeTakenFormatted}</div>
      ` : ''}
    </div>

    <!-- Rank 3: 2ND RUNNER UP (Right) -->
    <div class="podium-card ${secondRunner ? 'podium-bronze' : 'border border-white/5'} rounded-2xl p-5 flex flex-col items-center text-center relative bg-slate-900/80 transition-all">
      <div class="relative mb-2">
        ${renderTeamAvatarHtml(secondRunner, 'w-14 h-14 text-xl', 'border-2 border-amber-600 ring-4 ring-amber-600/20')}
        <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black border border-amber-400 shadow">🥉</div>
      </div>
      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-950/60 text-amber-500 border border-amber-700/40 mb-2 uppercase">
        2ND RUNNER UP • RANK #3
      </span>
      <h4 class="font-extrabold text-base text-slate-100 truncate w-full">${secondRunner ? secondRunner.teamName : 'Awaiting Rank #3'}</h4>
      <div class="font-mono text-xs text-cyan-400 truncate w-full mt-0.5">${secondRunner ? secondRunner.university : '----'}</div>
      <div class="font-mono text-[11px] text-slate-400 mt-1">${secondRunner ? `${secondRunner.leaderName} (${secondRunner.leaderRoll})` : ''}</div>
      <div class="mt-3 font-mono text-2xl font-black text-amber-500">
        ${secondRunner ? `${secondRunner.score} <span class="text-xs font-bold text-slate-400">/ ${totalPoints} pts</span>` : `0 / ${totalPoints} pts`}
      </div>
      ${secondRunner && secondRunner.questionBreakdown && Object.keys(secondRunner.questionBreakdown).length > 0 ? `
        <div class="mt-2 flex items-center justify-center gap-1 flex-wrap">
          ${renderBreakdownBadges(secondRunner.questionBreakdown)}
        </div>
      ` : ''}
      <div class="mt-2 text-[11px] font-mono text-emerald-400 uppercase font-semibold">
        ${secondRunner ? `Solved: ${secondRunner.solvedProblems ? secondRunner.solvedProblems.length : 0}/3 • ${secondRunner.language}` : ''}
      </div>
      ${secondRunner && (secondRunner.timeTakenWords || secondRunner.timeTakenFormatted) ? `
        <div class="mt-1 text-[11px] font-mono font-bold text-amber-400">⏱️ Finished in ${secondRunner.timeTakenWords || secondRunner.timeTakenFormatted}</div>
      ` : ''}
    </div>
  `;
}

function renderLeaderboardTable(list) {
  const tbody = document.getElementById('leaderboardTableBody');
  if (!tbody) return;
  const totalPoints = (list[0] && list[0].totalContestPoints) || 60;

  const query = (leaderboardFilter || '').toLowerCase().trim();
  // Filter: if query entered, search across all teams. If no query, show ranks 4+ (since top 3 are on the podium cards)
  const filtered = list.filter(t => {
    if (!query) return t.rank > 3;
    return (
      t.teamName.toLowerCase().includes(query) ||
      t.leaderName.toLowerCase().includes(query) ||
      t.leaderRoll.toLowerCase().includes(query) ||
      t.university.toLowerCase().includes(query) ||
      (t.member2Name && t.member2Name.toLowerCase().includes(query)) ||
      (t.member2Roll && t.member2Roll.toLowerCase().includes(query))
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-slate-500 text-sm">
          No teams found matching search.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const isMe = currentTeam && currentTeam.id === t.id;
    const p1 = t.solvedProblems && t.solvedProblems.includes(1);
    const p2 = t.solvedProblems && t.solvedProblems.includes(2);
    const p3 = t.solvedProblems && t.solvedProblems.includes(3);
    const percentage = Math.min(100, Math.round((t.score / totalPoints) * 100));

    return `
      <tr class="border-b border-white/5 hover:bg-slate-800/40 transition-colors ${isMe ? 'bg-emerald-500/10' : ''}">
        <td class="px-4 py-3 font-mono font-bold text-sm whitespace-nowrap">
          ${
            t.rank === 1 ? '<span class="text-amber-400">🥇 Winner</span>' :
            t.rank === 2 ? '<span class="text-slate-300">🥈 Runner Up</span>' :
            t.rank === 3 ? '<span class="text-amber-600">🥉 2nd Runner Up</span>' :
            `<span class="text-slate-400">#${t.rank}</span>`
          }
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            ${renderTeamAvatarHtml(t, 'w-8 h-8 text-xs', 'border border-white/20')}
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-200 text-sm">${t.teamName}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold uppercase bg-slate-800 text-cyan-300">${t.teamType}</span>
                ${isMe ? '<span class="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">YOU</span>' : ''}
              </div>
              <div class="text-xs text-slate-400 mt-0.5">
                ${t.leaderName} (${t.leaderRoll}) ${t.member2Name ? `• ${t.member2Name}` : ''}
              </div>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-xs text-slate-300 font-medium">
          <div class="truncate max-w-[200px]">${t.university}</div>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1.5 font-mono text-xs flex-wrap">
            ${
              t.questionBreakdown && Object.keys(t.questionBreakdown).length > 0
                ? Object.values(t.questionBreakdown).map(qb => `
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                      qb.difficulty === 'Easy' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                      qb.difficulty === 'Medium' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' :
                      'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }" title="${qb.title || ''}">
                      ${qb.difficulty}: +${qb.scoreAwarded}p
                    </span>
                  `).join('')
                : `
                    <span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${p1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-600'}">Q1</span>
                    <span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${p2 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-slate-800 text-slate-600'}">Q2</span>
                    <span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${p3 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-600'}">Q3</span>
                  `
            }
          </div>
        </td>
        <td class="px-4 py-3 font-mono text-xs uppercase text-slate-400 font-semibold">
          ${t.language}
        </td>
        <td class="px-4 py-3 font-mono text-right whitespace-nowrap">
          <div class="font-black text-amber-400 text-sm sm:text-base">
            ${t.score} <span class="text-xs font-bold text-slate-400">/ ${totalPoints} pts</span>
          </div>
          ${t.timeTakenWords || t.timeTakenFormatted ? `
            <div class="text-[10px] text-amber-300 font-bold mt-0.5 font-mono">
              ⏱️ ${t.timeTakenWords || t.timeTakenFormatted}
            </div>
          ` : `
            <div class="text-[10px] text-emerald-400 font-semibold mt-0.5">
              ${percentage}% Awarded
            </div>
          `}
          <div class="w-24 ml-auto h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
            <div class="h-full bg-gradient-to-r from-emerald-400 to-lime-400 rounded-full" style="width: ${percentage}%"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function handleLeaderboardSearch(e) {
  leaderboardFilter = (e.target.value || '').trim();
  const tableContainer = document.getElementById('leaderboardTableCard');
  if (tableContainer) {
    if (leaderboardFilter || (lastLeaderboard && lastLeaderboard.length > 3)) {
      tableContainer.classList.remove('hidden');
    } else {
      tableContainer.classList.add('hidden');
    }
  }
  renderLeaderboardTable(lastLeaderboard);
}

// =========================================================================
// 8. THEME TOGGLE (Dark / Light High-Contrast Engine)
// =========================================================================
function initTheme() {
  const saved = localStorage.getItem('visue_theme') || 'dark';
  applyTheme(saved);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
}

function applyTheme(theme) {
  const icon = document.getElementById('themeToggleIcon');
  const label = document.getElementById('themeToggleLabel');

  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('visue_theme', 'light');
    if (icon) icon.textContent = '🌙';
    if (label) label.textContent = 'Light';
  } else {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    localStorage.setItem('visue_theme', 'dark');
    if (icon) icon.textContent = '☀️';
    if (label) label.textContent = 'Dark';
  }
}

// 9. Toast Engine (Adaptive Dark & Light Theme Architecture)
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const validTypes = ['info', 'success', 'warning', 'error'];
  const safeType = validTypes.includes(type) ? type : 'info';

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  const toast = document.createElement('div');
  toast.className = `visue-toast visue-toast-${safeType} transform translate-y-2 opacity-0`;
  toast.innerHTML = `
    <span class="visue-toast-icon">${icons[safeType]}</span>
    <div class="flex-1 min-w-0">
      <div class="visue-toast-title">${title}</div>
      <div class="visue-toast-msg">${message}</div>
    </div>
    <button type="button" class="visue-toast-close" onclick="this.parentElement.remove()" title="Close">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 350);
  }, 4200);
}

// Window bindings
window.switchView = switchView;
window.setParticipationMode = setParticipationMode;
window.handleTeamRegister = handleTeamRegister;
window.handleTimerStateUpdate = handleTimerStateUpdate;
window.freezeTeamTimer = freezeTeamTimer;
window.getCurrentTeam = getCurrentTeam;
window.setCurrentTeam = setCurrentTeam;
window.updateTeamProfile = updateTeamProfile;
window.isResultsPublishedGlobally = isResultsPublishedGlobally;
window.renderLeaderboard = renderLeaderboard;
window.handleLeaderboardSearch = handleLeaderboardSearch;
window.handlePassKeyRestore = handlePassKeyRestore;
window.handleUnlinkTeam = handleUnlinkTeam;
window.updateStudentPCLockBadge = updateStudentPCLockBadge;
window.toggleTheme = toggleTheme;
window.showToast = showToast;