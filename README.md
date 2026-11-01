# ⚡ VISUE SPARK 2026 - Programming Arena
### 🏛️ COMSATS University Islamabad, Vehari Campus • Department of Computer Science
> Full-Stack Real-Time Coding Competition Platform built for **"Advanced Web Technologies"** (CS-302).

---

## 🎯 Syllabus Alignment (Lectures Implemented)
| Lecture Topic | Implementation Details in Arena |
| :--- | :--- |
| **Lecture 5: Express REST APIs** | Modular REST endpoints (`/api/register`, `/api/submit`, `/api/leaderboard`, `/api/problems`) with standard HTTP status codes (`200`, `201`, `400`, `401`, `403`, `500`). |
| **Lecture 7: Real-Time Socket.IO** | Bi-directional WebSocket events (`leaderboardUpdate`, `newSubmission`, `bonusAwarded`) that sync rank positions across all screens in real-time with zero page reload. |
| **Lecture 9: Lightweight Auth & RBAC** | Sir / Judge desk protected with JSON Web Tokens (JWT) signed via secret key and verified through `verifySirToken` middleware. |
| **Lectures 11 & 12: API Security & Validation** | Express CORS protection, parameterized sanitization, and strict COMSATS Vehari Registration Number validation (`^(SP|FA)\d{2}-(BSE|BCS)-\d{3}$`) via `express-validator`. |

---

## 📋 Allowed Student Registration Format
Strictly restricted to **COMSATS University Islamabad, Vehari Campus** format:
- **`SP24-BSE-045`** (Spring 2024, Bachelor of Science in Software Engineering)
- **`FA24-BCS-012`** (Fall 2024, Bachelor of Science in Computer Science)
- Structure: `(SP|FA)` + `2-digit Year` + `-(BSE|BCS)-` + `3-digit Roll No`

---

## 🚀 Launch Command
```bash
cd "D:\Study\Advanced Web Technologies\visue-spark-arena"
node server.js
```
Open in Browser: **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Demo Credentials
- **Sir / Judge Passkey:** `spark2026`
- **Institution:** COMSATS University Islamabad, Vehari Campus
- **Department:** Department of Computer Science
