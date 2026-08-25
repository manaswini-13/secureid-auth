# SecureID — IAM Authentication & Registration System

A full-stack Identity and Access Management (IAM) authentication and multi-step registration application built with Node.js, Express, HTML, CSS, and vanilla JavaScript.

This project implements a secure authentication flow featuring multi-step registration (Email & SMS OTP verification), multi-factor login (MFA), server-side session management, and JWT-protected API routes.

---

## Features

* Multi-Step Registration: Dynamic registration journey with sequential Email OTP and SMS OTP verification steps.
* MFA Enforced Login: Credential validation followed by mandatory secondary OTP verification.
* Auto-Advancing OTP Inputs: Smooth 6-digit input UX supporting auto-focus, backspace navigation, and full-code pasting.
* Dual Authentication Mechanisms:
  * Session-Based Authentication: Server-side session tracking with HTTP-only cookies (GET /api/me).
  * JWT-Based Authentication: Token issuance (POST /api/token) and Bearer header validation (GET /api/protected).
* Simulated OTP Delivery: OTPs are generated securely on the server and printed directly to the server console for testing.
* Security Practices: Password hashing using bcrypt, server-side challenge management with attempt limiting and expiration.

---

## Tech Stack

* Frontend: HTML5, CSS3, JavaScript (ES6+)
* Backend: Node.js, Express.js
* Security & Auth: bcrypt, jsonwebtoken (JWT), express-session
* Deployment Target: Vercel

---

## Project Structure

```text
secureid-auth/
├── package.json
├── server.js
├── README.md
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
