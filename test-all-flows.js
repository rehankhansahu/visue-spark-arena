const http = require('http');
const { app } = require('./server');

// Helper for making HTTP requests to local server
function request(serverInstance, method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const address = serverInstance.address();
    const port = address.port;
    const postData = data ? JSON.stringify(data) : '';

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: path,
      method: method,
      headers: reqHeaders
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('  STARTING COMPREHENSIVE END-TO-END APPLICATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  // Bind to random port for isolated testing
  const testServer = http.createServer(app);
  await new Promise(resolve => testServer.listen(0, '127.0.0.1', resolve));
  const testPort = testServer.address().port;
  console.log(`Test server running on port ${testPort}...\n`);

  try {
    // -------------------------------------------------------------
    // 1. PUBLIC & ARENA INFO TESTS
    // -------------------------------------------------------------
    console.log('--- 1. Testing Arena Info Endpoints ---');
    const arenaInfoRes = await request(testServer, 'GET', '/api/arena/info');
    assert(arenaInfoRes.status === 200 && arenaInfoRes.data.success, 'GET /api/arena/info returns 200 & success');
    assert(Boolean(arenaInfoRes.data.arenaInfo && arenaInfoRes.data.arenaInfo.name), 'Arena info contains name property');

    // -------------------------------------------------------------
    // 2. SIR AUTHENTICATION & SESSION LOCK
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Sir Authentication ---');
    const sirLoginRes = await request(testServer, 'POST', '/api/login', {
      username: 'sir_visue',
      password: 'spark2026',
      forceUnlock: true
    });
    assert(sirLoginRes.status === 200 && sirLoginRes.data.success, 'POST /api/login succeeds with valid credentials');
    const sirToken = sirLoginRes.data.token;
    assert(Boolean(sirToken), 'Sir login returns JWT token');

    const authHeaders = { 'Authorization': `Bearer ${sirToken}` };

    const sirCheckRes = await request(testServer, 'GET', '/api/verify-auth', null, authHeaders);
    assert(sirCheckRes.status === 200 && sirCheckRes.data.success, 'GET /api/verify-auth validates JWT');

    // -------------------------------------------------------------
    // 3. ARENA NAME & DESCRIPTION UPDATE
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Arena Name & Description Mutation ---');
    const updateArenaRes = await request(testServer, 'POST', '/api/admin/arena/info', {
      name: 'V Spark 2026 - Automated Test Arena',
      description: 'Test session description'
    }, authHeaders);
    assert(updateArenaRes.status === 200 && updateArenaRes.data.success, 'POST /api/admin/arena/info updates name');
    assert(updateArenaRes.data.arenaInfo.name === 'V Spark 2026 - Automated Test Arena', 'Updated name is correctly saved');
    assert(Boolean(updateArenaRes.data.arenaInfo.dateFormatted), 'Auto date & time is attached');

    // -------------------------------------------------------------
    // 4. STUDENT REGISTRATION (WITH USERNAME & PASSWORD)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Student Registration with Username & Password ---');
    const regRes = await request(testServer, 'POST', '/api/register', {
      teamName: 'Cyber Knights',
      username: 'cyber_knights',
      password: 'password123',
      leaderName: 'Zain Ahmed',
      leaderRoll: 'FA23-BCS-042',
      university: 'COMSATS Vehari',
      teamType: 'duo',
      member2Name: 'Bilal Hassan',
      member2Roll: 'FA23-BCS-055',
      language: 'cpp'
    });
    assert(regRes.status === 201 && regRes.data.success, 'POST /api/register creates new team (status 201)');
    const team = regRes.data.team;
    assert(Boolean(team && team.id && team.username === 'cyber_knights'), 'Registered team has ID and custom username');
    assert(team.status === 'pending', 'New team status is pending');

    // Duplicate Username check - should be rejected!
    const dupRes = await request(testServer, 'POST', '/api/register', {
      teamName: 'Another Team',
      username: 'cyber_knights',
      password: 'password999',
      leaderName: 'Hamza Tariq',
      leaderRoll: 'FA23-BCS-099',
      university: 'COMSATS Vehari',
      teamType: 'solo',
      language: 'cpp'
    });
    assert(dupRes.status === 400 && !dupRes.data.success, 'Duplicate username is strictly blocked by server');

    // Student Login test with correct credentials
    console.log('\n--- 4b. Testing Student Login API ---');
    const studentLoginRes = await request(testServer, 'POST', '/api/student/login', {
      username: 'cyber_knights',
      password: 'password123'
    });
    assert(studentLoginRes.status === 200 && studentLoginRes.data.success, 'POST /api/student/login succeeds with valid credentials');

    // Student Login with bad password - should fail
    const badLoginRes = await request(testServer, 'POST', '/api/student/login', {
      username: 'cyber_knights',
      password: 'wrong_password'
    });
    assert(badLoginRes.status === 401 && !badLoginRes.data.success, 'Student login rejects invalid password (401)');

    // Check team status by username
    const statusRes = await request(testServer, 'GET', `/api/team-status/${team.username}`);
    assert(statusRes.status === 200 && statusRes.data.team.teamName === 'Cyber Knights', 'GET /api/team-status retrieves team by username');

    // -------------------------------------------------------------
    // 5. SIR TEAM APPROVAL & QUESTION MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Sir Approval & Questions ---');
    const pendingRes = await request(testServer, 'GET', '/api/admin/pending-requests', null, authHeaders);
    assert(pendingRes.status === 200 && pendingRes.data.teams.some(t => t.id === team.id), 'Team appears in Sir pending requests');

    const approveRes = await request(testServer, 'POST', '/api/admin/approve-team', { teamId: team.id }, authHeaders);
    assert(approveRes.status === 200 && approveRes.data.success, 'Sir can approve team request');

    const approvedRes = await request(testServer, 'GET', '/api/admin/approved-teams', null, authHeaders);
    assert(approvedRes.data.teams.some(t => t.id === team.id), 'Team now appears in approved teams list');

    // Populate question bank: 1 Easy (10p), 1 Medium (20p), 1 Hard (30p) = 60 pts
    await request(testServer, 'POST', '/api/admin/questions', {
      title: 'Easy Palindrome Check',
      difficulty: 'Easy',
      points: 10,
      description: 'Check if string is palindrome'
    }, authHeaders);

    await request(testServer, 'POST', '/api/admin/questions', {
      title: 'Medium Matrix Spiral',
      difficulty: 'Medium',
      points: 20,
      description: 'Print matrix in spiral order'
    }, authHeaders);

    await request(testServer, 'POST', '/api/admin/questions', {
      title: 'Hard Graph Shortest Path',
      difficulty: 'Hard',
      points: 30,
      description: 'Find shortest path in weighted DAG'
    }, authHeaders);

    const questionsRes = await request(testServer, 'GET', '/api/admin/questions', null, authHeaders);
    assert(questionsRes.status === 200 && (questionsRes.data.bank || []).length >= 3, 'Question bank populated with 10p, 20p, 30p questions');

    // -------------------------------------------------------------
    // 6. EXAM-LOCK SCRIPT GENERATION & DOWNLOAD
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Exam-Lock Script Generation ---');
    const batRes = await request(testServer, 'GET', `/api/team/exam-lock-script/${team.username}`);
    assert(batRes.status === 200, 'GET /api/team/exam-lock-script returns 200');
    assert(typeof batRes.data === 'string' && batRes.data.includes('@echo off'), 'Generated file is valid Windows batch script');
    assert(batRes.data.includes('VSpark_Block_Outbound'), 'Script contains firewall rules');
    assert(batRes.data.includes('Emergency_Unlock.bat'), 'Script configures hidden emergency unlock path');
    assert(batRes.data.includes(team.username), 'Script contains team username identifier');

    // -------------------------------------------------------------
    // 7. TIMER START BLOCK CHECK 1: UNLOCKED PC GUARD & QUESTIONS GUARD
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Mandatory PC Lock Guard on Timer Start ---');
    const timerStartAttempt1 = await request(testServer, 'POST', '/api/admin/timer/start', {}, authHeaders);
    // Should be rejected because questions not assigned yet!
    assert(timerStartAttempt1.status === 400 && !timerStartAttempt1.data.success, 'Timer start correctly rejected before requirements met');

    // Assign questions to team so questions requirement is satisfied (60 pts)
    const presetRes = await request(testServer, 'POST', '/api/admin/team-questions/preset', {
      teamId: team.id,
      presetName: 'standard'
    }, authHeaders);
    assert(presetRes.status === 200 && presetRes.data.success, 'Preset 60-point questions assigned to approved team');

    // Try starting timer again - should still be blocked specifically due to PC Lock!
    const timerStartAttempt2 = await request(testServer, 'POST', '/api/admin/timer/start', {}, authHeaders);
    assert(timerStartAttempt2.status === 400, 'Timer start blocked when team has not locked PC');
    assert(timerStartAttempt2.data.message.includes('Exam-Lock') || timerStartAttempt2.data.message.includes('locked'), 'Error specifies PC Exam-Lock requirement');

    // -------------------------------------------------------------
    // 8. SIMULATING STUDENT PC LOCK & HEARTBEAT
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing PC Lock & Heartbeat ---');
    const lockRes = await request(testServer, 'POST', '/api/team/pc-lock', {
      passKey: team.username,
      status: 'locked'
    });
    assert(lockRes.status === 200 && lockRes.data.success, 'POST /api/team/pc-lock updates status to locked');

    const heartbeatRes = await request(testServer, 'POST', '/api/team/pc-heartbeat', {
      passKey: team.username
    });
    assert(heartbeatRes.status === 200 && heartbeatRes.data.success, 'POST /api/team/pc-heartbeat responds with contest status');

    // -------------------------------------------------------------
    // 9. TIMER START ALLOWED ONCE ALL LOCKED
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing Timer Start when All PCs Locked ---');
    const timerStartSuccess = await request(testServer, 'POST', '/api/admin/timer/start', {}, authHeaders);
    assert(timerStartSuccess.status === 200 && timerStartSuccess.data.success, 'Timer starts successfully when all approved teams have locked PCs & 60 pts');
    assert(timerStartSuccess.data.timer.status === 'running', 'Timer status is now running');

    // Pause timer
    const pauseRes = await request(testServer, 'POST', '/api/admin/timer/pause', {}, authHeaders);
    assert(pauseRes.status === 200 && pauseRes.data.timer.status === 'paused', 'Timer pauses successfully');

    // -------------------------------------------------------------
    // 10. CODE SUBMISSION & EVALUATION
    // -------------------------------------------------------------
    console.log('\n--- 10. Testing Code Submission ---');
    const teamProblemsRes = await request(testServer, 'GET', `/api/problems?teamId=${team.id}`);
    assert(teamProblemsRes.status === 200 && teamProblemsRes.data.problems.length > 0, 'Student can retrieve assigned problems');
    const testProblem = teamProblemsRes.data.problems[0];

    const subRes = await request(testServer, 'POST', '/api/submit', {
      username: team.username,
      problemId: testProblem.id,
      language: 'cpp',
      code: '#include <iostream>\nusing namespace std;\nint main() { cout << "Hello V Spark"; return 0; }'
    });
    assert(subRes.status === 201 && subRes.data.success, 'POST /api/submit accepts student code submission (201)');
    const subId = subRes.data.submission.id;
    assert(Boolean(subId), 'Submission record ID created');

    // Sir grades submission
    const gradeRes = await request(testServer, 'POST', '/api/admin/grade-submission', {
      submissionId: subId,
      score: testProblem.points,
      notes: 'Excellent code structure and logic'
    }, authHeaders);
    assert(gradeRes.status === 200 && gradeRes.data.success, 'Sir can adjust submission grade');

    // Sir awards bonus marks
    const bonusRes = await request(testServer, 'POST', '/api/submissions/bonus', {
      submissionId: subId,
      bonus: 5,
      reason: 'Optimal complexity bonus'
    }, authHeaders);
    assert(bonusRes.status === 200 && bonusRes.data.success, 'Sir can award bonus points');

    // -------------------------------------------------------------
    // 11. COMPETITION SNAPSHOT & HISTORY
    // -------------------------------------------------------------
    console.log('\n--- 11. Testing Competition History Snapshot ---');
    const snapshotRes = await request(testServer, 'POST', '/api/admin/competitions/snapshot', {
      title: 'Automated Test Round 1',
      description: 'Detailed test description for history'
    }, authHeaders);
    assert(snapshotRes.status === 200 && snapshotRes.data.success, 'POST /api/admin/competitions/snapshot archives contest');
    const snapId = snapshotRes.data.competition.id;
    assert(snapshotRes.data.competition.title === 'Automated Test Round 1', 'Snapshot retains custom title');
    assert(snapshotRes.data.competition.description === 'Detailed test description for history', 'Snapshot retains custom description');

    // Edit history item
    const editHistoryRes = await request(testServer, 'PUT', `/api/admin/competitions/${snapId}`, {
      title: 'Automated Test Round 1 (Updated)',
      description: 'Updated notes in history'
    }, authHeaders);
    assert(editHistoryRes.status === 200 && editHistoryRes.data.success, 'PUT /api/admin/competitions/:id updates history item');
    assert(editHistoryRes.data.competition.title === 'Automated Test Round 1 (Updated)', 'History item title updated');

    // -------------------------------------------------------------
    // 12. CLEANUP & RESET CONTEST
    // -------------------------------------------------------------
    console.log('\n--- 12. Testing Contest Reset ---');
    const resetRes = await request(testServer, 'POST', '/api/admin/reset-contest', {}, authHeaders);
    assert(resetRes.status === 200 && resetRes.data.success, 'POST /api/admin/reset-contest executes cleanly');

    console.log('\n================================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('[TEST SUITE CRASHED]:', err);
    failed++;
  } finally {
    testServer.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
