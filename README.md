# ⚡ VISUE SPARK 2026 — Inter-University Programming Arena
### 🏛️ COMSATS University Islamabad, Vehari Campus • Department of Computer Science
> **Flagship Semester Project** developed for **"Advanced Web Technologies"** (CS-302)  
> **Lead Developer & Creator:** **Muhammad Rehan** (BS Software Engineering, COMSATS Vehari Campus)

---

![Project Status](https://img.shields.io/badge/Status-Production%20Ready-emerald?style=for-the-badge&logo=rocket)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-Framework-lightgrey?style=for-the-badge&logo=express)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-black?style=for-the-badge&logo=socket.io)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Responsive%20UI-06B6D4?style=for-the-badge&logo=tailwindcss)
![Theme](https://img.shields.io/badge/Themes-Dark%20%26%20Light%20Cyber-purple?style=for-the-badge)

---

## 📌 Project Overview & Purpose (Kyun Banaya?)

### 💡 Background & Motivation
Traditional inter-university hackathons, lab assessments, and coding competitions in universities often suffer from:
1. **Manual & Slow Grading:** Teachers and judges manually check code snippets, resulting in lengthy evaluation delays and student frustration.
2. **Lack of Real-Time Engagement:** Standard learning management systems (LMS) do not provide live leaderboards, making competitive events feel disconnected.
3. **Clunky Onboarding:** Complicated registration procedures waste valuable competition time.
4. **Poor Judge Oversight:** Judges lack an interactive administrative cockpit to monitor student progress, inspect live submissions, grant bonus points, or pause/resume/reset competition timers globally.

### 🎯 The Solution: VISUE SPARK 2026
**VISUE SPARK 2026** is a **full-stack, real-time, interactive competitive programming arena** created to digitize and elevate programming contests. Engineered specifically for university environments, it brings a competitive esports-style coding experience right to students' web browsers while giving faculty judges 100% control through a secure real-time command center.

---

## 👨‍💻 Developer Profile

| Attribute | Details |
| :--- | :--- |
| **Developer Name** | **Muhammad Rehan** |
| **Degree Program** | Bachelor of Science in Software Engineering (BS SE) |
| **Institution** | COMSATS University Islamabad, Vehari Campus |
| **Department** | Department of Computer Science |
| **Course** | Advanced Web Technologies |
| **GitHub** | [@rehankhansahu](https://github.com/rehankhansahu) |
| **Repository** | [rehankhansahu/visue-spark-arena](https://github.com/rehankhansahu/visue-spark-arena) |

---

## ✨ Core Features & Architectural Highlights

### 1. 🎫 Student Holographic Contest Pass
- **Solo & Duo Team Modes:** Students can register individually or in pairs.
- **Strict RegEx Eligibility Validation:** Restricts roll numbers to authentic COMSATS formats (`SP24-BSE-045`, `FA24-BCS-012`).
- **Dynamic Avatar / Profile Picture Upload:** Displays custom team logos/avatars across the Arena, Podium, and Sir's Desk.
- **6-Digit Secret Session Key:** Allows students to restore active sessions or switch devices without losing state or submissions.
- **Contest Lifecycle Protection:** Automatically locks registrations when a contest is currently in-flight or ended until Sir explicitly resets the session.

### 2. ⚡ Interactive Speed Arena (IDE & Test Runner)
- **Multi-Language Support:** First-class syntax support for **C, C++, Java, and Python**.
- **Integrated Code Workspace:** In-browser code editor with dark/light themes, keyboard navigation, and auto-indentation.
- **Multi-Difficulty Problem Slots:** Dynamically rendered challenge sets categorized by difficulty:
  - 🟢 **Easy (10 Points)**
  - 🔵 **Medium (20 Points)**
  - 🟠 **Hard (30 Points)**
  - Total Target: **60 Points Budget**
- **Instant Code Submission & Feedback:** Live verification against hidden and sample test cases with runtime execution output.

### 3. 🏆 Real-Time Podium & Arena Hall of Fame
- **Synchronized WebSocket Updates:** Top teams re-rank dynamically as scores are awarded with zero page reload.
- **Esports-Style Podium Display:** Visual pedestal for 1st Place (Champion Winner), 2nd Place (Runner-up), and 3rd Place (2nd Runner-up).
- **Masked vs. Published Standings:** Keeps scores hidden from public view until the judge publishes final official results.
- **Score Breakdown Badges:** Detailed per-problem points breakdown (`Easy: +10p`, `Medium: +20p`, `Hard: +30p`).
- **Previous Test Standings Archive:** Displays archived results from preceding rounds without overwriting current data.

### 4. 🧑‍🏫 Sir's Desk (Administrative Cockpit)
- **JWT-Secured Judge Authentication:** Role-based access control (RBAC) protecting judge operations.
- **Live Contest Timer Machine:** 
  - Set custom durations (e.g., 90 minutes).
  - Start, Pause, Resume, and Full State Reset.
  - Broadcasts time left to every connected student in real time via Socket.IO.
- **Question Bank Manager:**
  - Create, view, edit, and toggle active status for contest challenges.
  - Total points budget validator (maintains standard 60-point cap).
- **Team Verification & Approval:** Live pending registration queue with one-click approve/reject actions.
- **Live Code Inspector & Grading:** View submitted code in a syntax-highlighted modal in both light and dark themes with full zoom support.
- **Bonus & Penalty Engine:** Judge can award custom bonuses or deduct points with real-time audio and visual announcements.

### 5. 🎨 UI/UX Excellence
- **Zero Scrollbar 100vh Layout:** Perfectly calibrated CSS Grid and Flexbox system so all views fit within standard displays without ugly outer scrollbars.
- **High-Contrast Dark & Light Modes:** Cyberpunk neon aesthetics for dark mode alongside a crisp, accessible light mode.
- **Canvas Confetti & Sound Effects:** Celebratory animations upon finishing challenges and publishing winners.

---

## 📚 Syllabus Alignment — "Advanced Web Technologies"

This platform serves as a practical, comprehensive capstone implementation of the Advanced Web Technologies curriculum:

| Lecture Reference | Curriculum Topic | Implementation in VISUE SPARK Arena |
| :--- | :--- | :--- |
| **Lecture 5** | **Express RESTful APIs** | Clean REST design with dedicated routers (`routes/studentRoutes.js`, `routes/authRoutes.js`, `routes/submissionRoutes.js`) utilizing proper HTTP methods (`GET`, `POST`, `PUT`, `DELETE`) and standard status codes (`200`, `201`, `400`, `401`, `403`, `500`). |
| **Lecture 7** | **Real-Time WebSockets (Socket.IO)** | Bi-directional communication channel (`public/js/socket.js`, `server.js`) broadcasting `timerSync`, `leaderboardUpdate`, `teamApproved`, `codeSubmitted`, and `resultsPublished` events to all clients instantly. |
| **Lecture 9** | **Lightweight Auth & RBAC** | Stateless JWT authentication (`jsonwebtoken`) with token signature verification, authorization header parsing, and `verifySirToken` route guard middleware (`middleware/auth.js`). |
| **Lectures 11 & 12** | **API Security & Data Validation** | Strict input validation via `express-validator` (`middleware/validator.js`), CORS policy restrictions, parameterized queries/sanitization, and strict regex matching for student IDs. |

---

## 🛠️ Technology Stack

```
visue-spark-arena/
├── Backend:       Node.js, Express.js (v4.x)
├── WebSockets:    Socket.IO (v4.x)
├── Security:      JSON Web Tokens (JWT), Express-Validator, CORS
├── Frontend:      HTML5, Vanilla ES6+ JavaScript, Tailwind CSS
├── Visuals:       FontAwesome 6, Canvas-Confetti, Google Fonts (Outfit & JetBrains Mono)
└── Deployment:    Ready for Railway, Render, Docker, or Node Host
```

---

## 📂 Project Directory Structure

```plaintext
visue-spark-arena/
├── data/
│   ├── problems.json          # Pre-configured & custom competitive challenges
│   └── store.js               # Central in-memory state engine & persistence
├── middleware/
│   ├── auth.js                # JWT verification & Judge RBAC middleware
│   └── validator.js           # Student input & registration validator
├── public/
│   ├── css/
│   │   └── styles.css         # Cyberpunk design system, responsive styles, animations
│   ├── js/
│   │   ├── admin.js           # Sir's Desk controller, grading, and timer engine
│   │   ├── app.js             # Client routing, holographic pass, leaderboard & themes
│   │   ├── arena.js           # Coding IDE, test runner, syntax, and submissions
│   │   └── socket.js          # Socket.IO client-side real-time event listeners
│   └── index.html             # Single-Page Application (SPA) container
├── routes/
│   ├── authRoutes.js          # Judge login and token verification endpoints
│   ├── studentRoutes.js       # Registration, profile picture upload, session restore
│   └── submissionRoutes.js    # Problem fetching, code evaluation, grading endpoints
├── .gitignore                 # Excludes node_modules, temp files, and credentials
├── package.json               # Project manifest, scripts, and dependencies
├── server.js                  # Main entry point (HTTP + WebSocket server)
├── START_ARENA.bat            # 1-Click Windows desktop launcher
└── README.md                  # Detailed documentation and project manual
```

---

## 🚀 Getting Started Locally

### 1. Prerequisites
Ensure you have **Node.js** (v18.0 or higher) and **npm** installed on your system.

### 2. Clone the Repository
```bash
git clone https://github.com/rehankhansahu/visue-spark-arena.git
cd visue-spark-arena
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Arena
```bash
npm start
```
*Or using node directly:*
```bash
node server.js
```

### 5. Access the Platform
- **Public Arena & Student Portal:** [http://localhost:3000](http://localhost:3000)
- **Sir's / Judge Control Desk:** [http://localhost:3000/#admin](http://localhost:3000/#admin)

---

## 🔑 Administrative Credentials (Judge Desk)

| Role | Username | Password |
| :--- | :--- | :--- |
| **Faculty Judge / Sir** | `sir_visue` | `spark2026` |

---

## 🌐 Deploying Live to Railway (Step-by-Step)

Because this repository is already optimized for production:
1. Go to **[Railway.app](https://railway.app)** and log in with GitHub.
2. Click **"+ New Project"** ➔ **"Deploy from GitHub repo"**.
3. Select **`visue-spark-arena`**.
4. Railway will automatically detect Node.js, install dependencies, and start `server.js`.
5. Under your project settings, navigate to **Networking** ➔ **"Generate Domain"** to get your live HTTPS URL.

---

## 📜 License & Acknowledgements
- Developed by **Muhammad Rehan** as an academic submission for the **Department of Computer Science**, COMSATS University Islamabad, Vehari Campus.
- Designed to inspire students to push the boundaries of modern, real-time web application engineering.
