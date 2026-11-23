# ⚡ V Spark 2026 — Inter-University Programming Arena
### 🏛️ COMSATS University Islamabad, Vehari Campus • Department of Computer Science
> **Flagship Project:** Advanced Web Technologies (CS-302)  
> **Lead Developer:** **Muhammad Rehan** (BS Software Engineering)  
> 🌐 **Live Website (Render):** [https://visue-spark-arena.onrender.com](https://visue-spark-arena.onrender.com)

---

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render%20Cloud-success?style=for-the-badge&logo=render)](https://visue-spark-arena.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-Framework-lightgrey?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-black?style=for-the-badge&logo=socket.io)](https://socket.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Responsive%20UI-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Security](https://img.shields.io/badge/Security-JWT%20%26%20Anti--Cheat-red?style=for-the-badge&logo=shield)](https://jwt.io/)

---

## 🔗 Quick Links

| Resource | URL |
| :--- | :--- |
| 🌐 **Live Web Application** | **[https://visue-spark-arena.onrender.com](https://visue-spark-arena.onrender.com)** |
| 🧑‍💻 **Student Contest Arena** | **[https://visue-spark-arena.onrender.com/#arena](https://visue-spark-arena.onrender.com/#arena)** |
| 🏆 **Live Podium Standings** | **[https://visue-spark-arena.onrender.com/#podium](https://visue-spark-arena.onrender.com/#podium)** |
| 🧑‍🏫 **Sir / Admin Control Desk** | **[https://visue-spark-arena.onrender.com/#admin](https://visue-spark-arena.onrender.com/#admin)** |
| 👑 **Super Admin Control** | **[https://visue-spark-arena.onrender.com/#superadmin](https://visue-spark-arena.onrender.com/#superadmin)** |
| 📂 **GitHub Repository** | **[https://github.com/rehankhansahu/visue-spark-arena](https://github.com/rehankhansahu/visue-spark-arena)** |

---

## 📌 Executive Summary (What is V Spark 2026?)

**V Spark 2026** is a **real-time competitive programming arena and automated contest management system** built for university programming competitions. It replaces manual grading, paper tests, and disconnected Google Forms with a synchronized, high-speed, esports-style coding platform.

Students write code in their web browsers, while teachers (Sir/Judges) have complete real-time authority over registration approvals, countdown timers, live grading, anti-cheating enforcement, and final podium awards.

---

## 🎯 Key Problems Solved

1. **Eliminates Manual Checking:** Instant code submission with manual evaluation tools and bonus points.
2. **Synchronized Live Timer:** Contest countdown runs on the server; every student's laptop is synced via WebSockets.
3. **Anti-Cheating Security (PC Exam-Lock):** 1-Click Windows script blocks internet (ChatGPT, Google, WhatsApp) while keeping the contest website open.
4. **Fair & Masked Evaluation:** Student scores remain masked during the contest and are only revealed when Sir clicks **"Publish Results"**.
5. **Latest Winner Retention:** When Sir resets the contest for the next round, the podium automatically shows the champions of the latest competition instead of an empty screen.

---

## 🏗️ System Architecture & Technology Stack

```
               [ Clients / Students & Teachers ]
             (Browser: HTML5 / Tailwind / Vanilla JS)
                               ▲
                               │  Bi-directional Real-Time Events (Socket.IO)
                               │  REST API Calls with JWT (HTTP / JSON)
                               ▼
                    [ Node.js / Express Server ]
     ┌─────────────────────────┼─────────────────────────┐
     │                         │                         │
[ Routes & Middlewares ]  [ Socket.IO Engine ]    [ State Manager ]
 • authRoutes.js           • Timer Broadcast       • store.js (RAM Cache)
 • studentRoutes.js        • Approvals & Submissions
 • submissionRoutes.js     • Tamper Heartbeat
 • superAdminRoutes.js
                               │
                               ▼
               [ Hybrid Persistence Layer (Disk) ]
         • competitions.json  (Permanent contest snapshots)
         • problems.json      (Question bank & test cases)
         • teachers.json      (Hashed teacher credentials)
         • settings.json      (Site & contest metadata)
```

### Technology Breakdown:
- **Backend:** Node.js, Express.js (v4.x)
- **Real-Time Layer:** Socket.IO (v4.x) for zero-latency timer sync and instant updates.
- **Security:** JSON Web Tokens (JWT) for Sir/Super Admin, custom session PassKeys for teams.
- **Frontend:** Single Page Application (SPA), HTML5, Vanilla JavaScript (ES6+), Tailwind CSS, Custom Glassmorphism.
- **Excel Engine:** Integrated SheetJS (`xlsx`) for 1-click bulk question import and audit exports.
- **Deployment:** Hosted live on Render Cloud.

---

## 💾 Database Architecture (Viva Explanation)

> **"Why was a Hybrid In-Memory + JSON Document Store chosen instead of heavy external SQL/MongoDB?"**

1. **Ultra-Low Latency (RAM):**
   - In a 90-minute competitive exam, hundreds of students send continuous heartbeats, code runs, and timer queries every second.
   - Using JavaScript memory structures (`Map`, `Array`, `Set`) gives **0-millisecond response time** without database connection bottlenecks.
2. **Permanent File Persistence (`fs` JSON Documents):**
   - Completed contests, winners, question bank, and teacher accounts are written to disk as structured JSON documents (`data/competitions.json`, `data/teachers.json`).
   - Server restarts or redeployments retain all previous competitions and winner histories.
3. **Self-Contained & Zero External Dependencies:**
   - The entire system can run offline in a university computer lab on a local LAN server without requiring external cloud database subscriptions.

---

## ✨ Core System Features

### 1. 🎫 Student Contest Pass & Login
- Solo and Duo team registration with validated roll numbers (`SP24-BSE-045`, `FA24-BCS-012`).
- 6-Digit secret session PassKey allows students to resume sessions or switch computers seamlessly.
- Sir approval workflow: registrations remain "Pending" until Sir clicks **Approve**.

### 2. 🔒 Anti-Cheat PC Exam-Lock (.bat Script)
- Each student downloads a personalized 1-Click Windows script (`.bat`).
- Uses Windows `netsh advfirewall` to temporarily block all outside internet traffic (Google, ChatGPT, social media) while whitelisting the contest arena URL.
- **Heartbeat & Tamper Watchdog:** The script pings the server every few seconds. If a student closes the script or reconnects Wi-Fi, Sir gets an instant tamper alarm on the Admin screen!
- **1-Click Restore:** When the student exits or contest ends, `Restore-Internet.bat` restores normal internet settings.

### 3. ⚡ Speed Arena (Coding IDE)
- Supports **8 Programming Languages:** C, C++, Java, Python, HTML, JavaScript, Dart, and PHP.
- In-browser code editor with syntax formatting, dark/light mode, and custom test-case inputs.
- Structured **60-Points Budget**:
  - 🟢 **Easy Challenge:** 10 Points
  - 🔵 **Medium Challenge:** 20 Points
  - 🟠 **Hard Challenge:** 30 Points

### 4. 🧑‍🏫 Sir / Judge Admin Cockpit
- **Authoritative Timer:** Start, Pause, Resume, and Reset the contest timer.
- **Live Submission Grader:** Inspect student code with light/dark syntax highlighting, award marks, and add judge bonus points.
- **Question Bank Manager:** Add questions manually or import directly from Excel/CSV files.
- **Audit Reports:** Export complete contest summaries to **Excel (.xlsx)** or printable **Audit Text (.txt)**.

### 5. 🏆 Podium & Real-Time Standings
- Esports-style visual podium for 1st Place (Champion), 2nd Place (Runner Up), and 3rd Place.
- **Masked Evaluation:** Standings remain hidden until Sir finishes grading and clicks **"Publish Results"**.
- **Archive Fallback:** When Sir resets the contest for a new round, the podium displays the champions of the latest contest with an archive banner.

---

## 📂 Project Structure Map

```plaintext
visue-spark-arena/
├── data/
│   ├── store.js               # Central state manager (Single Source of Truth)
│   ├── examLockGenerator.js   # Dynamic Windows .bat firewall generator
│   ├── competitions.json      # Permanent history of finished contests
│   ├── problems.json          # Problem bank & test cases
│   ├── teachers.json          # Teacher credentials & roles
│   └── arena_info.json        # Active arena title & duration
├── middleware/
│   ├── auth.js                # JWT verification (verifySirToken, verifySuperAdminToken)
│   └── validator.js           # Student input validation
├── public/                    # Frontend Single Page App (SPA)
│   ├── index.html             # Main HTML container (Arena, Pass, Admin, Podium)
│   ├── css/styles.css         # Glassmorphism & custom styling
│   ├── js/app.js              # View switcher, modals & notification controller
│   ├── js/arena.js            # Coding editor, test case runner & language switcher
│   ├── js/admin.js            # Sir Desk controller, grading & question bank UI
│   ├── js/socket.js           # Socket.IO real-time event listeners
│   └── vendor/xlsx.full.min.js# Local Excel/CSV engine (SheetJS)
├── routes/
│   ├── authRoutes.js          # Sir/Admin login & JWT issuance
│   ├── studentRoutes.js       # Student registration, login, problems, exam-lock scripts
│   ├── submissionRoutes.js    # Code submit, grading, timer controls, results publishing
│   └── superAdminRoutes.js    # Super Admin teacher management
├── server.js                  # Main server entry point (Express + Socket.IO)
└── README.md                  # Complete documentation manual
```

---

## 🎯 Top 5 Viva Questions & Simple Answers (Examiner Cheat Sheet)

#### Q1: "How does real-time synchronization work without refreshing pages?"
> **Answer:** We use **Socket.IO (WebSockets)**. The server and clients maintain an open, full-duplex TCP connection. When Sir starts the timer or approves a team, the server emits a socket event (e.g. `timerStatusChange`, `teamApproved`), and all student screens update instantly.

#### Q2: "How is the timer handled? Can a student cheat by changing their laptop clock?"
> **Answer:** The timer is **Server-Authoritative** inside `data/store.js`. The server calculates remaining seconds based on server system time. The student's browser only renders the remaining seconds sent by the server, making local clock changes ineffective.

#### Q3: "How does your Anti-Cheat Exam-Lock work?"
> **Answer:** The server dynamically generates a custom Windows batch script (`.bat`) containing `netsh advfirewall` commands. It blocks all outgoing traffic except the contest server's IP/domain and sends background heartbeats. If a student terminates the script, the server's watchdog triggers a tamper alert to Sir.

#### Q4: "Where is data stored if you don't use MySQL or MongoDB?"
> **Answer:** We implemented a **Hybrid Architecture** (`data/store.js`). Active contest sessions and submissions are stored in memory (`Map`/`Array`) for zero latency during the live competition. When a contest completes or is reset, snapshots are permanently saved to disk in JSON files (`data/competitions.json`).

#### Q5: "How is security and authentication enforced?"
> **Answer:** Faculty/Judges authenticate via **JWT (JSON Web Tokens)** passed in the HTTP Authorization header (`Bearer <token>`). Route access is secured through Express middleware (`verifySirToken`). Students use a unique verified PassKey generated at registration.

---

## 🚀 Running the Project Locally

### 1. Prerequisites
- **Node.js** (v18.0 or higher) installed on your system.

### 2. Clone & Install
```bash
git clone https://github.com/rehankhansahu/visue-spark-arena.git
cd visue-spark-arena
npm install
```

### 3. Start the Server
```bash
npm start
```
*Or with automatic reload during development:*
```bash
npm run dev
```

### 4. Open in Browser
- **Student Arena:** `http://localhost:3000`
- **Admin / Sir Desk:** `http://localhost:3000/#admin`

---

## 🔑 Default Admin Credentials

| Role | Username | Password | Access URL |
| :--- | :--- | :--- | :--- |
| **Faculty Judge (Sir)** | `sir_visue` | `spark2026` | `/#admin` |
| **Super Admin** | `superadmin` | `spark2026` | `/#superadmin` |

---

## 👨‍💻 Developer & Project Credits

- **Developer:** **Muhammad Rehan**
- **Degree:** BS Software Engineering
- **Institution:** COMSATS University Islamabad, Vehari Campus
- **Course:** Advanced Web Technologies
- **Portfolio:** [rehankhansahu.github.io/muhammad-rehan-portfolio](https://rehankhansahu.github.io/muhammad-rehan-portfolio/)
- **Live Platform:** [https://visue-spark-arena.onrender.com](https://visue-spark-arena.onrender.com)
