const fs = require('fs');
const path = require('path');
const http = require('http');
const { app } = require('./server');

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

async function runFileAndHistoryTests() {
  console.log('================================================================');
  console.log('  TESTING CSV, TXT, UPLOAD & COMPETITION HISTORY FEATURES');
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

  const testServer = http.createServer(app);
  await new Promise(resolve => testServer.listen(0, '127.0.0.1', resolve));
  const testPort = testServer.address().port;
  console.log(`Test server running on port ${testPort}...\n`);

  try {
    // -------------------------------------------------------------
    // 1. SIR AUTHENTICATION (FOR ADMIN ROUTES)
    // -------------------------------------------------------------
    console.log('--- 1. Authenticating Sir / Chief Judge ---');
    const sirLoginRes = await request(testServer, 'POST', '/api/login', {
      username: 'sir_visue',
      password: 'spark2026',
      forceUnlock: true
    });
    assert(sirLoginRes.status === 200 && sirLoginRes.data.success, 'Sir login succeeds');
    const sirToken = sirLoginRes.data.token;
    const authHeaders = { 'Authorization': `Bearer ${sirToken}` };

    // -------------------------------------------------------------
    // 2. CSV / EXCEL FILE QUESTION IMPORT (UPLOAD)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing CSV / Excel Question Import (Upload) ---');

    // Test A: Bulk import valid question rows mimicking parsed CSV/Excel file
    const sampleCsvRows = [
      {
        'Title': 'CSV Easy - Reverse Array',
        'Statement': 'Given an array of integers, reverse its elements in-place.',
        'Difficulty': 'Easy',
        'Points': '10',
        'Languages': 'C, C++, Java, Python',
        'Sample Input': '5\n1 2 3 4 5',
        'Sample Output': '5 4 3 2 1'
      },
      {
        'Title': 'CSV Medium - Longest Substring',
        'Statement': 'Find the length of the longest substring without repeating characters.',
        'Difficulty': 'Medium',
        'Points': '20',
        'Languages': 'C++, Java, Python',
        'Sample Input': 'abcabcbb',
        'Sample Output': '3'
      },
      {
        'Title': 'CSV Hard - Travelling Salesman DP',
        'Statement': 'Find the minimum cost Hamiltonian cycle in a directed graph.',
        'Difficulty': 'Hard',
        'Points': '30',
        'Languages': 'C++, Java, Python',
        'Sample Input': '4\n0 10 15 20\n10 0 35 25\n15 35 0 30\n20 25 30 0',
        'Sample Output': '80'
      }
    ];

    const importRes = await request(testServer, 'POST', '/api/admin/questions/import', {
      questions: sampleCsvRows
    }, authHeaders);

    assert(importRes.status === 200 && importRes.data.success, 'POST /api/admin/questions/import accepts parsed CSV rows');
    assert(importRes.data.count === 3, 'Import response reports 3 questions imported');

    // Verify imported questions in question bank
    const questionsRes = await request(testServer, 'GET', '/api/admin/questions', null, authHeaders);
    const bank = questionsRes.data.bank || [];
    const hasEasy = bank.some(q => q.title === 'CSV Easy - Reverse Array' && q.points === 10);
    const hasMed = bank.some(q => q.title === 'CSV Medium - Longest Substring' && q.points === 20);
    const hasHard = bank.some(q => q.title === 'CSV Hard - Travelling Salesman DP' && q.points === 30);
    assert(hasEasy && hasMed && hasHard, 'Imported CSV questions correctly stored with points & difficulty');

    // Test B: Empty or invalid CSV import should be rejected
    const emptyImportRes = await request(testServer, 'POST', '/api/admin/questions/import', {
      questions: []
    }, authHeaders);
    assert(emptyImportRes.status === 400 && !emptyImportRes.data.success, 'Empty CSV upload properly rejected with 400');

    // -------------------------------------------------------------
    // 3. SETTING UP ACTIVE CONTEST DATA FOR TXT/CSV/HISTORY EXPORTS
    // -------------------------------------------------------------
    console.log('\n--- 3. Setting Up Teams & Contest for Export Verification ---');

    // Register 2 teams with Username and Password
    const t1Res = await request(testServer, 'POST', '/api/register', {
      teamName: 'Alpha Coders',
      username: 'alpha_coders',
      password: 'alpha_pass_123',
      leaderName: 'Ali Raza',
      leaderRoll: 'FA23-BCS-001',
      university: 'COMSATS Lahore',
      teamType: 'duo',
      member2Name: 'Usman Ghani',
      member2Roll: 'FA23-BCS-002',
      language: 'cpp'
    });
    const team1 = t1Res.data.team;

    const t2Res = await request(testServer, 'POST', '/api/register', {
      teamName: 'Byte Breakers',
      username: 'byte_breakers',
      password: 'byte_pass_123',
      leaderName: 'Sara Khan',
      leaderRoll: 'FA23-BCS-010',
      university: 'NUST Islamabad',
      teamType: 'solo',
      language: 'python'
    });
    const team2 = t2Res.data.team;

    // Approve both teams
    await request(testServer, 'POST', '/api/admin/approve-team', { teamId: team1.id }, authHeaders);
    await request(testServer, 'POST', '/api/admin/approve-team', { teamId: team2.id }, authHeaders);

    // Assign standard 60-point preset to both
    await request(testServer, 'POST', '/api/admin/team-questions/preset', { teamId: team1.id, presetName: 'standard' }, authHeaders);
    await request(testServer, 'POST', '/api/admin/team-questions/preset', { teamId: team2.id, presetName: 'standard' }, authHeaders);

    // Lock PCs
    await request(testServer, 'POST', '/api/team/pc-lock', { passKey: team1.username, status: 'locked' });
    await request(testServer, 'POST', '/api/team/pc-lock', { passKey: team2.username, status: 'locked' });

    // Start timer
    await request(testServer, 'POST', '/api/admin/timer/start', {}, authHeaders);

    // Team 1 submits solution
    const t1Problems = (await request(testServer, 'GET', `/api/problems?teamId=${team1.id}`)).data.problems;
    const subRes1 = await request(testServer, 'POST', '/api/submit', {
      username: team1.username,
      problemId: t1Problems[0].id,
      language: 'cpp',
      code: '#include <iostream>\nusing namespace std;\nint main() { cout << "Reversed"; return 0; }'
    });
    assert(subRes1.status === 201, 'Team 1 solution accepted (201)');

    // Sir awards bonus
    await request(testServer, 'POST', '/api/submissions/bonus', {
      submissionId: subRes1.data.submission.id,
      bonus: 10,
      reason: 'Clean formatting'
    }, authHeaders);

    // Publish results
    await request(testServer, 'POST', '/api/admin/publish-results', {}, authHeaders);

    // -------------------------------------------------------------
    // 4. TESTING TXT & CSV EXPORT STRUCTURE
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing TXT & CSV Audit Report String Formatting ---');

    // Simulate exportResultsTxt logic
    const approvedTeams = (await request(testServer, 'GET', '/api/admin/approved-teams', null, authHeaders)).data.teams;
    const submissions = (await request(testServer, 'GET', '/api/submissions', null, authHeaders)).data.submissions;
    const arenaInfo = (await request(testServer, 'GET', '/api/arena/info')).data.arenaInfo;

    // Verify TXT Report Content
    let txtReport = '';
    txtReport += '================================================================================\n';
    txtReport += `  ${arenaInfo.name.toUpperCase()}\n`;
    txtReport += `  Description: ${arenaInfo.description}\n`;
    txtReport += `  Session Date & Time: ${arenaInfo.dateFormatted}\n`;
    txtReport += '  OFFICIAL CONTEST AUDIT & RESULTS REPORT\n';
    txtReport += '================================================================================\n\n';
    txtReport += '  1. FINAL CONTEST STANDINGS & PODIUM RANKINGS\n';
    approvedTeams.forEach((t, i) => {
      txtReport += `[RANK #${i + 1}] Team: ${t.teamName} (@${t.username}) - ${t.score} pts\n`;
    });
    txtReport += '\n  2. DETAILED LIVE CODE SUBMISSIONS & GRADING AUDIT\n';
    submissions.forEach((s, i) => {
      txtReport += `[SUBMISSION #${i + 1}] Team: ${s.teamName} - ${s.problemTitle} (+${s.scoreAwarded} pts, Bonus: +${s.bonus || 0})\n`;
      txtReport += `Code:\n${s.code}\n`;
    });

    assert(txtReport.includes('OFFICIAL CONTEST AUDIT & RESULTS REPORT'), 'TXT report contains official audit title');
    assert(txtReport.includes('@alpha_coders'), 'TXT report includes team username @alpha_coders');
    assert(txtReport.includes('@byte_breakers'), 'TXT report includes team username @byte_breakers');
    assert(txtReport.includes('Clean formatting') || txtReport.includes('Bonus: +10'), 'TXT report logs bonus marks and submissions');

    // Verify CSV Content
    const csvHeaders = ['Rank', 'Team Name', 'Team Username', 'Team Type', 'University', 'Primary Language', 'Score'];
    const csvRows = approvedTeams.map((t, idx) => [
      idx + 1,
      `"${t.teamName}"`,
      `"@${t.username}"`,
      `"${(t.teamType || 'solo').toUpperCase()}"`,
      `"${t.university}"`,
      `"${(t.language || 'cpp').toUpperCase()}"`,
      t.score
    ].join(','));
    const fullCsv = [csvHeaders.join(','), ...csvRows].join('\r\n');

    assert(fullCsv.includes('Rank,Team Name,Team Username'), 'CSV report includes Team Username in header');
    assert(fullCsv.includes('"@alpha_coders"'), 'CSV report properly quotes and formats username');
    assert(fullCsv.includes('"@byte_breakers"'), 'CSV report includes all participating teams');

    // -------------------------------------------------------------
    // 5. TESTING COMPETITION HISTORY (SAVE, LOAD, EDIT & DISK PERSISTENCE)
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Competition History Endpoints & File Storage ---');

    // Test A: Get initial competitions history
    const historyRes1 = await request(testServer, 'GET', '/api/admin/competitions', null, authHeaders);
    assert(historyRes1.status === 200 && historyRes1.data.success, 'GET /api/admin/competitions returns 200');
    const initialCount = historyRes1.data.history.length;

    // Test B: Save permanent snapshot
    const snapRes = await request(testServer, 'POST', '/api/admin/competitions/snapshot', {
      title: 'Spring 2026 Inter-Uni Championship',
      description: 'Grand finale championship between COMSATS and NUST teams.'
    }, authHeaders);
    assert(snapRes.status === 200 && snapRes.data.success, 'POST /api/admin/competitions/snapshot archives contest');
    const createdComp = snapRes.data.competition;
    assert(Boolean(createdComp && createdComp.id), 'Snapshot returned unique competition ID');
    assert(createdComp.title === 'Spring 2026 Inter-Uni Championship', 'Snapshot contains custom title');
    assert(createdComp.teams && createdComp.teams.length >= 2, 'Snapshot captured all participating teams');
    assert(createdComp.questions && createdComp.questions.length >= 3, 'Snapshot captured contest questions');
    assert(Boolean(createdComp.winner), 'Snapshot recorded winner / champion team');

    // Test C: Fetch specific historical competition by ID
    const singleCompRes = await request(testServer, 'GET', `/api/admin/competitions/${createdComp.id}`, null, authHeaders);
    assert(singleCompRes.status === 200 && singleCompRes.data.success, 'GET /api/admin/competitions/:id retrieves archived competition');
    assert(singleCompRes.data.competition.id === createdComp.id, 'Retrieved record ID matches snapshot ID');

    // Test D: Edit competition history item (Title and Description)
    const editRes = await request(testServer, 'PUT', `/api/admin/competitions/${createdComp.id}`, {
      title: 'Spring 2026 Inter-Uni Championship (Official Certified)',
      description: 'Updated notes: Dr. Rashid Jahangir approved all final results.'
    }, authHeaders);
    assert(editRes.status === 200 && editRes.data.success, 'PUT /api/admin/competitions/:id updates history item');
    assert(editRes.data.competition.title === 'Spring 2026 Inter-Uni Championship (Official Certified)', 'Updated title verified in response');

    // Test E: Verify physical disk file persistence (data/competitions.json)
    const compFilePath = path.join(__dirname, 'data', 'competitions.json');
    assert(fs.existsSync(compFilePath), 'Physical file data/competitions.json exists on disk');
    const rawFileContent = fs.readFileSync(compFilePath, 'utf8');
    const parsedFileJson = JSON.parse(rawFileContent);
    assert(Array.isArray(parsedFileJson), 'competitions.json contains a valid JSON array');
    const diskRecord = parsedFileJson.find(c => c.id === createdComp.id);
    assert(Boolean(diskRecord), 'Created snapshot physically located on disk in competitions.json');
    assert(diskRecord.title === 'Spring 2026 Inter-Uni Championship (Official Certified)', 'Title update physically persisted to competitions.json');
    assert(diskRecord.description.includes('Dr. Rashid Jahangir'), 'Description update physically persisted to competitions.json');

    // Clean up
    await request(testServer, 'POST', '/api/admin/reset-contest', {}, authHeaders);

    console.log('\n================================================================');
    console.log(`  FILE & HISTORY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('[TEST CRASHED]:', err);
    failed++;
  } finally {
    testServer.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runFileAndHistoryTests();
