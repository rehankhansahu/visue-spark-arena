// ============================================================================
// V Spark 2026 - Main Server Entry Point
// Inter-University Programming Arena (90-Minute Contest)
// Topics: Node.js, Express, REST APIs (L5), Socket.IO (L7), JWT Auth (L9), Validation (L11-12)
// ============================================================================

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const store = require('./data/store');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');

// Initialize Express App & HTTP Server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach io instance to express app so routes can broadcast events
app.set('io', io);

// Port Configuration
const PORT = process.env.PORT || 3000;

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.startsWith('/css') && !req.url.startsWith('/js') && !req.url.includes('.')) {
      console.log(`[HTTP] ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api', authRoutes);
app.use('/api', studentRoutes);
app.use('/api', submissionRoutes);
app.use('/api/superadmin', superAdminRoutes);

// Single Page Application Fallback
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Real-Time Socket.IO Engine
let activeSocketsCount = 0;

io.on('connection', (socket) => {
  activeSocketsCount++;
  console.log(`[Socket.IO] Client connected: ${socket.id} (Active: ${activeSocketsCount})`);

  // Broadcast current active connection count to all clients
  io.emit('statsUpdate', {
    activeUsers: activeSocketsCount,
    totalSubmissions: store.getAllSubmissions().length,
    totalTeams: store.getAllTeams().length
  });

  // Send current real-time leaderboard snapshot immediately on connect
  socket.emit('leaderboardUpdate', {
    leaderboard: store.getLeaderboard(),
    event: 'INITIAL_SYNC'
  });

  // Client requests manual sync
  socket.on('requestLeaderboard', () => {
    socket.emit('leaderboardUpdate', {
      leaderboard: store.getLeaderboard(),
      event: 'CLIENT_REQUEST'
    });
  });

  // Client disconnect
  socket.on('disconnect', () => {
    activeSocketsCount = Math.max(0, activeSocketsCount - 1);
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (Active: ${activeSocketsCount})`);
    io.emit('statsUpdate', {
      activeUsers: activeSocketsCount,
      totalSubmissions: store.getAllSubmissions().length,
      totalTeams: store.getAllTeams().length
    });
  });
});

// Periodic PC Exam-Lock Tamper Watchdog (every 6 seconds)
setInterval(() => {
  try {
    const tamperedTeams = store.checkTeamTamperStatus();
    if (tamperedTeams && tamperedTeams.length > 0) {
      tamperedTeams.forEach((team) => {
        io.emit('teamTamperAlert', {
          teamId: team.id,
          teamName: team.teamName,
          leaderName: team.leaderName,
          university: team.university,
          message: `⚠️ Alert: Team "${team.teamName}" PC lock script heartbeat stopped or closed!`
        });
        io.emit('teamLockStatusChanged', {
          teamId: team.id,
          teamName: team.teamName,
          leaderName: team.leaderName,
          pcLockStatus: team.pcLockStatus,
          pcLockedAt: team.pcLockedAt,
          pcTamperAlert: true
        });
      });
    }
  } catch (e) {
    console.error('[Watchdog Error]:', e.message);
  }
}, 6000);

// Start Server
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(74));
  console.log('  ⚡ V Spark 2026 - Inter-University Programming Arena');
  console.log('  🏆 Questions: Easy (10pts), Medium (20pts), Hard (30pts) = 60 Pts Total');
  console.log('  💻 Languages: C, C++, Java, Python (VS Code / External IDEs Supported)');
  console.log('  👥 Teams: Solo or Duo (Max 2 Members) from Any University');
  console.log('  ⏳ Contest Duration: 90 Minutes');
  console.log('  🔒 Sir Approval Workflow: Active (Student request must be accepted)');
  console.log('='.repeat(74));
  console.log(`  🌐 Server running at:       http://localhost:${PORT}`);
  console.log(`  🔌 Real-Time Socket.IO:    CONNECTED & READY`);
  console.log('='.repeat(74) + '\n');
});

module.exports = { app, server };
