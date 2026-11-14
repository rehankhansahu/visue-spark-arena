// ============================================================================
// V Spark 2026 - Data Store Module
// Topics: REST APIs (L5), Socket.IO (L7), Timer State Machine, Sir Question Bank,
// Team Kickout, Results Publication, and Multi-Format Downloads
// ============================================================================

const fs = require('fs');
const path = require('path');

// Contest Problems Persistence
const PROBLEMS_FILE = path.join(__dirname, 'problems.json');

function loadProblemsFromFile() {
  try {
    if (fs.existsSync(PROBLEMS_FILE)) {
      const raw = fs.readFileSync(PROBLEMS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('[Store] Error loading problems.json:', err);
  }
  return [];
}

function saveProblemsToFile(problems) {
  try {
    fs.writeFileSync(PROBLEMS_FILE, JSON.stringify(problems, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Error saving problems.json:', err);
  }
}

// Question Bank: Initialized from problems.json (starts empty by default)
let questionBank = loadProblemsFromFile();

// Active Contest Question IDs (Must sum up to exactly 60 points)
let activeContestQuestionIds = questionBank.map(q => q.id);

// Active Global Problem Slots for backwards compatibility
let activeGlobalSlots = {
  easyId: questionBank[0] ? questionBank[0].id : null,
  mediumId: questionBank[1] ? questionBank[1].id : null,
  hardId: questionBank[2] ? questionBank[2].id : null
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

// Permanent Competition History Persistence
const COMPETITIONS_FILE = path.join(__dirname, 'competitions.json');

function loadCompetitionHistoryFromFile() {
  try {
    if (fs.existsSync(COMPETITIONS_FILE)) {
      const raw = fs.readFileSync(COMPETITIONS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('[Store] Error loading competitions.json:', err);
  }
  return [];
}

function saveCompetitionHistoryToFile(history) {
  try {
    fs.writeFileSync(COMPETITIONS_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Error saving competitions.json:', err);
  }
}

let competitionHistory = loadCompetitionHistoryFromFile();

// Teachers and System Settings Persistence
const TEACHERS_FILE = path.join(__dirname, 'teachers.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

const DEFAULT_TEACHER = {
  id: 'teacher-1',
  name: 'Dr. Rashid Jahangir',
  username: 'sir_visue',
  password: 'spark2026',
  designation: 'Chief Evaluation Judge',
  department: 'Department of Computer Science',
  profilePic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  createdAt: new Date().toISOString()
};

function loadTeachersFromFile() {
  try {
    if (fs.existsSync(TEACHERS_FILE)) {
      const raw = fs.readFileSync(TEACHERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('[Store] Error loading teachers.json:', err);
  }
  return [DEFAULT_TEACHER];
}

function saveTeachersToFile(teachersList) {
  try {
    fs.writeFileSync(TEACHERS_FILE, JSON.stringify(teachersList, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Error saving teachers.json:', err);
  }
}

let teachers = loadTeachersFromFile();

function loadSettingsFromFile() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Store] Error loading settings.json:', err);
  }
  return { websiteLocked: false, lockedAt: null, lockedBy: null };
}

function saveSettingsToFile(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Error saving settings.json:', err);
  }
}

let systemSettings = loadSettingsFromFile();

// Arena Session Metadata Persistence (Custom Arena Name, Description, Date & Time)
const ARENA_INFO_FILE = path.join(__dirname, 'arena_info.json');

const DEFAULT_ARENA_INFO = {
  name: 'V Spark 2026 Inter-University Programming Arena',
  description: 'Inter-University Programming Arena • Speed Coding Championship',
  createdAt: new Date().toISOString(),
  dateFormatted: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
  updatedAt: new Date().toISOString()
};

function loadArenaInfoFromFile() {
  try {
    if (fs.existsSync(ARENA_INFO_FILE)) {
      const raw = fs.readFileSync(ARENA_INFO_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          name: parsed.name || DEFAULT_ARENA_INFO.name,
          description: parsed.description !== undefined ? parsed.description : DEFAULT_ARENA_INFO.description,
          createdAt: parsed.createdAt || DEFAULT_ARENA_INFO.createdAt,
          dateFormatted: parsed.dateFormatted || DEFAULT_ARENA_INFO.dateFormatted,
          updatedAt: parsed.updatedAt || DEFAULT_ARENA_INFO.updatedAt
        };
      }
    }
  } catch (err) {
    console.error('[Store] Error loading arena_info.json:', err);
  }
  return { ...DEFAULT_ARENA_INFO };
}

function saveArenaInfoToFile(info) {
  try {
    fs.writeFileSync(ARENA_INFO_FILE, JSON.stringify(info, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Error saving arena_info.json:', err);
  }
}

let arenaInfo = loadArenaInfoFromFile();

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

  getContestReadiness() {
    const approved = this.getApprovedTeams();
    const totalApproved = approved.length;

    if (totalApproved === 0) {
      const activePts = this.getActiveContestPoints();
      const pct = Math.min(100, Math.round((activePts / 60) * 100));
      return {
        hasApprovedTeams: false,
        totalApproved: 0,
        readyTeamsCount: 0,
        percentage: pct,
        totalAssignedPoints: activePts,
        totalTargetPoints: 60,
        isAllReady: false,
        displayPoints: `${activePts} / 60 Points (Awaiting Teams)`,
        statusText: activePts >= 60 
          ? 'Question Bank Ready (60/60 pts) • Awaiting Approved Teams' 
          : `Awaiting Approved Teams (${activePts}/60 pts in Bank)`,
        statusType: 'awaiting_teams',
        teamBreakdown: []
      };
    }

    const teamBreakdown = [];
    let readyTeamsCount = 0;
    let totalAssignedPoints = 0;
    const totalTargetPoints = totalApproved * 60;
    const unreadyLangList = [];

    for (const team of approved) {
      const problems = this.getProblemsForTeam(team.id) || [];
      const pts = problems.reduce((sum, p) => sum + (p.points || 0), 0);
      const isReady = (pts === 60);
      if (isReady) {
        readyTeamsCount++;
      } else {
        const langName = (team.language || 'cpp').toUpperCase();
        if (!unreadyLangList.includes(langName)) {
          unreadyLangList.push(langName);
        }
      }
      totalAssignedPoints += Math.min(60, pts);

      teamBreakdown.push({
        teamId: team.id,
        teamName: team.teamName,
        language: (team.language || 'cpp').toUpperCase(),
        points: pts,
        isReady: isReady,
        problemCount: problems.length,
        pcLockStatus: team.pcLockStatus || 'unlocked',
        isPCLocked: team.pcLockStatus === 'locked'
      });
    }

    const percentage = totalTargetPoints > 0 
      ? Math.min(100, Math.round((totalAssignedPoints / totalTargetPoints) * 100))
      : 0;

    const isAllReady = (readyTeamsCount === totalApproved && totalApproved > 0);
    const lockedTeamsCount = approved.filter(t => t.pcLockStatus === 'locked').length;
    const isAllPCLocked = (lockedTeamsCount === totalApproved && totalApproved > 0);

    let statusText = '';
    let statusType = 'incomplete';

    if (isAllReady && isAllPCLocked) {
      statusType = 'ready';
      statusText = `All Teams Ready & PC Locked (${readyTeamsCount}/${totalApproved} Ready • ${lockedTeamsCount}/${totalApproved} Locked)`;
    } else if (isAllReady && !isAllPCLocked) {
      statusType = 'partial';
      statusText = `Questions Ready (60/60 pts) • Awaiting PC Lock (${lockedTeamsCount}/${totalApproved} Locked)`;
    } else if (readyTeamsCount > 0) {
      statusType = 'partial';
      const needLangs = unreadyLangList.join(', ');
      statusText = `Partially Ready (${readyTeamsCount}/${totalApproved} Teams) • ${needLangs} needs questions`;
    } else {
      statusType = 'incomplete';
      const needLangs = unreadyLangList.length > 0 ? ` (${unreadyLangList.join(', ')})` : '';
      statusText = `Incomplete (0/${totalApproved} Teams Ready) • Assign questions to teams${needLangs}`;
    }

    return {
      hasApprovedTeams: true,
      totalApproved,
      readyTeamsCount,
      percentage,
      totalAssignedPoints,
      totalTargetPoints,
      isAllReady,
      lockedTeamsCount,
      isAllPCLocked,
      displayPoints: `${readyTeamsCount} / ${totalApproved} Teams Ready (${totalAssignedPoints} / ${totalTargetPoints} pts)`,
      statusText,
      statusType,
      teamBreakdown
    };
  },

  checkAllApprovedTeamsPCLocked() {
    const approved = this.getApprovedTeams().filter(t => !t.leftEarly && t.status === 'approved');
    if (approved.length === 0) {
      return { ready: true, unlockedTeams: [] };
    }
    const unlockedTeams = approved.filter(t => t.pcLockStatus !== 'locked');
    if (unlockedTeams.length > 0) {
      const namesList = unlockedTeams.map((t, i) => `${i + 1}. "${t.teamName}" (${t.university}) - Leader: ${t.leaderName} [User: @${t.username || t.teamName}]`).join('\n');
      return {
        ready: false,
        unlockedCount: unlockedTeams.length,
        totalApproved: approved.length,
        unlockedTeams: unlockedTeams.map(t => ({ id: t.id, name: t.teamName, university: t.university })),
        message: `⚠️ CANNOT START ARENA COMPETITION!\n\nAll participating teams must execute the Internet Exam-Lock tool first!\n\nThe following ${unlockedTeams.length} approved team(s) have NOT locked their PCs yet:\n\n${namesList}\n\nPlease instruct all students to download and run their personalized Exam-Lock script (.bat) as Administrator before starting the contest!`
      };
    }
    return { ready: true, unlockedTeams: [] };
  },

  lockAllApprovedTeams() {
    const approved = this.getApprovedTeams().filter(t => !t.leftEarly && t.status === 'approved');
    approved.forEach(team => {
      team.pcLockStatus = 'locked';
      team.pcLockedAt = new Date().toISOString();
      team.pcLastHeartbeat = Date.now();
      team.pcTamperAlert = false;
    });
    return approved;
  },

  startTimer(options = {}) {
    const readyCheck = this.checkAllApprovedTeamsHaveAssignedQuestions();
    if (!readyCheck.ready) {
      throw new Error(readyCheck.message);
    }

    if (options && (options.forceLock || options.autoLock)) {
      this.lockAllApprovedTeams();
    } else {
      const pcLockCheck = this.checkAllApprovedTeamsPCLocked();
      if (!pcLockCheck.ready) {
        throw new Error(pcLockCheck.message);
      }
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

  saveCurrentCompetitionSnapshot(customTitle = null, customDescription = null) {
    try {
      const currentLeaderboard = this.getLeaderboard(true);
      const teamsList = currentLeaderboard.leaderboard || [];

      // Only save if there was at least one team, or questions were assigned
      if (teamsList.length === 0 && questionBank.length === 0) {
        return null;
      }

      const now = new Date();
      const timestamp = now.toISOString();
      const dateFormatted = now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      const compId = `COMP-${Date.now()}`;
      const compNum = competitionHistory.length + 1;
      const title = (customTitle && customTitle.trim()) || arenaInfo.name || `V Spark Competition #${compNum}`;
      const desc = (customDescription !== null && customDescription !== undefined) 
        ? customDescription.trim() 
        : (arenaInfo.description || '');

      // Snapshot all questions included in this competition (Question Bank + Active + Team Specific)
      const includedQuestionsMap = new Map();
      questionBank.forEach(q => {
        if (q && q.id) {
          includedQuestionsMap.set(q.id, JSON.parse(JSON.stringify(q)));
        }
      });
      activeContestQuestionIds.forEach(id => {
        const q = this.getQuestionById(id);
        if (q && !includedQuestionsMap.has(q.id)) {
          includedQuestionsMap.set(q.id, JSON.parse(JSON.stringify(q)));
        }
      });
      teamSpecificQuestions.forEach((qIds) => {
        if (Array.isArray(qIds)) {
          qIds.forEach(id => {
            const q = this.getQuestionById(id);
            if (q && !includedQuestionsMap.has(q.id)) {
              includedQuestionsMap.set(q.id, JSON.parse(JSON.stringify(q)));
            }
          });
        }
      });

      const questionsSnapshot = Array.from(includedQuestionsMap.values());

      const snapshot = {
        id: compId,
        title: title,
        arenaName: title,
        description: desc,
        timestamp: timestamp,
        dateFormatted: dateFormatted,
        durationMinutes: contestDurationMinutes,
        totalPoints: this.getTotalContestPoints() || 60,
        winner: teamsList[0] ? {
          teamName: teamsList[0].teamName,
          leaderName: teamsList[0].leaderName,
          leaderRoll: teamsList[0].leaderRoll,
          university: teamsList[0].university,
          score: teamsList[0].score,
          totalPoints: teamsList[0].totalContestPoints || 60
        } : null,
        teams: JSON.parse(JSON.stringify(teamsList)),
        questions: questionsSnapshot,
        totalTeams: teamsList.length,
        totalQuestions: questionsSnapshot.length
      };

      competitionHistory.push(snapshot);
      saveCompetitionHistoryToFile(competitionHistory);
      return snapshot;
    } catch (err) {
      console.error('[Store] Failed to save competition snapshot:', err);
      return null;
    }
  },

  getCompetitionHistory() {
    return [...competitionHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  getCompetitionById(id) {
    return competitionHistory.find(c => c.id === id) || null;
  },

  updateCompetitionHistoryItem(id, { title, description }) {
    const comp = competitionHistory.find(c => c.id === id);
    if (!comp) throw new Error(`Competition "${id}" not found.`);
    if (title && title.trim()) {
      comp.title = title.trim();
      comp.arenaName = title.trim();
    }
    if (description !== undefined) {
      comp.description = (description || '').trim();
    }
    comp.updatedAt = new Date().toISOString();
    saveCompetitionHistoryToFile(competitionHistory);
    return comp;
  },

  // =========================================================================
  // ARENA SESSION METADATA (CUSTOM NAME & DESCRIPTION WITH AUTO DATE/TIME)
  // =========================================================================
  getArenaInfo() {
    return { ...arenaInfo };
  },

  setArenaInfo({ name, description }) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      throw new Error('Arena name cannot be empty.');
    }
    const now = new Date();
    arenaInfo.name = trimmedName;
    arenaInfo.description = (description !== undefined ? description : arenaInfo.description || '').trim();
    arenaInfo.updatedAt = now.toISOString();
    arenaInfo.dateFormatted = now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    if (!arenaInfo.createdAt) {
      arenaInfo.createdAt = now.toISOString();
    }
    saveArenaInfoToFile(arenaInfo);
    return { ...arenaInfo };
  },

  resetContestFull() {
    // 0. Automatically preserve current competition in permanent history before resetting!
    this.saveCurrentCompetitionSnapshot();

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
    // Do NOT reload default questions; keep questionBank as is
    activeContestQuestionIds = questionBank.map(q => q.id);
    activeGlobalSlots = {
      easyId: questionBank[0] ? questionBank[0].id : null,
      mediumId: questionBank[1] ? questionBank[1].id : null,
      hardId: questionBank[2] ? questionBank[2].id : null
    };
    return {
      timer: this.getContestTimer(),
      teamsCount: 0,
      submissionsCount: 0,
      questionsCount: questionBank.length,
      hasArchivedPodium: archivedLeaderboard.length > 0,
      archivedPodium: archivedPodium
    };
  },

  // 100% Full Contest Reset: Completely wipes teams, submissions, timer, questions AND podium archive
  resetContestWipeAll() {
    // Automatically preserve competition snapshot before wiping live arena
    this.saveCurrentCompetitionSnapshot();

    timerStatus = 'not_started';
    timerStartTime = null;
    elapsedBeforePause = 0;
    resultsPublished = false;
    teams.clear();
    submissions.length = 0;
    teamSpecificQuestions.clear();
    // Do NOT reload default questions; keep questionBank as is
    activeContestQuestionIds = questionBank.map(q => q.id);
    activeGlobalSlots = {
      easyId: questionBank[0] ? questionBank[0].id : null,
      mediumId: questionBank[1] ? questionBank[1].id : null,
      hardId: questionBank[2] ? questionBank[2].id : null
    };
    archivedLeaderboard = [];
    archivedPodium = [];
    archivedAt = null;
    archivedContestPoints = 60;
    return {
      timer: this.getContestTimer(),
      teamsCount: 0,
      submissionsCount: 0,
      questionsCount: questionBank.length,
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
      : ['C', 'C++', 'Java', 'Python', 'HTML', 'JavaScript', 'Dart', 'PHP'];

    const cleanTeamLang = teamLang.toLowerCase().trim();
    const aliasMap = {
      'c': ['c'],
      'cpp': ['c++', 'cpp'],
      'c++': ['c++', 'cpp'],
      'java': ['java'],
      'python': ['python', 'py'],
      'py': ['python', 'py'],
      'html': ['html', 'html5'],
      'javascript': ['javascript', 'js'],
      'js': ['javascript', 'js'],
      'dart': ['dart'],
      'php': ['php']
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
    const allTracks = ['c', 'cpp', 'java', 'python', 'html', 'javascript', 'dart', 'php'];
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

    let selectedLangs = ['C', 'C++', 'Java', 'Python', 'HTML', 'JavaScript', 'Dart', 'PHP'];
    if (Array.isArray(questionData.languages) && questionData.languages.length > 0) {
      selectedLangs = questionData.languages;
    } else if (typeof questionData.languages === 'string' && questionData.languages.trim()) {
      selectedLangs = questionData.languages.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    }

    const optA = (questionData.optionA || (questionData.options && questionData.options.a) || '').toString().trim();
    const optB = (questionData.optionB || (questionData.options && questionData.options.b) || '').toString().trim();
    const optC = (questionData.optionC || (questionData.options && questionData.options.c) || '').toString().trim();
    const optD = (questionData.optionD || (questionData.options && questionData.options.d) || '').toString().trim();
    const correctAns = (questionData.correctAnswer || questionData.correct_answer || '').toString().trim();

    const newQuestion = {
      id: newId,
      title: (questionData.title || `Challenge #${newId}`).trim(),
      difficulty: diff,
      points: points,
      timeLimit: questionData.timeLimit || "1.5s",
      memoryLimit: questionData.memoryLimit || "256MB",
      tags: questionData.tags || ["Algorithm", "Logic"],
      description: (questionData.description || questionData.statement || '').trim(),
      inputFormat: questionData.inputFormat || "Standard Input",
      outputFormat: questionData.outputFormat || "Standard Output",
      constraints: questionData.constraints || ["1 <= N <= 10^5"],
      optionA: optA,
      optionB: optB,
      optionC: optC,
      optionD: optD,
      options: {
        a: optA,
        b: optB,
        c: optC,
        d: optD
      },
      correctAnswer: correctAns,
      sampleCases: questionData.sampleCases || [
        { input: questionData.sampleInput || "Sample input", expected: questionData.sampleOutput || "Sample output", explanation: "Sample demonstration" }
      ],
      starterCode: questionData.starterCode || {
        c: `// Write your C code here...\n`,
        cpp: `// Write your C++ code here...\n`,
        java: `// Write your Java code here...\n`,
        python: `# Write your Python code here...\n`,
        html: `<!-- Write your HTML code here -->\n<!DOCTYPE html>\n<html>\n<head>\n  <title>Solution</title>\n</head>\n<body>\n\n</body>\n</html>\n`,
        javascript: `// Write your JavaScript code here...\nfunction solve(input) {\n  // Implementation\n}\n`,
        dart: `// Write your Dart code here...\nvoid main() {\n  // Implementation\n}\n`,
        php: `<?php\n// Write your PHP code here...\n`
      },
      languages: selectedLangs
    };

    questionBank.push(newQuestion);
    saveProblemsToFile(questionBank);
    return newQuestion;
  },

  updateQuestionInBank(id, questionData) {
    const numId = parseInt(id, 10);
    const existing = questionBank.find(q => q.id === numId);
    if (!existing) throw new Error(`Question #${numId} not found in Question Bank.`);

    const diff = questionData.difficulty || existing.difficulty || 'Easy';
    const points = parseInt(questionData.points, 10) || (diff === 'Easy' ? 10 : (diff === 'Medium' ? 20 : 30));

    let selectedLangs = existing.languages || ['C', 'C++', 'Java', 'Python', 'HTML', 'JavaScript', 'Dart', 'PHP'];
    if (Array.isArray(questionData.languages) && questionData.languages.length > 0) {
      selectedLangs = questionData.languages;
    } else if (typeof questionData.languages === 'string' && questionData.languages.trim()) {
      selectedLangs = questionData.languages.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    }

    const optA = questionData.optionA !== undefined ? questionData.optionA.toString().trim() : (existing.optionA || '');
    const optB = questionData.optionB !== undefined ? questionData.optionB.toString().trim() : (existing.optionB || '');
    const optC = questionData.optionC !== undefined ? questionData.optionC.toString().trim() : (existing.optionC || '');
    const optD = questionData.optionD !== undefined ? questionData.optionD.toString().trim() : (existing.optionD || '');
    const correctAns = questionData.correctAnswer !== undefined ? questionData.correctAnswer.toString().trim() : (existing.correctAnswer || '');

    existing.title = (questionData.title || existing.title).trim();
    existing.description = (questionData.description !== undefined ? questionData.description : existing.description).trim();
    existing.difficulty = diff;
    existing.points = points;
    existing.languages = selectedLangs;
    existing.optionA = optA;
    existing.optionB = optB;
    existing.optionC = optC;
    existing.optionD = optD;
    existing.options = {
      a: optA,
      b: optB,
      c: optC,
      d: optD
    };
    existing.correctAnswer = correctAns;

    if (questionData.sampleInput || questionData.sampleOutput) {
      existing.sampleCases = [
        {
          input: questionData.sampleInput || (existing.sampleCases && existing.sampleCases[0] && existing.sampleCases[0].input) || '',
          expected: questionData.sampleOutput || (existing.sampleCases && existing.sampleCases[0] && existing.sampleCases[0].expected) || '',
          explanation: (existing.sampleCases && existing.sampleCases[0] && existing.sampleCases[0].explanation) || ''
        }
      ];
    }

    saveProblemsToFile(questionBank);
    return existing;
  },

  bulkImportQuestions(importedList) {
    if (!Array.isArray(importedList) || importedList.length === 0) {
      throw new Error('Imported data must contain at least one question row.');
    }
    const addedQuestions = [];
    for (const item of importedList) {
      if (!item || typeof item !== 'object') continue;

      // Normalize all keys for case-insensitive and space-agnostic matching
      const norm = {};
      for (const [k, v] of Object.entries(item)) {
        if (k) {
          const cleanK = k.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
          norm[cleanK] = v;
        }
      }

      const rawTitle = norm['title'] || norm['problemtitle'] || norm['questiontitle'] || norm['problem'] || norm['question'] || item.title || item.Title || '';
      const rawDesc = norm['description'] || norm['statement'] || norm['problemstatement'] || norm['questionstatement'] || norm['desc'] || item.description || item.Description || '';

      const title = rawTitle.toString().trim();
      const description = rawDesc.toString().trim();

      // Skip completely empty rows
      if (!title && !description) {
        continue;
      }

      const finalTitle = title || description.slice(0, 40) || 'Imported Challenge';
      const finalDesc = description || finalTitle;

      let rawDiff = (norm['difficulty'] || norm['diff'] || norm['level'] || item.difficulty || item.Difficulty || 'Easy').toString().trim();
      let diff = 'Easy';
      const diffLower = rawDiff.toLowerCase();
      if (diffLower.includes('hard')) diff = 'Hard';
      else if (diffLower.includes('med')) diff = 'Medium';
      else diff = 'Easy';

      const rawPoints = parseInt(norm['points'] || norm['point'] || norm['pts'] || norm['score'] || norm['marks'] || item.points || item.Points, 10);
      const points = (!isNaN(rawPoints) && rawPoints > 0) 
        ? rawPoints 
        : (diff === 'Hard' ? 30 : (diff === 'Medium' ? 20 : 10));

      let langs = ['C', 'C++', 'Java', 'Python', 'HTML', 'JavaScript', 'Dart', 'PHP'];
      const rawLangs = norm['languages'] || norm['language'] || norm['lang'] || norm['langs'] || item.languages || item.Languages || item.language;
      if (typeof rawLangs === 'string' && rawLangs.trim()) {
        langs = rawLangs.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      } else if (Array.isArray(rawLangs) && rawLangs.length > 0) {
        langs = rawLangs;
      }

      const optionA = (norm['optiona'] || norm['opta'] || norm['a'] || item['Option A'] || item.optionA || item.a || item.A || '').toString().trim();
      const optionB = (norm['optionb'] || norm['optb'] || norm['b'] || item['Option B'] || item.optionB || item.b || item.B || '').toString().trim();
      const optionC = (norm['optionc'] || norm['optc'] || norm['c'] || item['Option C'] || item.optionC || item.c || item.C || '').toString().trim();
      const optionD = (norm['optiond'] || norm['optd'] || norm['d'] || item['Option D'] || item.optionD || item.d || item.D || '').toString().trim();
      const correctAnswer = (norm['correctanswer'] || norm['correct'] || norm['answer'] || norm['ans'] || item['Correct Answer'] || item.correctAnswer || item.answer || item.Answer || '').toString().trim();
      const sampleIn = (norm['sampleinput'] || norm['samplein'] || norm['input'] || item['Sample Input'] || item.sampleInput || '').toString().trim();
      const sampleOut = (norm['sampleoutput'] || norm['sampleout'] || norm['output'] || norm['expected'] || item['Sample Output'] || item.sampleOutput || item.expected || '').toString().trim();

      const newQ = this.addQuestionToBank({
        title: finalTitle,
        description: finalDesc,
        difficulty: diff,
        points,
        languages: langs,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer,
        sampleInput: sampleIn,
        sampleOutput: sampleOut
      });
      addedQuestions.push(newQ);
    }

    if (addedQuestions.length === 0) {
      throw new Error('No valid questions could be imported. Please ensure at least one row has a Title or Description.');
    }
    return addedQuestions;
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
    saveProblemsToFile(questionBank);
    return { success: true, removedId: numId };
  },

  clearQuestionBank() {
    const count = questionBank.length;
    questionBank = [];
    activeContestQuestionIds = [];
    activeGlobalSlots = {
      easyId: null,
      mediumId: null,
      hardId: null
    };
    teamSpecificQuestions.clear();
    saveProblemsToFile(questionBank);
    return { success: true, removedCount: count };
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
  registerTeam({ teamType, teamName, leaderName, leaderRoll, member2Name, member2Roll, university, language, username, password, secretKey, profilePic }) {
    const timer = this.getContestTimer();
    if (timer && timer.status && timer.status !== 'not_started') {
      throw new Error('Registration Closed: The contest is currently in progress or has ended. Sir / Chief Judge must reset the previous contest before new registrations can be accepted.');
    }

    const formattedRoll = (leaderRoll || '').trim();
    const leaderLower = formattedRoll.toLowerCase();
    const member2Lower = (member2Roll || '').trim().toLowerCase();
    
    // Clean Username & Password
    let cleanUser = (username || '').trim().toLowerCase();
    if (!cleanUser) {
      // Auto-generate clean username if omitted
      const seedName = (leaderRoll || leaderName || 'team').toLowerCase().replace(/[^a-z0-9]/g, '');
      cleanUser = `${seedName.slice(0, 16)}_${Math.floor(100 + Math.random() * 900)}`;
    } else {
      if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUser)) {
        throw new Error('Username must be 3-30 characters and can only contain letters, numbers, underscores, dashes, or dots.');
      }
    }

    let cleanPass = (password || '').trim();
    if (cleanPass) {
      if (cleanPass.length < 4) {
        throw new Error('Password must be at least 4 characters long.');
      }
    } else {
      // Fallback for legacy requests
      cleanPass = (secretKey || '').trim() || 'spark2026';
    }

    let cleanPin = (secretKey || cleanUser).trim();

    // Check if team with same leader or member roll already exists in ACTIVE teams
    for (const [id, t] of teams.entries()) {
      const isInactive = (t.status === 'rejected' || t.status === 'kicked_out' || t.status === 'disqualified' || t.status === 'deleted');
      if (isInactive) {
        // Clean up any stale inactive record matching this roll, username, or PIN
        const matchRoll = (t.leaderRoll && t.leaderRoll.toLowerCase() === leaderLower) ||
          (t.member2Roll && t.member2Roll.toLowerCase() === leaderLower) ||
          (member2Lower && t.leaderRoll && t.leaderRoll.toLowerCase() === member2Lower) ||
          (member2Lower && t.member2Roll && t.member2Roll.toLowerCase() === member2Lower);
        const matchUser = t.username && t.username.toLowerCase() === cleanUser;
        const matchPin = cleanPin && (String(t.passKey).trim() === cleanPin || String(t.secretKey).trim() === cleanPin);

        if (matchRoll || matchUser || matchPin) {
          teams.delete(id);
          teamSpecificQuestions.delete(id);
        }
        continue;
      }

      const tLeader = (t.leaderRoll || '').toLowerCase();
      const tMember2 = (t.member2Roll || '').toLowerCase();

      if (tLeader === leaderLower || (member2Lower && tLeader === member2Lower) ||
          (tMember2 && tMember2 === leaderLower) || (tMember2 && member2Lower && tMember2 === member2Lower)) {
        throw new Error(`Roll Number "${formattedRoll}" is already registered (Team: "${t.teamName}"). If this is your team, please enter your Username & Password in the Login box below.`);
      }

      if (t.username && t.username.toLowerCase() === cleanUser) {
        throw new Error(`Username "${cleanUser}" is already taken by another team. Please choose a different username.`);
      }
    }

    const teamId = `TEAM-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
    const passKey = cleanUser;

    const newTeam = {
      id: teamId,
      teamType: teamType === 'duo' ? 'duo' : 'solo',
      teamName: (teamName || `${leaderName}'s Team`).trim(),
      username: cleanUser,
      password: cleanPass,
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
      secretKey: passKey,
      pcLockStatus: 'unlocked', // 'unlocked' | 'locked' | 'left'
      pcLockedAt: null,
      pcLastHeartbeat: null,
      pcTamperAlert: false
    };

    teams.set(teamId, newTeam);
    return { isNew: true, team: newTeam };
  },

  approveTeam(teamId) {
    const team = teams.get(teamId);
    if (!team) throw new Error(`Team #${teamId} not found.`);
    team.status = 'approved';
    team.approvedAt = new Date().toISOString();

    // Automatically ensure team has 60 points of assigned questions if not already assigned
    if (activeContestQuestionIds.length > 0 && !teamSpecificQuestions.has(teamId)) {
      teamSpecificQuestions.set(teamId, [...activeContestQuestionIds]);
    }
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

  getTeamByUsername(username) {
    if (!username) return null;
    const clean = String(username).trim().toLowerCase();
    for (const t of teams.values()) {
      if (t.status === 'rejected' || t.status === 'kicked_out' || t.status === 'deleted') continue;
      if (t.username && t.username.toLowerCase() === clean) return t;
    }
    return null;
  },

  authenticateStudent(identifier, password) {
    if (!identifier || !password) return null;
    const cleanId = String(identifier).trim().toLowerCase();
    const cleanPass = String(password).trim();

    for (const t of teams.values()) {
      if (t.status === 'rejected' || t.status === 'kicked_out' || t.status === 'deleted') continue;
      const matchUser = (t.username && t.username.toLowerCase() === cleanId);
      const matchRoll = (t.leaderRoll && t.leaderRoll.toLowerCase() === cleanId) ||
                        (t.member2Roll && t.member2Roll.toLowerCase() === cleanId);
      const matchId = (t.id && t.id.toLowerCase() === cleanId);
      const matchKey = (t.passKey && String(t.passKey).toLowerCase() === cleanId) ||
                       (t.secretKey && String(t.secretKey).toLowerCase() === cleanId);

      if (matchUser || matchRoll || matchId || matchKey) {
        if (t.password && t.password === cleanPass) {
          return t;
        }
        // Fallback for legacy passwords
        if (!t.password && (cleanPass === 'spark2026' || cleanPass === t.passKey || cleanPass === t.secretKey)) {
          return t;
        }
        throw new Error('Incorrect password. Please verify your team password.');
      }
    }
    return null;
  },

  getTeamByPassKey(passKey) {
    if (!passKey) return null;
    const cleanKey = String(passKey).trim().toUpperCase();
    for (const t of teams.values()) {
      if (t.status === 'rejected' || t.status === 'kicked_out' || t.status === 'deleted') continue;
      if ((t.username && String(t.username).trim().toUpperCase() === cleanKey) ||
          (t.passKey && String(t.passKey).trim().toUpperCase() === cleanKey) || 
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
  },

  // =========================================================================
  // 7. SUPER ADMIN: TEACHERS MANAGEMENT
  // =========================================================================
  getTeachers(includePasswords = false) {
    return teachers.map(t => {
      const copy = { ...t };
      if (!includePasswords) delete copy.password;
      return copy;
    });
  },

  getTeacherById(id) {
    return teachers.find(t => t.id === id) || null;
  },

  getTeacherByUsername(username) {
    if (!username) return null;
    const clean = username.trim().toLowerCase();
    return teachers.find(t => t.username.toLowerCase() === clean) || null;
  },

  addTeacher({ name, username, password, designation, department, profilePic }) {
    const cleanUser = (username || '').trim().toLowerCase();
    if (!cleanUser) throw new Error('Username is required.');
    if (!name || !name.trim()) throw new Error('Teacher name is required.');
    if (!password || !password.trim()) throw new Error('Password is required.');

    const exists = teachers.some(t => t.username.toLowerCase() === cleanUser);
    if (exists) throw new Error(`Teacher with username "${cleanUser}" already exists.`);

    const newTeacher = {
      id: `teacher-${Date.now()}`,
      name: name.trim(),
      username: cleanUser,
      password: password.trim(),
      designation: (designation || 'Evaluation Judge').trim(),
      department: (department || 'Department of Computer Science').trim(),
      profilePic: (profilePic || '').trim() || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
      createdAt: new Date().toISOString()
    };

    teachers.push(newTeacher);
    saveTeachersToFile(teachers);
    return newTeacher;
  },

  updateTeacher(id, { name, username, password, designation, department, profilePic }) {
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) throw new Error(`Teacher #${id} not found.`);

    if (username) {
      const cleanUser = username.trim().toLowerCase();
      if (cleanUser !== teacher.username.toLowerCase()) {
        const exists = teachers.some(t => t.id !== id && t.username.toLowerCase() === cleanUser);
        if (exists) throw new Error(`Username "${cleanUser}" is already taken.`);
        teacher.username = cleanUser;
      }
    }

    if (name) teacher.name = name.trim();
    if (password && password.trim()) teacher.password = password.trim();
    if (designation !== undefined) teacher.designation = designation.trim();
    if (department !== undefined) teacher.department = department.trim();
    if (profilePic !== undefined) teacher.profilePic = profilePic.trim();

    saveTeachersToFile(teachers);
    return teacher;
  },

  deleteTeacher(id) {
    const idx = teachers.findIndex(t => t.id === id);
    if (idx === -1) throw new Error(`Teacher #${id} not found.`);
    if (teachers.length <= 1) throw new Error('Cannot delete the only remaining teacher.');

    const removed = teachers.splice(idx, 1)[0];
    saveTeachersToFile(teachers);
    return removed;
  },

  authenticateTeacher(username, password) {
    if (!username || !password) return null;
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    return teachers.find(t => t.username.toLowerCase() === cleanUser && t.password === cleanPass) || null;
  },

  // =========================================================================
  // 8. SUPER ADMIN: GLOBAL WEBSITE LOCK (READ-ONLY MODE)
  // =========================================================================
  isWebsiteLocked() {
    return Boolean(systemSettings.websiteLocked);
  },

  getSystemSettings() {
    return { ...systemSettings };
  },

  setWebsiteLocked(locked, user = 'Super Admin') {
    systemSettings.websiteLocked = Boolean(locked);
    systemSettings.lockedAt = Boolean(locked) ? new Date().toISOString() : null;
    systemSettings.lockedBy = Boolean(locked) ? user : null;
    saveSettingsToFile(systemSettings);
    return { ...systemSettings };
  },

  // =========================================================================
  // 9. PC EXAM-LOCK & TAMPER MONITORING
  // =========================================================================
  setTeamPCLock(passKeyOrId, status = 'locked') {
    const team = this.getTeamByUsername(passKeyOrId) || this.getTeamByPassKey(passKeyOrId) || this.getTeamById(passKeyOrId) || this.getTeamByRoll(passKeyOrId);
    if (!team) throw new Error('Team record not found for PC Exam-Lock.');

    team.pcLockStatus = status; // 'locked' | 'unlocked' | 'left'
    if (status === 'locked') {
      team.pcLockedAt = new Date().toISOString();
      team.pcLastHeartbeat = Date.now();
      team.pcTamperAlert = false;
    } else {
      team.pcLastHeartbeat = Date.now();
      team.pcTamperAlert = false;
    }
    return team;
  },

  recordTeamHeartbeat(passKeyOrId) {
    const team = this.getTeamByUsername(passKeyOrId) || this.getTeamByPassKey(passKeyOrId) || this.getTeamById(passKeyOrId) || this.getTeamByRoll(passKeyOrId);
    if (!team) return null;

    team.pcLastHeartbeat = Date.now();
    // If it was marked tamper earlier, clear the alert once script resumes heartbeat
    if (team.pcTamperAlert) {
      team.pcTamperAlert = false;
    }
    return team;
  },

  checkTeamTamperStatus() {
    const timer = this.getContestTimer();
    const isRunning = (timer && timer.status === 'running');
    const now = Date.now();
    const alerts = [];

    for (const team of teams.values()) {
      if (team.status === 'approved' && !team.leftEarly && team.pcLockStatus === 'locked') {
        // If contest is actively running and heartbeat has stopped for more than 20 seconds:
        if (isRunning && team.pcLastHeartbeat && (now - team.pcLastHeartbeat > 20000)) {
          if (!team.pcTamperAlert) {
            team.pcTamperAlert = true;
            alerts.push(team);
          }
        }
      }
    }
    return alerts;
  }
};

module.exports = store;