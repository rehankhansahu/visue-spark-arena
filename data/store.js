// ============================================================================
// VISUE SPARK 2026 - Data Store Module
// Topics: REST APIs (L5), Socket.IO (L7), Timer State Machine, Sir Question Bank,
// Team Kickout, Results Publication, and Multi-Format Downloads
// ============================================================================

const fs = require('fs');
const path = require('path');

// Question Bank: Initialized empty (Sir configures and adds questions from Sir Desk)
let questionBank = [];

// Active Contest Question IDs (Must sum up to exactly 60 points)
let activeContestQuestionIds = [];

// Active Global Problem Slots for backwards compatibility
let activeGlobalSlots = {
  easyId: null,
  mediumId: null,
  hardId: null
};

// Question Distribution Mode: 'same' vs 'different'
let questionMode = 'same';
const teamSpecificQuestions = new Map(); // teamId -> array of question IDs

// Contest Timer State Machine
let contestDurationMinutes = 90;
let totalDurationSeconds = contestDurationMinutes * 60;
let timerStatus = 'not_started'; // 'not_started' | 'running' | 'paused' | 'ended'
let timerStartTime = null;
let elapsedBeforePause = 0;

// Results Publication Flag: Podium is masked/empty until Sir publishes official marks!
let resultsPublished = false;

// Active Judge Session State (Option A: Single-Judge Strict Lock)
let activeJudgeSession = null;
const JUDGE_SESSION_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes auto-timeout if judge is idle

// Archived Podium / Leaderboard to retain previous contest winners after reset
let archivedLeaderboard = [];
let archivedPodium = [];
let archivedAt = null;
let archivedContestPoints = 60;

// In-Memory Database Collections (Clean initial state - No default dummy teams)
const teams = new Map();
let submissions = [];

// Store methods
const store = {
  // =========================================================================
  // 1. TIMER STATE MACHINE (Controlled by Sir / Judge)
  // Requirements: Timer does NOT run at start, and cannot be started until
  // questions are ready AND at least one team is approved by Sir!
  // =========================================================================
  getContestTimer() {
    const approvedCount = this.getApprovedTeams().length;
    const totalContestPoints = this.getActiveContestPoints();
    const readyCheck = this.checkAllApprovedTeamsHaveAssignedQuestions();
    const questionsReady = readyCheck.ready;
    const canStart = readyCheck.ready;

    let currentElapsed = elapsedBeforePause;
    if (timerStatus === 'running' && timerStartTime) {
      currentElapsed += Math.floor((Date.now() - timerStartTime) / 1000);
    }
    const remaining = Math.max(0, totalDurationSeconds - currentElapsed);

    if (remaining <= 0 && timerStatus === 'running') {
      timerStatus = 'ended';
    }

    return {
      status: timerStatus, // 'not_started' | 'running' | 'paused' | 'ended'
      durationMinutes: contestDurationMinutes,
      totalSeconds: totalDurationSeconds,
      remainingSeconds: remaining,
      isExpired: remaining <= 0,
      approvedTeamsCount: approvedCount,
      totalContestPoints: totalContestPoints,
      questionsReady: questionsReady,
      canStart: canStart,
      timerVisible: true
    };
  },

  setContestDuration(minutes) {
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins <= 0 || mins > 300) {
      throw new Error('Valid duration (1 to 300 minutes) required.');
    }
    contestDurationMinutes = mins;
    totalDurationSeconds = mins * 60;

    // If not started, reset elapsed time
    if (timerStatus === 'not_started') {
      elapsedBeforePause = 0;
      timerStartTime = null;
    }
    return this.getContestTimer();
  },

  checkAllApprovedTeamsHaveAssignedQuestions() {
    const approvedTeams = this.getApprovedTeams();
    if (approvedTeams.length === 0) {
      return { ready: false, message: 'Please approve at least one team before starting the contest timer.' };
    }

    for (const team of approvedTeams) {
      const problems = this.getProblemsForTeam(team.id);
      const points = (problems || []).reduce((sum, p) => sum + (p.points || 0), 0);
      const langUpper = (team.language || 'cpp').toUpperCase();

      if (points !== 60) {
        return {
          ready: false,
          team: team,
          message: `Cannot start contest! Team "${team.teamName}" only has ${points}/60 points assigned in ${langUpper}. Sir must assign exactly 60 points of ${langUpper} questions to ALL approved teams before starting.`
        };
      }

      // Check language compatibility for each problem
      const incompatible = (problems || []).filter(p => !this.doesQuestionMatchLanguage(p, team.language));
      if (incompatible.length > 0) {
        return {
          ready: false,
          team: team,
          message: `Cannot start contest! Team "${team.teamName}" has questions assigned that do not support their registered language (${langUpper}).`
        };
      }
    }

    return { ready: true };
  },

  startTimer() {
    const readyCheck = this.checkAllApprovedTeamsHaveAssignedQuestions();
    if (!readyCheck.ready) {
      throw new Error(readyCheck.message);
    }

    if (timerStatus === 'running') return this.getContestTimer();
    timerStartTime = Date.now();
    timerStatus = 'running';
    return this.getContestTimer();
  },

  pauseTimer() {
    if (timerStatus === 'running' && timerStartTime) {
      elapsedBeforePause += Math.floor((Date.now() - timerStartTime) / 1000);
      timerStartTime = null;
      timerStatus = 'paused';
    }
    return this.getContestTimer();
  },

  resetTimer() {
    timerStatus = 'not_started';
    timerStartTime = null;
    elapsedBeforePause = 0;
    return this.getContestTimer();
  },

  resetContestFull() {
    // 1. Preserve current evaluated standings as archived podium so users can still view previous winners
    try {
      const currentLeaderboard = this.getLeaderboard(true);
      if (currentLeaderboard.leaderboard && currentLeaderboard.leaderboard.length > 0) {
        // Only archive if there were teams with scores or if results were published
        const hasScores = currentLeaderboard.leaderboard.some(t => t.score > 0 || (t.solvedProblems && t.solvedProblems.length > 0));
        if (hasScores || resultsPublished) {
          archivedLeaderboard = JSON.parse(JSON.stringify(currentLeaderboard.leaderboard));
          archivedPodium = JSON.parse(JSON.stringify(currentLeaderboard.leaderboard.slice(0, 3)));
          archivedAt = new Date().toISOString();
          archivedContestPoints = this.getTotalContestPoints() || 60;
        }
      }
    } catch (e) {
      console.error('[Store] Error archiving leaderboard during reset:', e);
    }

    timerStatus = 'not_started';
    timerStartTime = null;
    elapsedBeforePause = 0;
    resultsPublished = false;
    teams.clear();
    submissions.length = 0;
    teamSpecificQuestions.clear();
    questionBank = [];
    activeContestQuestionIds = [];
    activeGlobalSlots = { easyId: null, mediumId: null, hardId: null };
    return {
      timer: this.getContestTimer(),
      teamsCount: 0,
      submissionsCount: 0,
      questionsCount: 0,
      hasArchivedPodium: archivedLeaderboard.length > 0,
      archivedPodium: archivedPodium
    };
  },

  // 100% Full Contest Reset: Completely wipes teams, submissions, timer, questions AND podium archive
  resetContestWipeAll() {
    timerStatus = 'not_started';
    timerStartTime = null;
    elapsedBeforePause = 0;
    resultsPublished = false;
    teams.clear();
    submissions.length = 0;
    teamSpecificQuestions.clear();
    questionBank = [];
    activeContestQuestionIds = [];
    activeGlobalSlots = { easyId: null, mediumId: null, hardId: null };
    archivedLeaderboard = [];
    archivedPodium = [];
    archivedAt = null;
    archivedContestPoints = 60;
    return {
      timer: this.getContestTimer(),
      teamsCount: 0,
      submissionsCount: 0,
      questionsCount: 0,
      hasArchivedPodium: false,
      archivedPodium: []
    };
  },

  getArchivedLeaderboard() {
    return archivedLeaderboard;
  },

  getArchivedPodium() {
    return archivedPodium;
  },

  getArchivedAt() {
    return archivedAt;
  },

  hasArchivedPodium() {
    return archivedLeaderboard.length > 0;
  },

  getCurrentContestElapsedSeconds() {
    let currentElapsed = elapsedBeforePause;
    if (timerStatus === 'running' && timerStartTime) {
      currentElapsed += Math.floor((Date.now() - timerStartTime) / 1000);
    }
    return Math.min(currentElapsed, totalDurationSeconds);
  },

  formatDurationSeconds(sec) {
    if (!sec || sec < 0) return '00:00';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  formatDurationWords(sec) {
    if (!sec || sec < 0) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${s}s`;
    }
    if (mins === 0) return `${s}s`;
    return `${mins}m ${s}s`;
  },

  // =========================================================================
  // =========================================================================
  // 2. QUESTION BANK & DYNAMIC 60-POINT CONTEST ASSIGNMENT (Sir's Superpower)
  // Strict rule: Active contest challenges must sum to at most/exactly 60 points!
  // =========================================================================
  getQuestionBank() {
    return questionBank;
  },

  getQuestionById(id) {
    const numId = parseInt(id, 10);
    return questionBank.find(p => p.id === numId) || null;
  },

  getActiveContestQuestionIds() {
    return [...activeContestQuestionIds];
  },

  getActiveContestQuestions() {
    return activeContestQuestionIds.map(id => this.getQuestionById(id)).filter(Boolean);
  },

  doesQuestionMatchLanguage(question, teamLang) {
    if (!teamLang) return true;
    if (!question) return false;
    const qLangs = (question.languages && Array.isArray(question.languages) && question.languages.length > 0)
      ? question.languages
      : ['C', 'C++', 'Java', 'Python'];

    const cleanTeamLang = teamLang.toLowerCase().trim();
    const aliasMap = {
      'c': ['c'],
      'cpp': ['c++', 'cpp'],
      'c++': ['c++', 'cpp'],
      'java': ['java'],
      'python': ['python', 'py'],
      'py': ['python', 'py']
    };

    const accepted = aliasMap[cleanTeamLang] || [cleanTeamLang];

    return qLangs.some(lang => {
      const cleanL = (lang || '').toLowerCase().trim();
      if (cleanL === 'all' || cleanL === 'all languages') return true;
      return accepted.includes(cleanL);
    });
  },

  getActiveContestPointsForLang(track) {
    const questions = this.getActiveContestQuestions();
    const matching = questions.filter(q => this.doesQuestionMatchLanguage(q, track));
    return matching.reduce((sum, q) => sum + (q.points || 0), 0);
  },

  getActiveContestPoints() {
    const questions = this.getActiveContestQuestions();
    const allTracks = ['c', 'cpp', 'java', 'python'];
    const trackPoints = allTracks.map(t => this.getActiveContestPointsForLang(t));
    const maxTrack = Math.max(...trackPoints, 0);
    return maxTrack > 0 ? maxTrack : questions.reduce((sum, q) => sum + (q.points || 0), 0);
  },

  getActiveGlobalSlots() {
    const easyQ = activeContestQuestionIds.map(id => this.getQuestionById(id)).find(q => q && q.difficulty === 'Easy') || (activeGlobalSlots.easyId ? this.getQuestionById(activeGlobalSlots.easyId) : null);
    const medQ = activeContestQuestionIds.map(id => this.getQuestionById(id)).find(q => q && q.difficulty === 'Medium') || (activeGlobalSlots.mediumId ? this.getQuestionById(activeGlobalSlots.mediumId) : null);
    const hardQ = activeContestQuestionIds.map(id => this.getQuestionById(id)).find(q => q && q.difficulty === 'Hard') || (activeGlobalSlots.hardId ? this.getQuestionById(activeGlobalSlots.hardId) : null);

    return {
      easyId: easyQ ? easyQ.id : null,
      mediumId: medQ ? medQ.id : null,
      hardId: hardQ ? hardQ.id : null,
      easy: easyQ,
      medium: medQ,
      hard: hardQ,
      activeIds: [...activeContestQuestionIds],
      totalPoints: this.getActiveContestPoints()
    };
  },

  getQuestionMode() {
    return questionMode;
  },

  doesQuestionSupportAllLanguages(q) {
    if (!q) return false;
    if (!q.languages || !Array.isArray(q.languages) || q.languages.length === 0) return true;
    const lower = q.languages.map(l => (l || '').toLowerCase().trim());
    if (lower.includes('all') || lower.includes('all languages')) return true;
    const hasC = lower.includes('c');
    const hasCpp = lower.includes('cpp') || lower.includes('c++');
    const hasJava = lower.includes('java');
    const hasPy = lower.includes('python') || lower.includes('py');
    return hasC && hasCpp && hasJava && hasPy;
  },

  canUseSameModeForAllTeams() {
    const activeQuestions = this.getActiveContestQuestions();
    for (const q of activeQuestions) {
      if (!this.doesQuestionSupportAllLanguages(q)) {
        const langs = (q.languages && q.languages.length > 0) ? q.languages.join(', ') : 'specific language';
        return {
          allowed: false,
          question: q,
          message: `Cannot use "Same for All Teams": Question #${q.id} ("${q.title}") only supports [${langs}]. "Same for All Teams" requires all active questions to support ALL languages (C, C++, Java, Python). Please switch to "Custom per Team" to assign language-specific questions to each team.`
        };
      }
    }
    return { allowed: true };
  },

  setQuestionMode(mode) {
    if (mode === 'same') {
      const check = this.canUseSameModeForAllTeams();
      if (!check.allowed) {
        throw new Error(check.message);
      }
      questionMode = 'same';
    } else {
      questionMode = 'different';
    }
    return questionMode;
  },

  // Toggle a question in or out of the contest with strict 60 points validation
  toggleContestQuestion(questionId, forceAddOrRemove = null) {
    const qId = parseInt(questionId, 10);
    const q = this.getQuestionById(qId);
    if (!q) throw new Error(`Question #${questionId} not found in Question Bank.`);

    const existingIndex = activeContestQuestionIds.indexOf(qId);
    const shouldRemove = forceAddOrRemove === false || forceAddOrRemove === 'remove' || (forceAddOrRemove === null && existingIndex !== -1);

    if (shouldRemove) {
      if (existingIndex !== -1) {
        activeContestQuestionIds.splice(existingIndex, 1);
      }
    } else {
      if (existingIndex === -1) {
        if (questionMode === 'same' && !this.doesQuestionSupportAllLanguages(q)) {
          const langs = (q.languages && q.languages.length > 0) ? q.languages.join(', ') : 'specific language';
          throw new Error(`Cannot add Question #${q.id} ("${q.title}") in "Same for All Teams" mode because it only supports [${langs}]. "Same for All Teams" requires questions to support ALL languages (C, C++, Java, Python). Please switch distribution mode to "Custom per Team" to assign it.`);
        }

        // Validate that for any language track this question supports, it doesn't exceed 60 points
        const allTracks = ['c', 'cpp', 'java', 'python'];
        for (const track of allTracks) {
          if (this.doesQuestionMatchLanguage(q, track)) {
            const trackPoints = this.getActiveContestPointsForLang(track);
            const newTrackTotal = trackPoints + (q.points || 10);
            if (newTrackTotal > 60) {
              const trackName = track === 'cpp' ? 'C++' : track.toUpperCase();
              throw new Error(`Total contest points for ${trackName} cannot exceed 60 points! Current: ${trackPoints}/60 pts. Adding #${q.id} "${q.title}" (${q.points} pts) would exceed 60 points (Total: ${newTrackTotal} pts). Please remove a question first.`);
            }
          }
        }
        activeContestQuestionIds.push(qId);
      }
    }

    // Keep activeGlobalSlots in sync for legacy references
    this.syncGlobalSlots();

    const totalPts = this.getActiveContestPoints();
    return {
      activeIds: [...activeContestQuestionIds],
      activeQuestions: this.getActiveContestQuestions(),
      totalPoints: totalPts,
      isReady: (totalPts === 60)
    };
  },

  // Set contest questions array directly with strict 60-point cap
  setContestQuestions(ids) {
    if (!Array.isArray(ids)) throw new Error('Question IDs must be an array.');
    const uniqueIds = Array.from(new Set(ids.map(Number))).filter(id => !isNaN(id) && id > 0);
    
    let sum = 0;
    const validatedQuestions = [];
    for (const id of uniqueIds) {
      const q = this.getQuestionById(id);
      if (!q) throw new Error(`Question #${id} not found in Question Bank.`);
      if (questionMode === 'same' && !this.doesQuestionSupportAllLanguages(q)) {
        const langs = (q.languages && q.languages.length > 0) ? q.languages.join(', ') : 'specific language';
        throw new Error(`Cannot assign Question #${q.id} ("${q.title}") in "Same for All Teams" mode because it only supports [${langs}]. All questions in "Same for All Teams" must support ALL languages (C, C++, Java, Python).`);
      }
      sum += (q.points || 0);
      validatedQuestions.push(q);
    }

    if (sum > 60) {
      throw new Error(`Total contest points cannot exceed 60 points! Selected questions sum to ${sum} points. Maximum allowed is 60 points.`);
    }

    activeContestQuestionIds = uniqueIds;
    this.syncGlobalSlots();

    return {
      activeIds: [...activeContestQuestionIds],
      activeQuestions: validatedQuestions,
      totalPoints: sum,
      isReady: (sum === 60)
    };
  },

  // 1-Click Standard Preset for Sir (1 Easy + 1 Medium + 1 Hard = 60 pts)
  applyContestPreset(presetName = 'standard') {
    const easyQ = questionBank.find(q => q.difficulty === 'Easy' || q.points === 10);
    const medQ = questionBank.find(q => q.difficulty === 'Medium' || q.points === 20);
    const hardQ = questionBank.find(q => q.difficulty === 'Hard' || q.points === 30);

    if (!easyQ || !medQ || !hardQ) {
      throw new Error('Standard preset requires at least 1 Easy (10p), 1 Medium (20p), and 1 Hard (30p) in the Question Bank. Please add them first.');
    }

    return this.setContestQuestions([easyQ.id, medQ.id, hardQ.id]);
  },

  syncGlobalSlots() {
    const easyQ = activeContestQuestionIds.map(id => this.getQuestionById(id)).find(q => q && q.difficulty === 'Easy');
    const medQ = activeContestQuestionIds.map(id => this.getQuestionById(id)).find(q => q && q.difficulty === 'Medium');
    const hardQ = activeContestQuestionIds.map(id => this.getQuestionById(id)).find(q => q && q.difficulty === 'Hard');
    activeGlobalSlots.easyId = easyQ ? easyQ.id : null;
    activeGlobalSlots.mediumId = medQ ? medQ.id : null;
    activeGlobalSlots.hardId = hardQ ? hardQ.id : null;
  },

  assignGlobalSlot(slot, questionId) {
    const q = this.getQuestionById(questionId);
    if (!q) throw new Error(`Question #${questionId} not found in Question Bank.`);

    const qId = q.id;
    // If already in activeContestQuestionIds, keep it
    if (!activeContestQuestionIds.includes(qId)) {
      const currentPts = this.getActiveContestPoints();
      if (currentPts + q.points > 60) {
        throw new Error(`Total contest points cannot exceed 60 points! Currently at ${currentPts}/60 pts. Cannot add #${q.id} (${q.points} pts).`);
      }
      activeContestQuestionIds.push(qId);
    }

    if (slot === 'easy') activeGlobalSlots.easyId = q.id;
    else if (slot === 'medium') activeGlobalSlots.mediumId = q.id;
    else if (slot === 'hard') activeGlobalSlots.hardId = q.id;

    return this.getActiveGlobalSlots();
  },

  getTeamQuestions(teamId) {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);
    const qIds = teamSpecificQuestions.get(teamId) || [];
    const questions = qIds.map(id => this.getQuestionById(id)).filter(Boolean);
    const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
    return {
      team: {
        id: team.id,
        teamName: team.teamName,
        university: team.university,
        language: team.language,
        rollNo: team.rollNo,
        passKey: team.passKey
      },
      questionIds: qIds,
      questions: questions,
      totalPoints: totalPoints,
      isReady: (totalPoints === 60)
    };
  },

  setTeamQuestionsDirect(teamId, questionIds) {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);
    if (!Array.isArray(questionIds)) throw new Error('Question IDs must be an array.');

    const uniqueIds = Array.from(new Set(questionIds.map(Number))).filter(id => !isNaN(id) && id > 0);
    let total = 0;
    const validated = [];

    for (const qId of uniqueIds) {
      const q = this.getQuestionById(qId);
      if (!q) throw new Error(`Question #${qId} not found in Question Bank.`);
      if (!this.doesQuestionMatchLanguage(q, team.language)) {
        const langName = team.language ? team.language.toUpperCase() : 'selected language';
        throw new Error(`Question #${q.id} ("${q.title}") does not match ${team.teamName}'s registered language (${langName}). Only ${langName} questions can be assigned.`);
      }
      total += (q.points || 0);
      validated.push(q);
    }

    if (total > 60) {
      throw new Error(`Total assigned points cannot exceed 60 points! Selected questions sum to ${total} points.`);
    }

    teamSpecificQuestions.set(teamId, uniqueIds);
    questionMode = 'different';

    return {
      teamId,
      questionIds: uniqueIds,
      questions: validated,
      totalPoints: total,
      isReady: (total === 60)
    };
  },

  autoAssignTeamPreset(teamId, presetName = 'standard') {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);

    const matchingQs = questionBank.filter(q => this.doesQuestionMatchLanguage(q, team.language));
    const easyQ = matchingQs.find(q => q.difficulty === 'Easy' || q.points === 10);
    const medQ = matchingQs.find(q => q.difficulty === 'Medium' || q.points === 20);
    const hardQ = matchingQs.find(q => q.difficulty === 'Hard' || q.points === 30);

    if (!easyQ || !medQ || !hardQ) {
      const langName = team.language ? team.language.toUpperCase() : 'selected language';
      throw new Error(`Standard preset requires at least 1 Easy (10p), 1 Medium (20p), and 1 Hard (30p) matching ${langName}. Please add them via "Add Question to Bank" first.`);
    }

    return this.setTeamQuestionsDirect(teamId, [easyQ.id, medQ.id, hardQ.id]);
  },

  assignTeamQuestion(teamId, slot, questionId) {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);
    const q = this.getQuestionById(questionId);
    if (!q) throw new Error(`Question #${questionId} not found in Question Bank.`);

    let current = teamSpecificQuestions.get(teamId) || [...activeContestQuestionIds];
    if (!Array.isArray(current)) current = [...activeContestQuestionIds];

    if (!current.includes(q.id)) {
      current.push(q.id);
    }
    teamSpecificQuestions.set(teamId, current);
    return current;
  },

  // Returns active problems (dynamically scaled for N questions totaling 60 points)
  getProblemsForTeam(teamId = null) {
    let qIds = [...activeContestQuestionIds];
    let team = null;

    if (teamId) {
      team = this.getTeamById(teamId) || this.getTeamByPassKey(teamId) || this.getTeamByRoll(teamId);
    }

    if (questionMode === 'different' && team && teamSpecificQuestions.has(team.id)) {
      const custom = teamSpecificQuestions.get(team.id);
      if (Array.isArray(custom) && custom.length > 0) {
        qIds = custom;
      }
    }

    const allProblems = [];
    qIds.forEach((id) => {
      const q = this.getQuestionById(id);
      if (q) {
        allProblems.push({ ...q });
      }
    });

    // If team has a registered language, filter questions so ONLY questions matching their language are shown!
    let matchingProblems = allProblems;
    if (team && team.language) {
      matchingProblems = allProblems.filter(q => this.doesQuestionMatchLanguage(q, team.language));

      // Fallback: if active questions didn't match (e.g. Sir only added language-specific questions in questionBank)
      if (matchingProblems.length === 0) {
        const bankMatching = questionBank.filter(q => this.doesQuestionMatchLanguage(q, team.language));
        if (bankMatching.length > 0) {
          matchingProblems = bankMatching.slice(0, 3).map(q => ({ ...q }));
        }
      }
    }

    // Sort strictly in difficulty sequence: Easy (10p, #1) -> Medium (20p, #2) -> Hard (30p, #3)
    function getDiffRank(p) {
      const d = (p.difficulty || '').toLowerCase();
      const pts = parseInt(p.points, 10) || 0;
      if (d === 'easy' || pts === 10) return 1;
      if (d === 'medium' || pts === 20) return 2;
      if (d === 'hard' || pts === 30) return 3;
      return 4;
    }
    matchingProblems.sort((a, b) => {
      const rA = getDiffRank(a);
      const rB = getDiffRank(b);
      if (rA !== rB) return rA - rB;
      return (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
    });

    return matchingProblems.map((p, index) => ({
      ...p,
      slotNumber: index + 1
    }));
  },

  // Sir adds a brand new question to the bank
  addQuestionToBank(questionData) {
    const newId = questionBank.length > 0 ? Math.max(...questionBank.map(q => q.id)) + 1 : 1;
    const diff = questionData.difficulty || 'Easy';
    const points = parseInt(questionData.points, 10) || (diff === 'Easy' ? 10 : (diff === 'Medium' ? 20 : 30));

    let selectedLangs = ['C', 'C++', 'Java', 'Python'];
    if (Array.isArray(questionData.languages) && questionData.languages.length > 0) {
      selectedLangs = questionData.languages;
    } else if (typeof questionData.languages === 'string' && questionData.languages.trim()) {
      selectedLangs = [questionData.languages.trim()];
    }

    const newQuestion = {
      id: newId,
      title: questionData.title.trim(),
      difficulty: diff,
      points: points,
      timeLimit: questionData.timeLimit || "1.5s",
      memoryLimit: questionData.memoryLimit || "256MB",
      tags: questionData.tags || ["Algorithm", "Logic"],
      description: questionData.description.trim(),
      inputFormat: questionData.inputFormat || "Standard Input",
      outputFormat: questionData.outputFormat || "Standard Output",
      constraints: questionData.constraints || ["1 <= N <= 10^5"],
      sampleCases: questionData.sampleCases || [
        { input: "Sample input", expected: "Sample output", explanation: "Sample demonstration" }
      ],
      starterCode: questionData.starterCode || {
        c: `// Write your C code here...\n`,
        cpp: `// Write your C++ code here...\n`,
        java: `// Write your Java code here...\n`,
        python: `# Write your Python code here...\n`
      },
      languages: selectedLangs
    };

    questionBank.push(newQuestion);

    // If budget allows for each track this question supports, auto-add
    let canAutoAdd = true;
    for (const track of ['c', 'cpp', 'java', 'python']) {
      if (this.doesQuestionMatchLanguage(newQuestion, track)) {
        if (this.getActiveContestPointsForLang(track) + newQuestion.points > 60) {
          canAutoAdd = false;
          break;
        }
      }
    }

    if (canAutoAdd) {
      activeContestQuestionIds.push(newQuestion.id);
      this.syncGlobalSlots();
    }

    return newQuestion;
  },

  removeQuestionFromBank(id) {
    const numId = parseInt(id, 10);
    const idx = questionBank.findIndex(q => q.id === numId);
    if (idx !== -1) {
      questionBank.splice(idx, 1);
    }
    activeContestQuestionIds = activeContestQuestionIds.filter(qId => qId !== numId);
    for (const [teamId, qIds] of teamSpecificQuestions.entries()) {
      teamSpecificQuestions.set(teamId, qIds.filter(qId => qId !== numId));
    }
    this.syncGlobalSlots();
    return { success: true, removedId: numId };
  },

  getProblems() {
    return this.getProblemsForTeam(null);
  },

  getProblemById(id) {
    return this.getQuestionById(id);
  },

  // =========================================================================
  // 3. TEAM REGISTRATION, APPROVAL, AND KICKOUT
  // =========================================================================
  registerTeam({ teamType, teamName, leaderName, leaderRoll, member2Name, member2Roll, university, language, secretKey, profilePic }) {
    const timer = this.getContestTimer();
    if (timer && timer.status && timer.status !== 'not_started') {
      throw new Error('Registration Closed: The contest is currently in progress or has ended. Sir / Chief Judge must reset the previous contest before new registrations can be accepted.');
    }

    const formattedRoll = (leaderRoll || '').trim();
    const leaderLower = formattedRoll.toLowerCase();
    const member2Lower = (member2Roll || '').trim().toLowerCase();
    let cleanPin = (secretKey || '').trim();

    // Check if team with same leader or member roll already exists in ACTIVE teams
    for (const [id, t] of teams.entries()) {
      const isInactive = (t.status === 'rejected' || t.status === 'kicked_out' || t.status === 'disqualified' || t.status === 'deleted');
      if (isInactive) {
        // Clean up any stale inactive record matching this roll or PIN
        const matchRoll = (t.leaderRoll && t.leaderRoll.toLowerCase() === leaderLower) ||
          (t.member2Roll && t.member2Roll.toLowerCase() === leaderLower) ||
          (member2Lower && t.leaderRoll && t.leaderRoll.toLowerCase() === member2Lower) ||
          (member2Lower && t.member2Roll && t.member2Roll.toLowerCase() === member2Lower);
        const matchPin = cleanPin && (String(t.passKey).trim() === cleanPin || String(t.secretKey).trim() === cleanPin);

        if (matchRoll || matchPin) {
          teams.delete(id);
          teamSpecificQuestions.delete(id);
        }
        continue;
      }

      const tLeader = (t.leaderRoll || '').toLowerCase();
      const tMember2 = (t.member2Roll || '').toLowerCase();

      if (tLeader === leaderLower || (member2Lower && tLeader === member2Lower) ||
          (tMember2 && tMember2 === leaderLower) || (tMember2 && member2Lower && tMember2 === member2Lower)) {
        throw new Error(`Roll Number "${formattedRoll}" is already registered (Team: "${t.teamName}"). If this is your team, please enter your 6-digit Secret Key in the "Resume Session" box below to log in.`);
      }
    }

    // If no 6-digit pin provided, generate a unique 6-digit random number
    if (!cleanPin || !/^\d{6}$/.test(cleanPin)) {
      cleanPin = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Check if 6-digit PIN is already taken by another ACTIVE team
    for (const t of teams.values()) {
      const isInactive = (t.status === 'rejected' || t.status === 'kicked_out' || t.status === 'disqualified' || t.status === 'deleted');
      if (isInactive) continue;
      if (String(t.passKey).trim() === cleanPin || String(t.secretKey).trim() === cleanPin) {
        throw new Error(`The 6-digit Secret Key "${cleanPin}" is already taken by another active team. Please choose a different 6-digit key (e.g. 654321).`);
      }
    }

    const teamId = `TEAM-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
    const passKey = cleanPin;

    const newTeam = {
      id: teamId,
      teamType: teamType === 'duo' ? 'duo' : 'solo',
      teamName: (teamName || `${leaderName}'s Team`).trim(),
      leaderName: leaderName.trim(),
      leaderRoll: formattedRoll,
      member2Name: teamType === 'duo' ? (member2Name || '').trim() : '',
      member2Roll: teamType === 'duo' ? (member2Roll || '').trim() : '',
      university: (university || 'University').trim(),
      language: (language || 'cpp').toLowerCase(),
      profilePic: profilePic || null,
      status: 'pending', // Pending Admin (Sir) Approval!
      score: 0,
      solvedProblems: [],
      submittedSolutions: {},
      isCompleted: false,
      finishedAt: null,
      timeTakenSeconds: null,
      timeTakenFormatted: null,
      timeTakenWords: null,
      leftEarly: false,
      leftAt: null,
      bonusMarks: 0,
      registeredAt: new Date().toISOString(),
      approvedAt: null,
      passKey: passKey,
      secretKey: passKey
    };

    teams.set(teamId, newTeam);
    return { isNew: true, team: newTeam };
  },

  approveTeam(teamId) {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);
    team.status = 'approved';
    team.approvedAt = new Date().toISOString();
    return team;
  },

  rejectTeam(teamId) {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);
    team.status = 'rejected';
    teams.delete(teamId);
    teamSpecificQuestions.delete(teamId);
    submissions = submissions.filter(s => s.teamId !== teamId);
    return team;
  },

  // Sir's Kickout / Disqualify / Remove action
  kickoutTeam(teamId) {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);
    team.status = 'kicked_out';
    teams.delete(teamId);
    teamSpecificQuestions.delete(teamId);
    submissions = submissions.filter(s => s.teamId !== teamId);
    return team;
  },

  deleteTeam(teamId) {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);
    team.status = 'deleted';
    teams.delete(teamId);
    teamSpecificQuestions.delete(teamId);
    submissions = submissions.filter(s => s.teamId !== teamId);
    return team;
  },

  getTeamById(teamId) {
    if (!teamId) return null;
    const clean = String(teamId).trim();
    if (teams.has(clean)) return teams.get(clean);
    for (const t of teams.values()) {
      if (t.id && t.id.toLowerCase() === clean.toLowerCase()) return t;
    }
    return null;
  },

  getTeamByPassKey(passKey) {
    if (!passKey) return null;
    const cleanKey = String(passKey).trim().toUpperCase();
    for (const t of teams.values()) {
      if (t.status === 'rejected' || t.status === 'kicked_out' || t.status === 'deleted') continue;
      if ((t.passKey && String(t.passKey).trim().toUpperCase() === cleanKey) || 
          (t.secretKey && String(t.secretKey).trim().toUpperCase() === cleanKey)) return t;
    }
    return null;
  },

  getTeamByRoll(rollNo) {
    if (!rollNo) return null;
    const clean = String(rollNo).trim().toLowerCase();
    for (const t of teams.values()) {
      if (t.status === 'rejected' || t.status === 'kicked_out' || t.status === 'deleted') continue;
      if ((t.leaderRoll && String(t.leaderRoll).trim().toLowerCase() === clean) || 
          (t.member2Roll && String(t.member2Roll).trim().toLowerCase() === clean)) {
        return t;
      }
    }
    return null;
  },

  getAllTeams() {
    return Array.from(teams.values());
  },

  getPendingTeams() {
    return Array.from(teams.values()).filter(t => t.status === 'pending');
  },

  getApprovedTeams() {
    const totalContestPts = this.getTotalContestPoints();
    const activeQuestions = this.getActiveContestQuestions();
    return Array.from(teams.values()).filter(t => t.status === 'approved' || t.status === 'left_early' || t.leftEarly).map(t => {
      const assigned = this.getProblemsForTeam(t.id);
      return {
        ...t,
        totalContestPoints: totalContestPts,
        assignedProblems: assigned,
        totalAssignedCount: assigned.length || activeQuestions.length
      };
    });
  },

  // =========================================================================
  // 4. SUBMISSIONS & CODE INSPECTION
  // =========================================================================
  addSubmission({ teamId, problemId, code, language, status = 'AC' }) {
    let team = this.getTeamById(teamId) || this.getTeamByRoll(teamId);
    if (!team) throw new Error('Team/Student record not found. Please register first.');

    if (team.status === 'kicked_out') {
      throw new Error('Your team has been removed/kicked out by Sir/Judge.');
    }

    if (team.status !== 'approved') {
      throw new Error('Your registration request is still PENDING Sir\'s approval. Please wait for approval.');
    }

    // Guard: Sir must have assigned questions totaling exactly 60 points
    const assignedProblems = this.getProblemsForTeam(team.id);
    const totalAssignedPoints = (assignedProblems || []).reduce((s, p) => s + (p.points || 0), 0);
    if (!assignedProblems || assignedProblems.length === 0 || totalAssignedPoints !== 60) {
      throw new Error(`Contest Arena is locked: Contest questions must total exactly 60 points (Current: ${totalAssignedPoints}/60 pts) before submissions can begin.`);
    }

    const problem = this.getQuestionById(problemId);
    if (!problem) throw new Error(`Problem ID ${problemId} does not exist in Question Bank.`);

    const numProblemId = parseInt(problemId, 10);
    let scoreAwarded = 0;

    // Check if not already solved, award points
    if (!team.solvedProblems.includes(numProblemId)) {
      team.solvedProblems.push(numProblemId);
      scoreAwarded = problem.points || 10;
      team.score += scoreAwarded;
    }

    // Record solution in team object so it is returned on restore / refresh
    if (!team.submittedSolutions) {
      team.submittedSolutions = {};
    }
    team.submittedSolutions[numProblemId] = {
      problemId: numProblemId,
      code: code,
      language: (language || team.language).toLowerCase(),
      difficulty: problem.difficulty,
      problemTitle: problem.title,
      points: problem.points,
      submittedAt: new Date().toISOString()
    };

    // Check if team solved all assigned challenges in contest
    const allChallengesSolved = assignedProblems.length > 0 && assignedProblems.every(p => team.solvedProblems.includes(p.id));
    if (allChallengesSolved && !team.isCompleted) {
      team.isCompleted = true;
      team.finishedAt = new Date().toISOString();

      let elapsedSeconds = this.getCurrentContestElapsedSeconds();
      if (elapsedSeconds <= 0) {
        // Fallback: calculate elapsed from approvedAt or registeredAt
        const startTs = team.approvedAt ? new Date(team.approvedAt).getTime() : new Date(team.registeredAt).getTime();
        elapsedSeconds = Math.max(1, Math.round((Date.now() - startTs) / 1000));
      }
      team.timeTakenSeconds = elapsedSeconds;
      team.timeTakenFormatted = this.formatDurationSeconds(elapsedSeconds);
      team.timeTakenWords = this.formatDurationWords(elapsedSeconds);
    }

    const submissionId = `SUB-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
    const submissionRecord = {
      id: submissionId,
      teamId: team.id,
      teamName: team.teamName,
      leaderName: team.leaderName,
      leaderRoll: team.leaderRoll,
      university: team.university,
      problemId: numProblemId,
      problemTitle: problem.title,
      difficulty: problem.difficulty,
      points: problem.points,
      language: (language || team.language).toLowerCase(),
      code: code,
      status: 'AC',
      scoreAwarded: scoreAwarded,
      bonus: 0,
      judgeNotes: '',
      isFinalSubmission: allChallengesSolved,
      timeTakenFormatted: team.timeTakenFormatted,
      timeTakenWords: team.timeTakenWords,
      timeTakenSeconds: team.timeTakenSeconds,
      submittedAt: new Date().toISOString()
    };

    submissions.unshift(submissionRecord);

    return {
      submission: submissionRecord,
      team: team,
      allThreeSolved: allChallengesSolved,
      allChallengesSolved: allChallengesSolved,
      totalAssignedCount: assignedProblems.length,
      timeTakenFormatted: team.timeTakenFormatted,
      timeTakenWords: team.timeTakenWords,
      timeTakenSeconds: team.timeTakenSeconds
    };
  },

  getAllSubmissions() {
    return submissions;
  },

  getSubmissionById(id) {
    return submissions.find(s => s.id === id) || null;
  },

  // Total contest points (dynamically calculated from assigned challenges or defaults to 60)
  getTotalContestPoints() {
    const problems = this.getProblems();
    if (problems && problems.length > 0) {
      const sum = problems.reduce((s, p) => s + (p.points || 0), 0);
      return sum > 0 ? sum : 60;
    }
    return 60;
  },

  // Sir custom grading / score override
  gradeSubmission({ submissionId, marks, judgeNotes }) {
    const sub = this.getSubmissionById(submissionId);
    if (!sub) throw new Error(`Submission #${submissionId} not found.`);

    sub.isGradedBySir = true;
    const team = teams.get(sub.teamId);
    const newMarks = parseInt(marks, 10);

    if (team && !isNaN(newMarks)) {
      const diff = newMarks - sub.scoreAwarded;
      sub.scoreAwarded = newMarks;
      team.score = Math.max(0, team.score + diff);

      if (team.submittedSolutions && team.submittedSolutions[sub.problemId]) {
        team.submittedSolutions[sub.problemId].scoreAwarded = newMarks;
        team.submittedSolutions[sub.problemId].judgeNotes = judgeNotes || '';
      }
    }

    if (judgeNotes !== undefined) {
      sub.judgeNotes = judgeNotes;
    }

    return { submission: sub, team, resultsPublished };
  },

  // Award Bonus Marks (+10) by Sir
  awardBonus(submissionId, bonusAmount = 10) {
    const submission = this.getSubmissionById(submissionId);
    if (!submission) throw new Error(`Submission ${submissionId} not found.`);

    const points = parseInt(bonusAmount, 10) || 10;
    submission.bonus = (submission.bonus || 0) + points;

    const team = teams.get(submission.teamId);
    if (team) {
      team.bonusMarks = (team.bonusMarks || 0) + points;
      team.score += points;
    }

    return { submission, team, resultsPublished };
  },

  // Team voluntarily leaves contest early (Incomplete) or contest timer expires (Time Up)
  leaveContestEarly({ teamId, draftCodeMap = {}, language = 'cpp', isTimeUp = false }) {
    let team = this.getTeamById(teamId) || this.getTeamByRoll(teamId);
    if (!team) throw new Error('Team record not found.');

    team.leftEarly = !isTimeUp;
    team.isTimeUp = Boolean(isTimeUp);
    team.status = 'left_early';
    team.leftAt = new Date().toISOString();
    let elapsedSeconds = this.getCurrentContestElapsedSeconds();
    if (elapsedSeconds <= 0) {
      const startTs = team.approvedAt ? new Date(team.approvedAt).getTime() : new Date(team.registeredAt).getTime();
      elapsedSeconds = Math.max(1, Math.round((Date.now() - startTs) / 1000));
    }
    team.timeTakenSeconds = elapsedSeconds;
    team.timeTakenFormatted = this.formatDurationSeconds(elapsedSeconds);
    team.timeTakenWords = this.formatDurationWords(elapsedSeconds);

    const assignedProblems = this.getProblemsForTeam(team.id);

    if (!team.submittedSolutions) {
      team.submittedSolutions = {};
    }

    const recordedSubmissions = [];

    // Ensure all assigned problems (all 3 questions) are submitted to Sir even if left blank
    let targetProblems = [...assignedProblems];
    if (targetProblems.length === 0) {
      targetProblems = this.getProblems();
    }
    if (targetProblems.length === 0 && questionBank.length > 0) {
      targetProblems = questionBank.slice(0, 3).map((q, idx) => ({ ...q, slotNumber: idx + 1 }));
    }

    if (targetProblems && targetProblems.length > 0) {
      targetProblems.forEach(p => {
        const numPid = p.id;
        const draftCode = draftCodeMap[numPid] || draftCodeMap[String(numPid)] || draftCodeMap[p.slotNumber] || draftCodeMap[String(p.slotNumber)] || '';
        const effectiveLang = (team.submittedSolutions[numPid] && team.submittedSolutions[numPid].language) || language || team.language || 'cpp';
        const pPoints = p.points || (p.difficulty === 'Easy' ? 10 : (p.difficulty === 'Medium' ? 20 : 30));
        const pDiff = p.difficulty || (pPoints === 10 ? 'Easy' : (pPoints === 20 ? 'Medium' : 'Hard'));

        // If not already in submittedSolutions or if student hadn't submitted yet
        if (!team.submittedSolutions[numPid] || !team.solvedProblems.includes(numPid)) {
          const finalCode = (draftCode && draftCode.trim()) 
            ? draftCode 
            : `// No code submitted for Problem #${p.slotNumber || p.id}: "${p.title || 'Challenge'}" (${isTimeUp ? 'Contest Timer Expired' : 'Left Contest Early'}).`;

          team.submittedSolutions[numPid] = {
            problemId: numPid,
            problemTitle: p.title || `Problem #${numPid}`,
            difficulty: pDiff,
            points: pPoints,
            code: finalCode,
            language: effectiveLang,
            submittedAt: new Date().toISOString(),
            leftEarly: !isTimeUp,
            isTimeUp: Boolean(isTimeUp)
          };

          const subId = `SUB-${isTimeUp ? 'TIMEUP' : 'EXIT'}-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
          const submissionRecord = {
            id: subId,
            teamId: team.id,
            teamName: team.teamName,
            leaderName: team.leaderName,
            leaderRoll: team.leaderRoll,
            university: team.university,
            problemId: numPid,
            problemTitle: p.title || `Problem #${numPid}`,
            difficulty: pDiff,
            points: pPoints,
            language: effectiveLang,
            code: finalCode,
            status: isTimeUp ? 'TIME_UP' : 'LEFT_EARLY',
            scoreAwarded: 0,
            bonus: 0,
            judgeNotes: isTimeUp ? 'Auto-submitted on contest timer expiration (Time Up)' : 'Submitted on early contest exit (Incomplete)',
            leftEarly: !isTimeUp,
            isTimeUp: Boolean(isTimeUp),
            submittedAt: new Date().toISOString()
          };

          submissions.unshift(submissionRecord);
          recordedSubmissions.push(submissionRecord);
        }
      });
    }

    // Fallback: check if draftCodeMap has extra keys not covered above
    Object.keys(draftCodeMap).forEach(key => {
      const numPid = parseInt(key, 10);
      if (!isNaN(numPid) && !team.submittedSolutions[numPid]) {
        const draftCode = draftCodeMap[key];
        if (draftCode && draftCode.trim()) {
          const q = this.getQuestionById(numPid);
          const pTitle = q ? q.title : `Question ${key}`;
          const pPoints = q ? q.points : (numPid === 1 ? 10 : (numPid === 2 ? 20 : 30));
          const pDiff = q ? q.difficulty : (pPoints === 10 ? 'Easy' : (pPoints === 20 ? 'Medium' : 'Hard'));
          const effectiveLang = language || team.language || 'cpp';

          team.submittedSolutions[numPid] = {
            problemId: numPid,
            problemTitle: pTitle,
            difficulty: pDiff,
            points: pPoints,
            code: draftCode,
            language: effectiveLang,
            submittedAt: new Date().toISOString(),
            leftEarly: !isTimeUp,
            isTimeUp: Boolean(isTimeUp)
          };

          const subId = `SUB-${isTimeUp ? 'TIMEUP' : 'EXIT'}-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
          const submissionRecord = {
            id: subId,
            teamId: team.id,
            teamName: team.teamName,
            leaderName: team.leaderName,
            leaderRoll: team.leaderRoll,
            university: team.university,
            problemId: numPid,
            problemTitle: pTitle,
            difficulty: pDiff,
            points: pPoints,
            language: effectiveLang,
            code: draftCode,
            status: isTimeUp ? 'TIME_UP' : 'LEFT_EARLY',
            scoreAwarded: 0,
            bonus: 0,
            judgeNotes: isTimeUp ? 'Auto-submitted on contest timer expiration (Time Up)' : 'Submitted on early contest exit (Incomplete)',
            leftEarly: !isTimeUp,
            isTimeUp: Boolean(isTimeUp),
            submittedAt: new Date().toISOString()
          };

          submissions.unshift(submissionRecord);
          recordedSubmissions.push(submissionRecord);
        }
      }
    });

    return {
      success: true,
      team,
      recordedSubmissions
    };
  },

  // =========================================================================
  // 5. RESULTS PUBLICATION & PODIUM ENGINE
  // =========================================================================
  isResultsPublished() {
    return resultsPublished;
  },

  publishResults() {
    const approvedTeams = this.getApprovedTeams();
    if (approvedTeams.length === 0) {
      throw new Error('Cannot publish results: There are no approved teams in the contest.');
    }

    if (submissions.length === 0) {
      throw new Error('Cannot publish results: No code submissions recorded yet. Cannot publish un-graded marks.');
    }

    // Check that all submissions have valid marks and left-early / time-up drafts have been graded
    for (const sub of submissions) {
      if (sub.scoreAwarded === null || sub.scoreAwarded === undefined || isNaN(sub.scoreAwarded)) {
        throw new Error(`Cannot publish results: Submission #${sub.id} for Problem #${sub.problemId} (${sub.teamName}) has not been awarded marks.`);
      }
      if ((sub.status === 'LEFT_EARLY' || sub.status === 'TIME_UP') && !sub.isGradedBySir) {
        throw new Error(`Cannot publish results: Team "${sub.teamName}" has submission for Problem #${sub.problemId} that has not been evaluated by Sir yet. Please award marks via ✏️ on their submission first.`);
      }
    }

    resultsPublished = true;
    return { resultsPublished: true };
  },

  unpublishResults() {
    resultsPublished = false;
    return { resultsPublished: false };
  },

  getLeaderboard(includeUnpublished = false) {
    const totalPoints = this.getTotalContestPoints();

    // Only approved teams are listed (kicked out or rejected are excluded)
    const approved = this.getApprovedTeams().map(t => {
      const teamSubs = submissions.filter(s => s.teamId === t.id);
      const questionBreakdown = {};
      teamSubs.forEach(s => {
        if (!questionBreakdown[s.problemId] || s.scoreAwarded > questionBreakdown[s.problemId].scoreAwarded) {
          questionBreakdown[s.problemId] = {
            problemId: s.problemId,
            problemTitle: s.problemTitle,
            difficulty: s.difficulty,
            scoreAwarded: s.scoreAwarded,
            bonus: s.bonus || 0,
            judgeNotes: s.judgeNotes || ''
          };
        }
      });

      return {
        ...t,
        totalContestPoints: totalPoints,
        questionBreakdown: questionBreakdown,
        solvedCount: (t.solvedProblems || []).length
      };
    });

    // Sorting:
    // 1. Total score (descending)
    // 2. Solved problems count (descending)
    // 3. Time Taken (ascending - faster completion ranks higher)
    // 4. Registered timestamp (earlier first)
    approved.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
      if (a.timeTakenSeconds && b.timeTakenSeconds) {
        return a.timeTakenSeconds - b.timeTakenSeconds;
      }
      if (a.timeTakenSeconds && !b.timeTakenSeconds) return -1;
      if (!a.timeTakenSeconds && b.timeTakenSeconds) return 1;
      return new Date(a.registeredAt) - new Date(b.registeredAt);
    });

    const ranked = approved.map((team, index) => {
      const rank = index + 1;
      let titleBadge = 'Participant';
      if (rank === 1) titleBadge = 'Winner / Champion';
      else if (rank === 2) titleBadge = 'Runner Up';
      else if (rank === 3) titleBadge = '2nd Runner Up';

      return {
        rank,
        titleBadge,
        ...team
      };
    });

    // If no active teams exist in current round, but archived podium exists from previous contest:
    if (approved.length === 0 && archivedLeaderboard.length > 0) {
      return {
        published: true,
        isArchived: true,
        archivedAt: archivedAt,
        totalPoints: archivedContestPoints || 60,
        leaderboard: archivedLeaderboard
      };
    }

    return {
      published: resultsPublished,
      isArchived: false,
      archivedAt: null,
      totalPoints: totalPoints,
      leaderboard: ranked
    };
  },

  // =========================================================================
  // 6. JUDGE SESSION MANAGEMENT (OPTION A: SINGLE-JUDGE STRICT LOCK)
  // =========================================================================
  getActiveJudgeSession() {
    if (!activeJudgeSession) return null;
    // Check if expired due to inactivity
    if (Date.now() - activeJudgeSession.lastActivityAt > JUDGE_SESSION_INACTIVITY_MS) {
      activeJudgeSession = null;
      return null;
    }
    return activeJudgeSession;
  },

  setJudgeSession({ sessionId, username, ip, userAgent }) {
    activeJudgeSession = {
      sessionId,
      username,
      name: 'Dr. Rashid Jahangir (Chief Evaluation Judge)',
      ip: ip || 'Unknown IP',
      userAgent: userAgent || 'Unknown Browser',
      loggedInAt: new Date().toISOString(),
      lastActivityAt: Date.now()
    };
    return activeJudgeSession;
  },

  touchJudgeSession() {
    if (activeJudgeSession) {
      activeJudgeSession.lastActivityAt = Date.now();
    }
  },

  clearJudgeSession(sessionId = null) {
    if (!sessionId || (activeJudgeSession && activeJudgeSession.sessionId === sessionId)) {
      activeJudgeSession = null;
      return true;
    }
    return false;
  }
};

module.exports = store;