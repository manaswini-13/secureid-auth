let currentChallengeId = null;
let currentEmail = '';
let currentFlow = 'registration'; // 'registration' or 'login'

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function clearOtpInputs(containerId) {
  document.querySelectorAll(`#${containerId} .otp-box`).forEach(input => input.value = '');
}

// Auto-advance OTP logic
function setupOtpBoxAutoAdvance(containerId) {
  const container = document.getElementById(containerId);
  const inputs = container.querySelectorAll('.otp-box');

  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length >= 1) {
        input.value = val[0];
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      }
      checkAndTriggerOtpSubmission(containerId);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pastedData)) {
        inputs.forEach((inp, i) => inp.value = pastedData[i]);
        inputs[5].focus();
        checkAndTriggerOtpSubmission(containerId);
      }
    });
  });
}

setupOtpBoxAutoAdvance('email-otp-group');
setupOtpBoxAutoAdvance('sms-otp-group');

function getOTPValue(containerId) {
  const inputs = document.querySelectorAll(`#${containerId} .otp-box`);
  return Array.from(inputs).map(i => i.value).join('');
}

async function checkAndTriggerOtpSubmission(containerId) {
  const otp = getOTPValue(containerId);
  if (otp.length !== 6) return;

  if (containerId === 'email-otp-group') {
    if (currentFlow === 'registration') {
      const res = await fetch('/api/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: currentChallengeId, otp })
      });

      const data = await res.json();
      if (res.ok) {
        const smsRes = await fetch('/api/send-sms-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail })
        });
        const smsData = await smsRes.json();
        currentChallengeId = smsData.challengeId;

        clearOtpInputs('sms-otp-group');
        showScreen('screen-sms-otp');
      } else {
        const errElem = document.getElementById('email-otp-error');
        errElem.innerText = data.error;
        errElem.style.display = 'block';
      }
    } else if (currentFlow === 'login') {
      const res = await fetch('/api/verify-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: currentChallengeId, otp })
      });

      const data = await res.json();
      if (res.ok) {
        document.getElementById('dashboard-user-info').innerText = `Logged in as: ${data.user.name} (${data.user.email})`;
        showScreen('screen-dashboard');
      } else {
        const errElem = document.getElementById('email-otp-error');
        errElem.innerText = data.error;
        errElem.style.display = 'block';
      }
    }
  } else if (containerId === 'sms-otp-group') {
    const res = await fetch('/api/verify-sms-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: currentChallengeId, otp })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Registration Complete & MFA Enabled! Please login.');
      showScreen('screen-login');
    } else {
      const errElem = document.getElementById('sms-otp-error');
      errElem.innerText = data.error;
      errElem.style.display = 'block';
    }
  }
}

// Registration Form Submit
document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  currentFlow = 'registration';
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;

  currentEmail = email;

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone, password })
  });

  const data = await res.json();
  if (res.ok) {
    currentChallengeId = data.challengeId;
    document.getElementById('display-email').innerText = email;
    clearOtpInputs('email-otp-group');
    showScreen('screen-email-otp');
  } else {
    alert(data.error);
  }
});

// Login Form Submit
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  currentFlow = 'login';
  const email = document.getElementById('login-id').value;
  const password = document.getElementById('login-password').value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (res.ok) {
    currentChallengeId = data.challengeId;
    document.getElementById('display-email').innerText = email;
    clearOtpInputs('email-otp-group');
    showScreen('screen-email-otp');
  } else {
    const errElem = document.getElementById('login-error');
    errElem.innerText = data.error;
    errElem.style.display = 'block';
  }
});

// Dashboard Actions
document.getElementById('btn-fetch-me').addEventListener('click', async () => {
  const res = await fetch('/api/me');
  const data = await res.json();
  const output = document.getElementById('api-output');
  output.style.display = 'block';
  output.innerText = JSON.stringify(data, null, 2);
});

document.getElementById('btn-test-jwt').addEventListener('click', async () => {
  const tokenRes = await fetch('/api/token', { method: 'POST' });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    alert(tokenData.error);
    return;
  }

  const protRes = await fetch('/api/protected', {
    headers: { 'Authorization': `Bearer ${tokenData.token}` }
  });
  const protData = await protRes.json();

  const output = document.getElementById('api-output');
  output.style.display = 'block';
  output.innerText = `Issued JWT Token:\n${tokenData.token}\n\nProtected Endpoint Output:\n` + JSON.stringify(protData, null, 2);
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  document.getElementById('api-output').style.display = 'none';
  showScreen('screen-login');
});