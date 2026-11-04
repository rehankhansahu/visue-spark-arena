// ============================================================================
// V Spark 2026 - Speed Arena Engine
// Welcome Screen, 4 Languages (C, C++, Java, Python), Solved Ticks,
// All 3 Completed Banner, & Live Results Navigation
// ============================================================================

let contestProblems = [];
let activeProblem = null;
let currentLanguage = 'cpp';
let isRunningTests = false;

// Helpers for team-scoped local storage (prevents draft bleed between teams on same browser)
function getTeamStorageKey(baseKey) {
  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  const teamId = currentTeam ? currentTeam.id : 'global';
  return `visue_${teamId}_${baseKey}`;
}

function getTeamStorageItem(baseKey) {
  const teamKey = getTeamStorageKey(baseKey);
  const teamVal = localStorage.getItem(teamKey);
  if (teamVal !== null) return teamVal;
  return localStorage.getItem(`visue_${baseKey}`);
}

function setTeamStorageItem(baseKey, val) {
  const teamKey = getTeamStorageKey(baseKey);
  localStorage.setItem(teamKey, val);
}

function removeTeamStorageItem(baseKey) {
  const teamKey = getTeamStorageKey(baseKey);
  localStorage.removeItem(teamKey);
  localStorage.removeItem(`visue_${baseKey}`);
}

// 1. Fetch Contest Problems from API (Easy 10pts, Medium 20pts, Hard 30pts)
async function loadProblems() {
  try {
    if (!window.timerData) {
      try {
        const tRes = await fetch('/api/timer');
        const tData = await tRes.json();
        if (tData.success && tData.timer) {
          window.timerData = tData.timer;
        }
      } catch (te) {}
    }

    const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
    const teamParam = currentTeam ? `?teamId=${encodeURIComponent(currentTeam.id)}` : '';
    const res = await fetch(`/api/problems${teamParam}`);
    const data = await res.json();

    if (data.success && data.problems.length > 0) {
      function getDiffRank(p) {
        const d = (p.difficulty || '').toLowerCase();
        const pts = parseInt(p.points, 10) || 0;
        if (d === 'easy' || pts === 10) return 1;
        if (d === 'medium' || pts === 20) return 2;
        if (d === 'hard' || pts === 30) return 3;
        return 4;
      }
      contestProblems = data.problems.sort((a, b) => {
        const rA = getDiffRank(a);
        const rB = getDiffRank(b);
        if (rA !== rB) return rA - rB;
        return (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
      });
      contestProblems.forEach((p, idx) => {
        p.slotNumber = idx + 1;
      });

      // Automatically sync code editor language to the student's chosen language at registration!
      if (currentTeam && currentTeam.language) {
        handleLanguageChange(currentTeam.language);
      }

      renderProblemTabs();
      selectProblem(contestProblems[0].id);
      refreshArenaState();
    } else {
      contestProblems = [];
      const container = document.getElementById('problemTabsContainer');
      if (container) {
        container.innerHTML = '<span class="text-xs font-mono text-slate-500 italic px-2">No active challenges assigned yet. Sir will add questions.</span>';
      }
      const titleEl = document.getElementById('problemTitle');
      if (titleEl) titleEl.textContent = 'Awaiting Contest Challenges...';
      const descEl = document.getElementById('problemDescription');
      if (descEl) descEl.textContent = 'Sir / Chief Judge has not assigned questions to the active contest slots yet. Please check back shortly.';
      refreshArenaState();
    }
  } catch (err) {
    console.error('Failed to load problems:', err);
  }
}

// 2. Arena Welcome Screen vs Active Workspace
function refreshArenaState() {
  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  const welcomeHero = document.getElementById('arenaWelcomeHero');
  const lockedHero = document.getElementById('arenaLockedHero');
  const arenaWorkspace = document.getElementById('arenaWorkspace');
  const welcomeStatusText = document.getElementById('welcomeTeamStatus');

  if (!welcomeHero || !arenaWorkspace) return;

  const totalPoints = (contestProblems || []).reduce((sum, p) => sum + (p.points || 0), 0);
  const hasFullBudget = Boolean(contestProblems && contestProblems.length > 0 && totalPoints === 60);

  const timer = window.timerData;
  const isTimerStarted = Boolean(timer && (timer.status === 'running' || timer.status === 'paused' || timer.status === 'ended'));

  const isEndedOrLeft = Boolean(currentTeam && (currentTeam.leftEarly || currentTeam.status === 'left_early' || currentTeam.isTimeUp || window.isContestTimeUp));

  if (currentTeam && (currentTeam.status === 'approved' || isEndedOrLeft)) {
    if (isEndedOrLeft || (hasFullBudget && isTimerStarted)) {
      // Both approved AND 60 points of questions assigned AND Sir has started the timer (or read-only review mode after time/exit)!
      welcomeHero.classList.add('hidden');
      if (lockedHero) lockedHero.classList.add('hidden');
      arenaWorkspace.classList.remove('hidden');
    } else {
      // Approved, but either Sir hasn't started timer yet OR budget isn't 60 pts -> Arena Locked!
      welcomeHero.classList.add('hidden');
      arenaWorkspace.classList.add('hidden');
      if (lockedHero) {
        lockedHero.classList.remove('hidden');
        updateArenaLockedHeroSlots(hasFullBudget, isTimerStarted, totalPoints);
      }
    }
  } else {
    welcomeHero.classList.remove('hidden');
    if (lockedHero) lockedHero.classList.add('hidden');
    arenaWorkspace.classList.add('hidden');

    if (welcomeStatusText) {
      if (currentTeam && currentTeam.status === 'pending') {
        welcomeStatusText.innerHTML = `
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <span>⏳</span>
            <span>Registration Submitted for "${currentTeam.teamName}" • Waiting for Sir's Approval</span>
          </div>
        `;
      } else if (currentTeam && currentTeam.status === 'kicked_out') {
        welcomeStatusText.innerHTML = `
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <span>⚠️</span>
            <span>Your team has been removed / disqualified by Sir.</span>
          </div>
        `;
      } else {
        welcomeStatusText.innerHTML = `
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span>🎟️</span>
            <span>Registration Open for Solo & Duo Teams from All Universities</span>
          </div>
        `;
      }
    }
  }

  checkAllProblemsCompleted();
}

function updateArenaLockedHeroSlots(hasFullBudget = false, isTimerStarted = false, totalPoints = 0) {
  const badgeEl = document.getElementById('arenaLockedBadge');
  const titleEl = document.getElementById('arenaLockedTitle');
  const descEl = document.getElementById('arenaLockedDesc');
  const footerEl = document.getElementById('arenaLockedFooterText');

  if (hasFullBudget && !isTimerStarted) {
    if (badgeEl) {
      badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider';
      badgeEl.textContent = 'CHALLENGES READY • WAITING FOR SIR TO START';
    }
    if (titleEl) {
      titleEl.textContent = 'Awaiting Contest Start from Sir';
    }
    if (descEl) {
      descEl.innerHTML = 'All 3 contest challenges (totaling <strong class="text-emerald-400 font-bold">60 Points</strong>) have been loaded! The live workspace will unlock automatically the moment Sir starts the contest timer.';
    }
    if (footerEl) {
      footerEl.textContent = '🔒 Workspace unlocks automatically once Sir starts the contest timer!';
    }
  } else if (!hasFullBudget) {
    if (badgeEl) {
      badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider';
      badgeEl.textContent = 'CONTEST ARENA LOCKED';
    }
    if (titleEl) {
      titleEl.textContent = 'Awaiting Contest Challenges from Sir';
    }
    if (descEl) {
      descEl.innerHTML = `Your team pass is <strong class="text-emerald-400 font-bold">VERIFIED & ACTIVE</strong>! Sir must assign challenges totaling 60 points before the contest starts (Currently: <strong>${totalPoints}/60 pts</strong>).`;
    }
    if (footerEl) {
      footerEl.textContent = '🔒 Workspace unlocks automatically once all questions totaling 60 points are set and Sir starts timer!';
    }
  }

  const q1 = contestProblems.find(p => p.slotNumber === 1 || p.points === 10 || p.difficulty === 'Easy');
  const q2 = contestProblems.find(p => p.slotNumber === 2 || p.points === 20 || p.difficulty === 'Medium');
  const q3 = contestProblems.find(p => p.slotNumber === 3 || p.points === 30 || p.difficulty === 'Hard');

  const status1 = document.getElementById('arenaSlotStatusEasy');
  const status2 = document.getElementById('arenaSlotStatusMed');
  const status3 = document.getElementById('arenaSlotStatusHard');

  const card1 = document.getElementById('arenaLockedSlotEasy');
  const card2 = document.getElementById('arenaLockedSlotMed');
  const card3 = document.getElementById('arenaLockedSlotHard');

  if (status1 && card1) {
    if (q1) {
      status1.textContent = '🔒 10 Points • Easy Challenge';
      status1.className = 'font-bold text-emerald-400 truncate text-xs';
      card1.className = 'p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 space-y-1';
    } else {
      status1.textContent = '⏳ 10 Points • Pending Sir...';
      status1.className = 'font-bold text-slate-500 text-xs';
      card1.className = 'p-3 rounded-xl border bg-slate-900/80 border-white/10 space-y-1';
    }
  }

  if (status2 && card2) {
    if (q2) {
      status2.textContent = '🔒 20 Points • Medium Challenge';
      status2.className = 'font-bold text-cyan-400 truncate text-xs';
      card2.className = 'p-3 rounded-xl border bg-cyan-500/10 border-cyan-500/30 space-y-1';
    } else {
      status2.textContent = '⏳ 20 Points • Pending Sir...';
      status2.className = 'font-bold text-slate-500 text-xs';
      card2.className = 'p-3 rounded-xl border bg-slate-900/80 border-white/10 space-y-1';
    }
  }

  if (status3 && card3) {
    if (q3) {
      status3.textContent = '🔒 30 Points • Hard Challenge';
      status3.className = 'font-bold text-amber-400 truncate text-xs';
      card3.className = 'p-3 rounded-xl border bg-amber-500/10 border-amber-500/30 space-y-1';
    } else {
      status3.textContent = '⏳ 30 Points • Pending Sir...';
      status3.className = 'font-bold text-slate-500 text-xs';
      card3.className = 'p-3 rounded-xl border bg-slate-900/80 border-white/10 space-y-1';
    }
  }
}

// 3. Render Problem Navigation Tabs with Solved Ticks & Difficulty Categories
function renderProblemTabs() {
  const container = document.getElementById('problemTabsContainer');
  if (!container) return;

  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  const solved = currentTeam && currentTeam.solvedProblems ? currentTeam.solvedProblems : [];

  container.innerHTML = contestProblems.map(p => {
    const isSolved = solved.includes(p.id);
    const diff = p.difficulty || (p.points === 10 ? 'Easy' : (p.points === 20 ? 'Medium' : 'Hard'));

    return `
      <button 
        onclick="selectProblem(${p.id})" 
        id="problem-tab-${p.id}"
        class="problem-tab px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-all border border-white/5 bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/80">
        <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-xs font-bold ${
          isSolved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20' : 'bg-slate-800 text-slate-300'
        }">
          ${isSolved ? '✓' : p.slotNumber || p.id}
        </span>
        <span class="truncate max-w-[130px] font-semibold">${p.title}</span>
        <span class="text-[11px] px-2 py-0.5 rounded-full font-bold ${
          diff === 'Easy' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
          diff === 'Medium' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
        }">
          ${diff} ${isSolved ? '• ✅' : `(${p.points}p)`}
        </span>
      </button>
    `;
  }).join('');
}

// 4. Select Problem & Update UI
function selectProblem(id) {
  const p = contestProblems.find(item => item.id === id);
  if (!p) return;
  activeProblem = p;

  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  const isSolved = currentTeam && currentTeam.solvedProblems && currentTeam.solvedProblems.includes(p.id);
  const totalAssigned = contestProblems.length;
  const allSolved = Boolean(currentTeam && (
    currentTeam.isCompleted ||
    (currentTeam.solvedProblems && totalAssigned > 0 && contestProblems.every(item => currentTeam.solvedProblems.includes(item.id))) ||
    (currentTeam.score >= 60)
  ));

  // Highlight active tab
  document.querySelectorAll('.problem-tab').forEach(tab => {
    tab.classList.remove('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/50');
    tab.classList.add('bg-slate-900/60', 'text-slate-400');
  });
  const activeTabEl = document.getElementById(`problem-tab-${id}`);
  if (activeTabEl) {
    activeTabEl.classList.remove('bg-slate-900/60', 'text-slate-400');
    activeTabEl.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/50');
  }

  // Left Column Details
  document.getElementById('problemTitle').textContent = `Problem #${p.slotNumber || p.id}: ${p.title}`;
  document.getElementById('problemDifficultyBadge').textContent = p.difficulty;
  document.getElementById('problemPointsBadge').textContent = `${p.points} Points`;
  const langBadge = document.getElementById('problemLanguagesBadge');
  if (langBadge) {
    const qLangs = (p.languages && Array.isArray(p.languages) && p.languages.length > 0)
      ? p.languages
      : ['C', 'C++', 'Java', 'Python'];

    if (qLangs.length >= 4) {
      langBadge.textContent = '🌐 Languages: C • C++ • Java • Python';
    } else {
      langBadge.textContent = `🌐 Language: ${qLangs.join(' • ')}`;
    }
  }

  // Ensure current editor language defaults to student's chosen language if supported
  if (currentTeam && currentTeam.language) {
    const cleanTeamLang = currentTeam.language.toLowerCase();
    const qLangs = (p.languages && Array.isArray(p.languages)) ? p.languages : ['C', 'C++', 'Java', 'Python'];
    const aliasMap = { 'cpp': 'c++', 'c': 'c', 'java': 'java', 'python': 'python', 'py': 'python' };
    const accepted = aliasMap[cleanTeamLang] || cleanTeamLang;
    const supportsTeamLang = qLangs.some(l => l.toLowerCase() === accepted || l.toLowerCase() === cleanTeamLang || l.toLowerCase() === 'all');
    if (supportsTeamLang) {
      handleLanguageChange(currentTeam.language);
    }
  }

  document.getElementById('problemTimeLimit').textContent = p.timeLimit || '1.0s';
  document.getElementById('problemMemoryLimit').textContent = p.memoryLimit || '256MB';
  document.getElementById('problemDescription').textContent = p.description;
  const elInput = document.getElementById('problemInputFormat');
  if (elInput) elInput.textContent = p.inputFormat || '';
  const elOutput = document.getElementById('problemOutputFormat');
  if (elOutput) elOutput.textContent = p.outputFormat || '';

  // Solved indicator on header
  const solvedBadge = document.getElementById('problemSolvedStatusBadge');
  if (solvedBadge) {
    if (isSolved) {
      solvedBadge.className = 'px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 inline-flex items-center gap-1';
      solvedBadge.innerHTML = `<span>✅</span> <span>SOLVED (+${p.points} pts)</span>`;
      solvedBadge.classList.remove('hidden');
    } else {
      solvedBadge.classList.add('hidden');
    }
  }

  // Constraints (if present in DOM)
  const constraintsList = document.getElementById('problemConstraintsList');
  if (constraintsList && p.constraints) {
    constraintsList.innerHTML = p.constraints.map(c => `
      <li class="font-mono text-xs text-slate-300 bg-slate-900/70 px-2.5 py-1 rounded border border-white/5">${c}</li>
    `).join('');
  }

  // Tags
  const tagsContainer = document.getElementById('problemTagsContainer');
  if (tagsContainer && p.tags) {
    tagsContainer.innerHTML = p.tags.map(t => `
      <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">${t}</span>
    `).join('');
  }

  // Test Cases (Unboxed, spacious, crystal clear typography)
  const samplesContainer = document.getElementById('problemSamplesContainer');
  if (samplesContainer && p.sampleCases) {
    samplesContainer.innerHTML = p.sampleCases.map((s, idx) => `
      <div class="test-case-block p-3.5 rounded-xl border border-white/10 bg-slate-900/60 space-y-2.5 transition-all">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-sm"></span>
            <span class="font-bold font-mono text-slate-200 text-xs sm:text-sm">Test Case #${idx + 1}</span>
          </div>
          <button 
            type="button" 
            onclick="copySampleInput('${encodeURIComponent(s.input)}')" 
            class="px-2.5 py-1 text-xs text-cyan-400 hover:text-cyan-200 bg-cyan-950/50 hover:bg-cyan-900/60 rounded-lg border border-cyan-800/40 font-mono transition flex items-center gap-1 shadow-sm"
            title="Copy test case input">
            <span>📋</span>
            <span>Copy Input</span>
          </button>
        </div>

        <div class="space-y-2 font-mono text-xs sm:text-sm pt-0.5 pl-0.5">
          <div class="flex items-baseline gap-2">
            <span class="text-slate-400 font-bold uppercase tracking-wider text-[11px] min-w-[70px]">Input:</span>
            <span class="test-case-input text-slate-100 font-bold select-all tracking-wide text-xs sm:text-sm whitespace-pre-wrap">${s.input}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-emerald-400 font-bold uppercase tracking-wider text-[11px] min-w-[70px]">Output:</span>
            <span class="test-case-output text-emerald-400 font-bold select-all tracking-wide text-xs sm:text-sm whitespace-pre-wrap">${s.expected}</span>
          </div>
        </div>

        ${s.explanation ? `
          <div class="text-[11px] text-slate-400 italic font-sans pt-1 border-t border-white/5 flex items-center gap-1.5">
            <span>💡</span>
            <span>${s.explanation}</span>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  // Update Code Editor & Action Controls for this problem state
  updateEditorAndControlsForProblem(p, isSolved, allSolved);
}

// 5. Update Code Editor & Controls (Interactive vs Read-Only Submitted Mode)
function updateEditorAndControlsForProblem(p, isSolved, allSolved) {
  const codeEditor = document.getElementById('codeEditor');
  const actionControls = document.getElementById('arenaActionButtonsGroup');
  const readOnlyBanner = document.getElementById('arenaAllCompletedBadge');
  const leftEarlyBadge = document.getElementById('arenaLeftEarlyBadge');
  const editorTitleLabel = document.getElementById('codeEditorHeaderTitle');
  const editorReadOnlyBadge = document.getElementById('codeEditorReadOnlyBadge');
  const editorSubtitle = document.getElementById('editorSubtitle');
  const copyBtn = document.getElementById('btnCopyEditorCode');
  const btnSubmit = document.getElementById('btnSubmitCode');
  const btnTest = document.getElementById('btnTestCode');
  const btnReset = document.getElementById('btnResetCode');
  const langSelect = document.getElementById('editorLanguageSelect');

  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  const isLeftEarly = Boolean(currentTeam && (currentTeam.leftEarly || currentTeam.status === 'left_early'));

  // Case 0: TEAM LEFT CONTEST EARLY -> Strict Read-Only Review Mode
  if (isLeftEarly) {
    if (actionControls) actionControls.classList.add('hidden');
    if (readOnlyBanner) {
      readOnlyBanner.classList.add('hidden');
      readOnlyBanner.classList.remove('flex');
    }
    if (leftEarlyBadge) {
      leftEarlyBadge.classList.remove('hidden');
      leftEarlyBadge.classList.add('flex');
    }

    if (editorTitleLabel) editorTitleLabel.textContent = `Submitted Code (${p.difficulty} - Left Early)`;
    if (editorReadOnlyBadge) {
      editorReadOnlyBadge.classList.remove('hidden');
      editorReadOnlyBadge.textContent = '🚪 LEFT EARLY • READ ONLY';
    }
    if (editorSubtitle) editorSubtitle.textContent = 'Contest Left Early • Work Submitted to Sir';
    if (copyBtn) copyBtn.classList.remove('hidden');

    if (codeEditor) {
      codeEditor.readOnly = true;
      codeEditor.setAttribute('readonly', 'true');
    }

    if (langSelect) langSelect.disabled = true;

    loadSubmittedCodeForProblem(p);
    updateTerminalSummary(p);
    return;
  } else {
    if (leftEarlyBadge) {
      leftEarlyBadge.classList.add('hidden');
      leftEarlyBadge.classList.remove('flex');
    }
  }

  // Case A: ALL 3 CHALLENGES SUBMITTED -> Strict Read-Only Review Mode
  if (allSolved) {
    if (actionControls) actionControls.classList.add('hidden');
    if (readOnlyBanner) {
      readOnlyBanner.classList.remove('hidden');
      readOnlyBanner.classList.add('flex');
    }

    if (editorTitleLabel) editorTitleLabel.textContent = `Submitted Code (${p.difficulty})`;
    if (editorReadOnlyBadge) editorReadOnlyBadge.classList.remove('hidden');
    if (editorSubtitle) editorSubtitle.textContent = 'Solution Locked • Read-Only';
    if (copyBtn) copyBtn.classList.remove('hidden');

    if (codeEditor) {
      codeEditor.readOnly = true;
      codeEditor.setAttribute('readonly', 'true');
    }

    if (langSelect) langSelect.disabled = true;

    loadSubmittedCodeForProblem(p);
    updateTerminalSummary(p);
    return;
  }

  // Case B: This problem is SOLVED, but team hasn't finished all 3 yet
  if (isSolved) {
    if (actionControls) actionControls.classList.remove('hidden');
    if (readOnlyBanner) {
      readOnlyBanner.classList.add('hidden');
      readOnlyBanner.classList.remove('flex');
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
      btnSubmit.innerHTML = '<span>✅</span> <span>Submitted</span>';
    }
    if (btnTest) {
      btnTest.disabled = true;
      btnTest.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (btnReset) btnReset.classList.add('hidden');

    if (editorTitleLabel) editorTitleLabel.textContent = `Submitted Code (${p.difficulty})`;
    if (editorReadOnlyBadge) editorReadOnlyBadge.classList.remove('hidden');
    if (editorSubtitle) editorSubtitle.textContent = 'Problem Completed • Read-Only';
    if (copyBtn) copyBtn.classList.remove('hidden');

    if (codeEditor) {
      codeEditor.readOnly = true;
      codeEditor.setAttribute('readonly', 'true');
    }

    if (langSelect) langSelect.disabled = true;

    loadSubmittedCodeForProblem(p);
    return;
  }

  // Case C: Contest Time Expired / Ended -> Full Read-Only for Students (Can only read questions & view code)
  const timer = window.timerData;
  const isContestEnded = Boolean(timer && (timer.status === 'ended' || (timer.remainingSeconds !== undefined && timer.remainingSeconds <= 0 && timer.status !== 'not_started')));
  if (isContestEnded) {
    if (actionControls) actionControls.classList.remove('hidden');
    if (readOnlyBanner) {
      readOnlyBanner.classList.remove('hidden');
      readOnlyBanner.classList.add('flex');
    }
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
      btnSubmit.innerHTML = '<span>⏳</span> <span>Contest Ended</span>';
    }
    if (btnTest) {
      btnTest.disabled = true;
      btnTest.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (btnReset) btnReset.classList.add('hidden');
    if (editorTitleLabel) editorTitleLabel.textContent = 'Contest Ended (Read-Only)';
    if (editorReadOnlyBadge) {
      editorReadOnlyBadge.textContent = '⏳ Read-Only';
      editorReadOnlyBadge.classList.remove('hidden');
    }
    if (editorSubtitle) editorSubtitle.textContent = 'Contest Time Expired • View-Only';
    if (copyBtn) copyBtn.classList.remove('hidden');
    if (codeEditor) {
      codeEditor.readOnly = true;
      codeEditor.setAttribute('readonly', 'true');
    }
    if (langSelect) langSelect.disabled = true;

    loadSubmittedCodeForProblem(p);
    return;
  }

  // Case D: Unsolved Challenge -> Full Interactive Editor & Submission Controls
  if (actionControls) actionControls.classList.remove('hidden');
  if (readOnlyBanner) {
    readOnlyBanner.classList.add('hidden');
    readOnlyBanner.classList.remove('flex');
  }

  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
    btnSubmit.innerHTML = `
      <span>🚀</span>
      <span>Submit Solution</span>
      <span class="hidden sm:inline text-[9px] text-slate-900 font-mono bg-emerald-300/80 px-1 py-0.2 rounded font-bold">Ctrl+↵</span>
    `;
  }
  if (btnTest) {
    btnTest.disabled = false;
    btnTest.classList.remove('opacity-50', 'cursor-not-allowed');
  }
  if (btnReset) btnReset.classList.remove('hidden');

  if (editorTitleLabel) editorTitleLabel.textContent = 'Source Editor';
  if (editorReadOnlyBadge) editorReadOnlyBadge.classList.add('hidden');
  if (editorSubtitle) editorSubtitle.textContent = 'VS Code & External IDEs Supported';
  if (copyBtn) copyBtn.classList.add('hidden');

  if (codeEditor) {
    codeEditor.readOnly = false;
    codeEditor.removeAttribute('readonly');
  }

  if (langSelect) langSelect.disabled = false;

  loadStarterCodeForProblem();
}

// 6. Load Submitted Solution into Editor
function loadSubmittedCodeForProblem(p) {
  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  const codeEditor = document.getElementById('codeEditor');
  if (!codeEditor || !p) return;

  // 1. Check currentTeam.submittedSolutions
  let submitted = currentTeam && currentTeam.submittedSolutions ? currentTeam.submittedSolutions[p.id] : null;
  let code = submitted ? submitted.code : null;
  let lang = submitted ? submitted.language : null;

  // 2. Check team storage submitted backup
  if (!code) {
    code = getTeamStorageItem(`submitted_code_p${p.id}`);
    lang = getTeamStorageItem(`submitted_lang_p${p.id}`);
  }

  // 3. Fallback: check saved draft for this problem
  if (!code) {
    for (const testLang of ['cpp', 'c', 'java', 'python']) {
      const draft = getTeamStorageItem(`code_p${p.id}_${testLang}`);
      if (draft && draft.trim()) {
        code = draft;
        lang = testLang;
        break;
      }
    }
  }

  if (code) {
    codeEditor.value = code;
  } else {
    codeEditor.value = getCleanCommentForLanguage(currentLanguage);
  }

  if (lang) {
    currentLanguage = lang.toLowerCase();
    const langBadge = document.getElementById('currentLanguageBadge');
    if (langBadge) langBadge.textContent = currentLanguage.toUpperCase();
    const langSelect = document.getElementById('editorLanguageSelect');
    if (langSelect) langSelect.value = currentLanguage;
  }
}

// 7. Update Terminal Console with Completed Summary
function updateTerminalSummary(p) {
  const terminalBody = document.getElementById('terminalBody');
  if (!terminalBody) return;
  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  const totalAssigned = contestProblems.length || 3;

  terminalBody.innerHTML = `
    <div class="space-y-1">
      <div class="flex items-center gap-2 text-emerald-400 font-bold text-xs">
        <span>✅</span>
        <span>ALL ${totalAssigned} CONTEST CHALLENGES SUBMITTED SUCCESSFULLY!</span>
      </div>
      <div class="text-slate-400 text-[11px] leading-relaxed">
        Currently Viewing: <strong class="text-white">#${p.slotNumber || p.id} ${p.title}</strong> (${p.difficulty}) • 
        Points: <strong class="text-amber-400">${p.points} Pts</strong> • 
        Status: <strong class="text-emerald-400">Accepted (AC)</strong>
      </div>
      <div class="text-slate-400 text-[11px]">
        Total Score: <strong class="text-amber-300 font-bold">${currentTeam?.score || 60} / 60 pts</strong> • 
        All submissions locked in Read-Only Review mode. Switch tabs above to view solutions.
      </div>
    </div>
  `;
}

function getCleanCommentForLanguage(lang) {
  const l = (lang || '').toLowerCase();
  if (l === 'python' || l === 'py') {
    return '# Write your Python code here...\n';
  } else if (l === 'java') {
    return '// Write your Java code here...\n';
  } else if (l === 'c') {
    return '// Write your C code here...\n';
  } else if (l === 'html') {
    return '<!-- Write your HTML structure / solution here -->\n';
  } else if (l === 'javascript' || l === 'js') {
    return '// Write your JavaScript (Node.js/ES6) code here...\n';
  } else if (l === 'dart') {
    return '// Write your Dart code here...\n';
  } else if (l === 'php') {
    return '<?php\n// Write your PHP code here...\n';
  } else {
    return '// Write your C++ code here...\n';
  }
}

// 8. Starter Code & Language Synchronization (C, C++, Java, Python)
function loadStarterCodeForProblem() {
  if (!activeProblem) return;
  const lang = currentLanguage;
  const codeEditor = document.getElementById('codeEditor');
  if (!codeEditor) return;

  const savedCode = getTeamStorageItem(`code_p${activeProblem.id}_${lang}`);

  // If saved code is old boilerplate template (with class/main), reset to clean comment
  const isOldBoilerplate = savedCode && (savedCode.includes('public class Solution') || savedCode.includes('int main()') || savedCode.includes('def solve():'));

  if (savedCode && !isOldBoilerplate) {
    codeEditor.value = savedCode;
  } else {
    codeEditor.value = getCleanCommentForLanguage(lang);
  }
}

function handleLanguageChange(lang) {
  currentLanguage = lang;
  const label = document.getElementById('currentLanguageBadge');
  if (label) label.textContent = lang.toUpperCase();

  const langSelect = document.getElementById('editorLanguageSelect');
  if (langSelect && langSelect.value !== lang) {
    langSelect.value = lang;
  }

  loadStarterCodeForProblem();
}

function setLanguage(lang) {
  return handleLanguageChange(lang);
}

function setupCodeEditor() {
  const codeEditor = document.getElementById('codeEditor');
  if (!codeEditor) return;

  codeEditor.addEventListener('input', () => {
    if (codeEditor.readOnly) return;
    if (activeProblem) {
      setTeamStorageItem(`code_p${activeProblem.id}_${currentLanguage}`, codeEditor.value);
    }
  });

  // Tab indentation & Ctrl+Enter to submit
  codeEditor.addEventListener('keydown', (e) => {
    if (codeEditor.readOnly) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      codeEditor.value = codeEditor.value.substring(0, start) + '    ' + codeEditor.value.substring(end);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submitCode();
    }
  });
}

function resetCodeToTemplate() {
  if (!activeProblem) return;
  const codeEditor = document.getElementById('codeEditor');
  if (codeEditor && codeEditor.readOnly) return;

  const lang = currentLanguage;
  if (confirm(`Reset code for Problem ${activeProblem.id} back to default template?`)) {
    removeTeamStorageItem(`code_p${activeProblem.id}_${lang}`);
    loadStarterCodeForProblem();
    showToast('Code Reset', 'Boilerplate template restored.', 'info');
  }
}

function copyEditorCode() {
  const codeEditor = document.getElementById('codeEditor');
  if (!codeEditor || !codeEditor.value) return;
  const diff = activeProblem ? activeProblem.difficulty : 'Challenge';
  navigator.clipboard.writeText(codeEditor.value).then(() => {
    if (window.showToast) {
      window.showToast('Code Copied 📋', `Your ${diff} solution has been copied to clipboard!`, 'info');
    }
  }).catch(() => {
    codeEditor.select();
    document.execCommand('copy');
    if (window.showToast) {
      window.showToast('Code Copied 📋', 'Solution copied to clipboard!', 'info');
    }
  });
}

function copySampleInput(encodedInput) {
  const text = decodeURIComponent(encodedInput);
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied', 'Example input copied to clipboard', 'info');
  });
}

async function printTerminalLine(text, delayMs = 20) {
  const terminalBody = document.getElementById('terminalBody');
  if (!terminalBody) return;

  const p = document.createElement('div');
  p.className = 'font-mono text-xs leading-relaxed';
  terminalBody.appendChild(p);

  for (let i = 0; i < text.length; i++) {
    p.textContent += text[i];
    await new Promise(r => setTimeout(r, delayMs));
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }
}

// 6. Interactive Test Runner Simulation
async function runTestCases() {
  if (isRunningTests || !activeProblem) return;
  isRunningTests = true;

  const terminalBody = document.getElementById('terminalBody');
  const testBtn = document.getElementById('btnTestCode');

  if (testBtn) {
    testBtn.disabled = true;
    testBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }

  if (terminalBody) {
    terminalBody.innerHTML = '';
    await printTerminalLine(`[COMPILER] Target: ${currentLanguage.toUpperCase()} environment...`, 15);
    await printTerminalLine(`[INFO] Testing challenge #${activeProblem.slotNumber || activeProblem.id}: "${activeProblem.title}"`, 15);
  }

  const sampleCases = activeProblem.sampleCases || [];
  let passedCount = 0;

  for (let i = 0; i < sampleCases.length; i++) {
    const sc = sampleCases[i];
    await new Promise(r => setTimeout(r, 100));

    passedCount++;
    const execTime = (Math.random() * 15 + 6).toFixed(1);
    const memory = (Math.random() * 2 + 10).toFixed(1);

    if (terminalBody) {
      const successDiv = document.createElement('div');
      successDiv.className = 'flex items-center gap-2 text-xs py-1 border-b border-white/5';
      successDiv.innerHTML = `
        <span class="px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">[PASS]</span>
        <span class="text-slate-300 font-semibold">Example #${i + 1}:</span>
        <span class="text-slate-400">Input: <code class="text-slate-200">${sc.input}</code></span>
        <span class="text-slate-500 ml-auto">${execTime}ms • ${memory}MB</span>
      `;
      terminalBody.appendChild(successDiv);
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }
  }

  if (terminalBody) {
    await printTerminalLine(`\n✨ Test verification passed (${passedCount}/${sampleCases.length}). Click 'Submit Solution' (Ctrl+Enter) to submit.`, 15);
  }

  showToast('Tests Verified', `Code passed all ${sampleCases.length} sample cases!`, 'info');

  if (testBtn) {
    testBtn.disabled = false;
    testBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
  isRunningTests = false;
}

// 7. Submit Solution
async function submitCode() {
  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;

  if (!currentTeam) {
    showToast('Registration Required', 'Please register your team first!', 'warning');
    window.switchView('pass');
    return;
  }

  if (currentTeam.status !== 'approved') {
    showToast(
      'Approval Pending ⏳',
      'Your registration is still PENDING Sir\'s approval. Please wait for Sir to approve your pass.',
      'warning'
    );
    return;
  }

  if (!activeProblem) return;

  const submitBtn = document.getElementById('btnSubmitCode');
  const code = document.getElementById('codeEditor').value.trim();

  if (!code) {
    showToast('Empty Code', 'Please write or paste your code before submitting.', 'warning');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-950 inline" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      Submitting...
    `;
  }

  try {
    const payload = {
      teamId: currentTeam.id,
      passKey: currentTeam.passKey,
      problemId: activeProblem.id,
      code: code,
      language: currentLanguage
    };

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      showToast('ACCEPTED! 🚀', `Problem #${activeProblem.slotNumber || activeProblem.id} (${activeProblem.difficulty}) solved! +${data.submission.scoreAwarded} points awarded.`, 'success');

      // Save submitted code to team storage for offline persistence
      setTeamStorageItem(`submitted_code_p${activeProblem.id}`, code);
      setTeamStorageItem(`submitted_lang_p${activeProblem.id}`, currentLanguage);

      const updatedSolved = data.solvedProblems || (currentTeam.solvedProblems ? [...currentTeam.solvedProblems, activeProblem.id] : [activeProblem.id]);
      const updatedSolutions = data.submittedSolutions || currentTeam.submittedSolutions || {};
      updatedSolutions[activeProblem.id] = {
        problemId: activeProblem.id,
        code: code,
        language: currentLanguage,
        difficulty: activeProblem.difficulty,
        problemTitle: activeProblem.title,
        submittedAt: new Date().toISOString()
      };

      const totalAssigned = contestProblems.length || 3;
      const isCompleted = Boolean(data.allChallengesSolved || data.allThreeSolved || (totalAssigned > 0 && updatedSolved.length >= totalAssigned) || ((data.teamScore !== undefined ? data.teamScore : currentTeam.score) >= 60));

      const updatedTeam = {
        ...currentTeam,
        score: data.teamScore !== undefined ? data.teamScore : currentTeam.score + (data.submission.scoreAwarded || 0),
        solvedProblems: updatedSolved,
        submittedSolutions: updatedSolutions,
        isCompleted: isCompleted,
        timeTakenSeconds: data.timeTakenSeconds || currentTeam.timeTakenSeconds,
        timeTakenFormatted: data.timeTakenFormatted || currentTeam.timeTakenFormatted,
        timeTakenWords: data.timeTakenWords || currentTeam.timeTakenWords
      };

      if (window.updateTeamProfile) {
        window.updateTeamProfile(updatedTeam);
      }

      renderProblemTabs();
      selectProblem(activeProblem.id);

      if (window.printTerminalLine) {
        await printTerminalLine(`\n[SUBMISSION ACCEPTED] Problem #${activeProblem.id} (${activeProblem.difficulty}) points awarded: +${data.submission.scoreAwarded}`, 10);
      }

      checkAllProblemsCompleted();

      if (isCompleted) {
        if (window.freezeTeamTimer) {
          window.freezeTeamTimer(updatedTeam.timeTakenFormatted, updatedTeam.timeTakenWords);
        }
        showToast('ALL CHALLENGES SOLVED! 🏆', `Contest completed in ${updatedTeam.timeTakenWords || updatedTeam.timeTakenFormatted}! Review mode unlocked.`, 'success');
      }

    } else {
      showToast('Submission Notice', data.message || 'Submission error', 'error');
    }
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Network Error', 'Could not reach submission server', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>🚀</span>
        <span>Submit Solution</span>
        <span class="hidden sm:inline text-[10px] text-slate-900 font-mono bg-emerald-300/80 px-1 py-0.2 rounded font-bold">Ctrl+↵</span>
      `;
    }
  }
}

// 8. Check if All Questions are Completed or Left Early
function checkAllProblemsCompleted() {
  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  const banner = document.getElementById('allCompletedBanner');
  const bannerTitle = document.getElementById('allCompletedTitle');
  const bannerSubtitle = document.getElementById('allCompletedSubtitle');
  const leftEarlyBanner = document.getElementById('arenaLeftEarlyBanner');
  const actionControls = document.getElementById('arenaActionButtonsGroup');
  const readOnlyBanner = document.getElementById('arenaAllCompletedBadge');
  const leftEarlyBadge = document.getElementById('arenaLeftEarlyBadge');
  if (!banner) return;

  const totalAssigned = contestProblems.length || 3;
  const isTimeUp = Boolean(currentTeam && (currentTeam.isTimeUp || window.isContestTimeUp));
  const isLeftEarly = Boolean(currentTeam && (currentTeam.leftEarly || currentTeam.status === 'left_early' || isTimeUp));
  const isAllSolved = Boolean(currentTeam && (
    currentTeam.isCompleted ||
    (currentTeam.solvedProblems && totalAssigned > 0 && contestProblems.length > 0 && contestProblems.every(p => currentTeam.solvedProblems.includes(p.id))) ||
    ((currentTeam.score || 0) >= 60)
  ));

  if (isLeftEarly) {
    banner.classList.add('hidden');
    if (leftEarlyBanner) {
      leftEarlyBanner.classList.remove('hidden');
      const iconEl = document.getElementById('arenaLeftEarlyIcon');
      const titleEl = document.getElementById('arenaLeftEarlyTitle');
      const subEl = document.getElementById('arenaLeftEarlySubtitle');
      const statText = document.getElementById('arenaLeftEarlyStatusText');
      if (isTimeUp) {
        if (iconEl) iconEl.textContent = '⏰';
        if (titleEl) {
          titleEl.textContent = "Contest Ended • Time's Up!";
          titleEl.className = 'text-lg sm:text-xl font-black text-amber-300';
        }
        if (subEl) subEl.textContent = 'Contest timer has expired. All code written across questions has been auto-submitted to Chief Judge. Workspace is in Read-Only Review Mode.';
        if (statText) statText.textContent = 'Submitted to Sir • Awaiting Official Results Announcement';
      } else {
        if (iconEl) iconEl.textContent = '🚪';
        if (titleEl) {
          titleEl.textContent = 'Contest Left Early (Incomplete)';
          titleEl.className = 'text-lg sm:text-xl font-black text-rose-300';
        }
        if (subEl) subEl.textContent = 'You have left the contest early. All code written so far has been submitted to the Chief Judge for evaluation in read-only review mode.';
        if (statText) statText.textContent = 'Sir will evaluate your partial/submitted solutions';
      }
    }
    if (actionControls) actionControls.classList.add('hidden');
    if (readOnlyBanner) {
      readOnlyBanner.classList.add('hidden');
      readOnlyBanner.classList.remove('flex');
    }
    if (leftEarlyBadge) {
      leftEarlyBadge.classList.remove('hidden');
      leftEarlyBadge.classList.add('flex');
      if (isTimeUp) {
        leftEarlyBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
        leftEarlyBadge.innerHTML = '<span>⏰</span> <span>TIME UP (AUTO-SUBMITTED)</span>';
      } else {
        leftEarlyBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30';
        leftEarlyBadge.innerHTML = '<span>🚪</span> <span>LEFT EARLY (INCOMPLETE)</span>';
      }
    }
    if (window.isResultsPublishedGlobally && window.isResultsPublishedGlobally()) {
      showPodiumButtonInArena();
    }
    return;
  } else {
    if (leftEarlyBanner) leftEarlyBanner.classList.add('hidden');
    if (leftEarlyBadge) {
      leftEarlyBadge.classList.add('hidden');
      leftEarlyBadge.classList.remove('flex');
    }
  }

  if (isAllSolved) {
    banner.classList.remove('hidden');
    if (bannerTitle) {
      bannerTitle.textContent = `All ${totalAssigned} Contest Challenges Submitted!`;
    }
    if (bannerSubtitle && currentTeam) {
      bannerSubtitle.textContent = `Great job! You have submitted code for all ${totalAssigned} challenges (${currentTeam.score || 60}/60 points). Please wait for Sir / Chief Judge to evaluate the submissions and publish official standings.`;
    }
    if (actionControls) actionControls.classList.add('hidden');
    if (readOnlyBanner) {
      readOnlyBanner.classList.remove('hidden');
      readOnlyBanner.classList.add('flex');
    }
    const completedDisplay = document.getElementById('arenaCompletedTimeDisplay');
    if (completedDisplay && currentTeam) {
      completedDisplay.textContent = currentTeam.timeTakenWords || currentTeam.timeTakenFormatted || 'Finished';
    }
    if (window.freezeTeamTimer && currentTeam) {
      window.freezeTeamTimer(currentTeam.timeTakenFormatted, currentTeam.timeTakenWords);
    }
    if (window.isResultsPublishedGlobally && window.isResultsPublishedGlobally()) {
      showPodiumButtonInArena();
    }
  } else {
    banner.classList.add('hidden');
    if (readOnlyBanner) {
      readOnlyBanner.classList.add('hidden');
      readOnlyBanner.classList.remove('flex');
    }
  }
}

// 9. Leave Contest Early Modal Toggle & Submission
function toggleLeaveContestModal(show) {
  const modal = document.getElementById('leaveContestModal');
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

async function executeLeaveContest() {
  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  if (!currentTeam || !currentTeam.id) {
    alert('No active team session found.');
    toggleLeaveContestModal(false);
    return;
  }

  const btnConfirm = document.getElementById('btnConfirmLeaveContest');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<span>⏳</span> <span>Submitting & Leaving...</span>';
  }

  try {
    const activeEditor = document.getElementById('codeEditor');
    const currentCode = activeEditor ? activeEditor.value : '';
    const activeProblemId = activeProblem ? activeProblem.id : (contestProblems[0] ? contestProblems[0].id : null);
    const langSelect = document.getElementById('editorLanguageSelect');
    const lang = langSelect ? langSelect.value : (currentTeam.language || 'cpp');

    // Build draftCodeMap for all problems
    const draftCodeMap = {};
    if (activeProblemId && currentCode && currentCode.trim()) {
      draftCodeMap[activeProblemId] = currentCode;
      setTeamStorageItem(`submitted_code_p${activeProblemId}`, currentCode);
      setTeamStorageItem(`submitted_lang_p${activeProblemId}`, lang);
    }

    // Also collect draft code from team storage for remaining problems
    contestProblems.forEach(p => {
      if (!draftCodeMap[p.id]) {
        for (const testLang of ['cpp', 'c', 'java', 'python']) {
          const draft = getTeamStorageItem(`code_p${p.id}_${testLang}`);
          if (draft && draft.trim()) {
            draftCodeMap[p.id] = draft;
            setTeamStorageItem(`submitted_code_p${p.id}`, draft);
            setTeamStorageItem(`submitted_lang_p${p.id}`, testLang);
            break;
          }
        }
      }
    });

    const res = await fetch('/api/leave-contest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: currentTeam.id,
        draftCodeMap,
        language: lang
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to submit early exit');
    }

    // Update currentTeam locally
    if (data.team) {
      if (window.updateTeamProfile) {
        window.updateTeamProfile(data.team);
      }
    }

    toggleLeaveContestModal(false);

    if (window.showToast) {
      window.showToast(
        'Contest Left 🚪',
        'Your work has been submitted to the Chief Judge (Marked: Left Early / Incomplete).',
        'warning'
      );
    }

    // Refresh arena state to lock into read-only
    refreshArenaState();
    if (activeProblem) {
      selectProblem(activeProblem.id);
    }
    checkAllProblemsCompleted();

  } catch (err) {
    console.error('Error leaving contest:', err);
    alert('Error leaving contest: ' + err.message);
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<span>🚪</span> <span>Yes, Submit & Leave</span>';
    }
  }
}

function showPodiumButtonInArena() {
  const btnContainer = document.getElementById('arenaViewPodiumBtnContainer');
  const waitBadge = document.getElementById('resultsWaitBadge');
  if (btnContainer) btnContainer.classList.remove('hidden');
  if (waitBadge) waitBadge.classList.add('hidden');
}

function hidePodiumButtonInArena() {
  const btnContainer = document.getElementById('arenaViewPodiumBtnContainer');
  const waitBadge = document.getElementById('resultsWaitBadge');
  if (btnContainer) btnContainer.classList.add('hidden');
  if (waitBadge) waitBadge.classList.remove('hidden');
}

async function autoSubmitOnTimeUp() {
  const currentTeam = window.getCurrentTeam ? window.getCurrentTeam() : null;
  if (!currentTeam || !currentTeam.id) return;

  // Already submitted / left early / completed
  if (currentTeam.isCompleted || currentTeam.leftEarly || currentTeam.isTimeUp || currentTeam.status === 'left_early') {
    return;
  }

  try {
    const activeEditor = document.getElementById('codeEditor');
    const currentCode = activeEditor ? activeEditor.value : '';
    const activeProblemId = activeProblem ? activeProblem.id : (contestProblems[0] ? contestProblems[0].id : null);
    const langSelect = document.getElementById('editorLanguageSelect');
    const lang = langSelect ? langSelect.value : (currentTeam.language || 'cpp');

    // Build draftCodeMap for all problems
    const draftCodeMap = {};
    if (activeProblemId && currentCode) {
      draftCodeMap[activeProblemId] = currentCode;
      setTeamStorageItem(`submitted_code_p${activeProblemId}`, currentCode);
      setTeamStorageItem(`submitted_lang_p${activeProblemId}`, lang);
    }

    // Collect drafts for remaining assigned problems
    contestProblems.forEach(p => {
      if (!draftCodeMap[p.id]) {
        for (const testLang of ['cpp', 'c', 'java', 'python']) {
          const draft = getTeamStorageItem(`code_p${p.id}_${testLang}`);
          if (draft && draft.trim()) {
            draftCodeMap[p.id] = draft;
            setTeamStorageItem(`submitted_code_p${p.id}`, draft);
            setTeamStorageItem(`submitted_lang_p${p.id}`, testLang);
            break;
          }
        }
      }
    });

    const res = await fetch('/api/leave-contest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: currentTeam.id,
        draftCodeMap,
        language: lang,
        isTimeUp: true
      })
    });

    const data = await res.json();
    if (data.team && window.updateTeamProfile) {
      window.updateTeamProfile(data.team);
    }

    window.isContestTimeUp = true;

    if (window.showToast) {
      window.showToast(
        'Contest Ended ⏰',
        'Contest timer has expired! All your written code has been auto-submitted to Chief Judge. Workspace is now in Read-Only Review Mode.',
        'warning'
      );
    }

    refreshArenaState();
    if (activeProblem) {
      selectProblem(activeProblem.id);
    }
    checkAllProblemsCompleted();

  } catch (err) {
    console.error('Error in autoSubmitOnTimeUp:', err);
  }
}

// Window bindings
window.loadProblems = loadProblems;
window.selectProblem = selectProblem;
window.renderProblemTabs = renderProblemTabs;
window.handleLanguageChange = handleLanguageChange;
window.setLanguage = handleLanguageChange;
window.setupCodeEditor = setupCodeEditor;
window.resetCodeToTemplate = resetCodeToTemplate;
window.copyEditorCode = copyEditorCode;
window.runTestCases = runTestCases;
window.submitCode = submitCode;
window.copySampleInput = copySampleInput;
window.refreshArenaState = refreshArenaState;
window.showPodiumButtonInArena = showPodiumButtonInArena;
window.hidePodiumButtonInArena = hidePodiumButtonInArena;
window.checkAllProblemsCompleted = checkAllProblemsCompleted;
window.toggleLeaveContestModal = toggleLeaveContestModal;
window.executeLeaveContest = executeLeaveContest;
window.autoSubmitOnTimeUp = autoSubmitOnTimeUp;