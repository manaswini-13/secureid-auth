const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secureid_jwt_secret_key_2026';

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'secureid_session_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, sameSite: 'lax' }
}));

// In-memory data persistence
const users = [];
const challenges = {};

// Helper: Generate 6-digit numeric OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ---------------- API ENDPOINTS ----------------

// 1. Registration Endpoint
app.post('/api/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!email || !password || !name || !phone) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'Account with this email already exists.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { 
    id: Date.now().toString(), 
    name, 
    email, 
    phone, 
    password: hashedPassword, 
    mfaEnabled: false 
  };
  users.push(newUser);

  // Email OTP Challenge
  const otp = generateOTP();
  const challengeId = 'ch_reg_email_' + Date.now();
  const otpHash = await bcrypt.hash(otp, 10);

  challenges[challengeId] = {
    userId: newUser.id,
    channel: 'email',
    otpHash,
    expiresAt: Date.now() + 3 * 60 * 1000, // 3 mins expiry
    attempts: 0
  };

  console.log(`\n========================================`);
  console.log(`[SIMULATED EMAIL - REGISTRATION OTP]`);
  console.log(`To: ${email}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`========================================\n`);

  res.json({ message: 'Registration initiated.', challengeId });
});

// 2. Email Verification Endpoint
app.post('/api/verify-email-otp', async (req, res) => {
  const { challengeId, otp } = req.body;
  const challenge = challenges[challengeId];

  if (!challenge || challenge.channel !== 'email') {
    return res.status(400).json({ error: 'Invalid or expired OTP session.' });
  }

  if (Date.now() > challenge.expiresAt) {
    delete challenges[challengeId];
    return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
  }

  if (challenge.attempts >= 3) {
    delete challenges[challengeId];
    return res.status(400).json({ error: 'Maximum attempts reached. Challenge invalidated.' });
  }

  challenge.attempts += 1;
  const isValid = await bcrypt.compare(otp, challenge.otpHash);
  if (!isValid) {
    return res.status(400).json({ error: `Incorrect code. ${3 - challenge.attempts} attempt(s) remaining.` });
  }

  delete challenges[challengeId];
  res.json({ message: 'Email verified successfully.' });
});

// 3. SMS OTP Generation & Verification
app.post('/api/send-sms-otp', async (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const otp = generateOTP();
  const challengeId = 'ch_reg_sms_' + Date.now();
  const otpHash = await bcrypt.hash(otp, 10);

  challenges[challengeId] = {
    userId: user.id,
    channel: 'sms',
    otpHash,
    expiresAt: Date.now() + 3 * 60 * 1000,
    attempts: 0
  };

  console.log(`\n========================================`);
  console.log(`[SIMULATED SMS - MOBILE OTP]`);
  console.log(`To: ${user.phone}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`========================================\n`);

  res.json({ message: 'SMS OTP dispatched.', challengeId });
});

app.post('/api/verify-sms-otp', async (req, res) => {
  const { challengeId, otp } = req.body;
  const challenge = challenges[challengeId];

  if (!challenge || challenge.channel !== 'sms') {
    return res.status(400).json({ error: 'Invalid or expired challenge.' });
  }

  const isValid = await bcrypt.compare(otp, challenge.otpHash);
  if (!isValid) return res.status(400).json({ error: 'Incorrect SMS OTP.' });

  const user = users.find(u => u.id === challenge.userId);
  if (user) user.mfaEnabled = true;

  delete challenges[challengeId];
  res.json({ message: 'MFA enabled. Registration completed successfully.' });
});

// 4. Login Endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid email or password. Please try again.' });
  }

  const otp = generateOTP();
  const challengeId = 'ch_login_' + Date.now();
  const otpHash = await bcrypt.hash(otp, 10);

  challenges[challengeId] = {
    userId: user.id,
    channel: 'login',
    otpHash,
    expiresAt: Date.now() + 3 * 60 * 1000,
    attempts: 0
  };

  console.log(`\n========================================`);
  console.log(`[SIMULATED LOGIN MFA OTP]`);
  console.log(`To: ${user.email}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`========================================\n`);

  res.json({ mfaRequired: true, method: 'email', challengeId });
});

app.post('/api/verify-login-otp', async (req, res) => {
  const { challengeId, otp } = req.body;
  const challenge = challenges[challengeId];

  if (!challenge || challenge.channel !== 'login') {
    return res.status(400).json({ error: 'Invalid or expired login session.' });
  }

  const isValid = await bcrypt.compare(otp, challenge.otpHash);
  if (!isValid) return res.status(400).json({ error: 'Invalid OTP code.' });

  const user = users.find(u => u.id === challenge.userId);
  req.session.user = { id: user.id, email: user.email, name: user.name };
  delete challenges[challengeId];

  res.json({ message: 'Login verification successful.', user: req.session.user });
});

// 5. Session Authentication Routes
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized: Session inactive.' });
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Session terminated.' });
});

// 6. JWT Authentication Routes
app.post('/api/token', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Session required to issue JWT.' });
  const token = jwt.sign({ id: req.session.user.id, email: req.session.user.email }, JWT_SECRET, { expiresIn: '15m' });
  res.json({ token });
});

app.get('/api/protected', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization header missing.' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ message: 'Access granted to protected endpoint.', payload: decoded });
  } catch (err) {
    res.status(403).json({ error: 'Forbidden: JWT invalid or expired.' });
  }
});

app.listen(PORT, () => console.log(`SecureID App running at http://localhost:${PORT}`));