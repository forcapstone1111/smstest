// SMS Gateway UI - app.js

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// State
let settings = JSON.parse(localStorage.getItem('smsSettings') || '{}');
let currentEndpoint = 'local';

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  bindNav();
  bindEndpointToggle();
  bindSend();
  bindSettings();
  updateCharCount();
  checkStatus();
});

// Navigation
function bindNav() {
  $$('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const page = link.dataset.page;
      $$('.page').forEach(p => p.classList.remove('active'));
      $(`#page-${page}`).classList.add('active');
    });
  });
}

// Endpoint toggle
function bindEndpointToggle() {
  $$('.endpoint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.endpoint-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEndpoint = btn.dataset.endpoint;
    });
  });
}

// Character counter
function updateCharCount() {
  $('#messageInput').addEventListener('input', () => {
    $('#charCount').textContent = $('#messageInput').value.length;
  });
}

// Send SMS
function bindSend() {
  $('#sendBtn').addEventListener('click', async () => {
    const phone = $('#phoneInput').value.trim();
    const message = $('#messageInput').value.trim();

    if (!phone) return showResponse('danger', 'Phone number is required');
    if (!message) return showResponse('danger', 'Message is required');

    const btn = $('#sendBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

    try {
      let res;
      if (currentEndpoint === 'local') {
        res = await sendLocal(phone, message);
      } else {
        res = await sendOnline(phone, message);
      }
      showResponse('success', res);
    } catch (err) {
      showResponse('danger', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send SMS';
    }
  });
}

// LAN/IP gateways are called directly. Anything else (a tunnel such as ngrok)
// is routed through the local relay, because ngrok's free tier answers browser
// requests with its warning page instead of your JSON.
function gatewayUrl(endpoint, path) {
  const base = (endpoint.includes('://') ? endpoint : `http://${endpoint}`).replace(/\/+$/, '');
  let host = '';
  try { host = new URL(base).hostname; } catch { /* not a URL, treat as direct */ }
  const direct = host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (direct || !host) return { url: `${base}${path}`, relay: false };
  return { url: `http://127.0.0.1:3000/gw?target=${encodeURIComponent(base + path)}`, relay: true };
}

async function sendLocal(phone, message) {
  const endpoint = settings.localIp;
  if (!endpoint) throw new Error('Local endpoint not configured. Go to Settings.');

  const g = gatewayUrl(endpoint, '/send');
  let res;
  try {
    res = await fetch(g.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver: phone, message }),
    });
  } catch {
    throw new Error(g.relay
      ? 'Tunnel not reachable. Start the relay with "node proxy.js".'
      : 'Local gateway unreachable.');
  }
  if (!res.ok) throw new Error(`Local gateway error: ${res.status}`);
  const data = await res.json().catch(() => ({}));
  return data.status || 'Message sent successfully';
}

async function sendOnline(phone, message) {
  const url = settings.convexUrl;
  const key = settings.apiKey;
  if (!url || !key) throw new Error('Online endpoint not configured. Go to Settings.');

  const numbers = phone.split(',').map(n => n.trim()).filter(Boolean);
  const target = `${url}/v1/messages/send`;

  const results = [];
  for (const num of numbers) {
    const e164 = toE164(num);
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ to: e164, message }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${num}: ${err.error?.message || `Online gateway error: ${res.status}`}`);
    }
    const data = await res.json();
    results.push(`${num}: ${data.status || 'queued'}`);
  }
  return results.join(', ');
}

// Convert PH mobile (09xx) to E.164 (+639xx)
function toE164(num) {
  const n = num.trim();
  if (n.startsWith('0')) return '+63' + n.slice(1);
  if (n.startsWith('63')) return '+' + n;
  if (n.startsWith('+')) return n;
  return n;
}

function showResponse(type, msg) {
  const area = $('#responseArea');
  const alert = $('#responseAlert');
  area.style.display = 'block';
  alert.className = `alert alert-${type}`;
  alert.textContent = msg;
}

// Settings
function bindSettings() {
  $('#saveSettingsBtn').addEventListener('click', saveSettings);
  $('#testLocalBtn').addEventListener('click', testLocal);
  $('#testOnlineBtn').addEventListener('click', testOnline);
}

function loadSettings() {
  if (settings.localIp) $('#localIp').value = settings.localIp;
  if (settings.convexUrl) $('#convexUrl').value = settings.convexUrl;
  if (settings.apiKey) $('#apiKey').value = settings.apiKey;
}

function saveSettings() {
  settings = {
    localIp: $('#localIp').value.trim(),
    convexUrl: $('#convexUrl').value.trim(),
    apiKey: $('#apiKey').value.trim(),
  };
  localStorage.setItem('smsSettings', JSON.stringify(settings));
  showSaveFeedback();
}

function showSaveFeedback() {
  const btn = $('#saveSettingsBtn');
  const orig = btn.textContent;
  btn.textContent = 'Saved!';
  btn.classList.add('btn-success');
  btn.classList.remove('btn-primary');
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.remove('btn-success');
    btn.classList.add('btn-primary');
  }, 1500);
}

async function testLocal() {
  const endpoint = $('#localIp').value.trim();
  const result = $('#localTestResult');

  if (!endpoint) { result.innerHTML = '<span class="text-danger small">Endpoint required</span>'; return; }

  result.innerHTML = '<span class="text-muted small">Testing...</span>';
  const g = gatewayUrl(endpoint, '/status');
  try {
    const res = await fetch(g.url);
    if (!res.ok) throw new Error();
    result.innerHTML = '<span class="text-success small">Connected</span>';
  } catch {
    result.innerHTML = '<span class="text-danger small">Connection failed</span>';
  }
}

async function testOnline() {
  const url = $('#convexUrl').value.trim();
  const key = $('#apiKey').value.trim();
  const result = $('#onlineTestResult');

  if (!url || !key) { result.innerHTML = '<span class="text-danger small">URL and API key required</span>'; return; }

  result.innerHTML = '<span class="text-muted small">Testing...</span>';
  try {
    const target = `${url}/v1/messages/send`;
    // Send empty body — 400 means auth passed, 401 means bad key
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ to: '', message: '' }),
    });
    if (res.status === 401) throw new Error('Invalid API key');
    if (res.status === 400) { result.innerHTML = '<span class="text-success small">Connected — API key valid</span>'; return; }
    if (res.ok) { result.innerHTML = '<span class="text-success small">Connected</span>'; return; }
    result.innerHTML = `<span class="text-danger small">Error: ${res.status}</span>`;
  } catch (err) {
    result.innerHTML = `<span class="text-danger small">${err.message}</span>`;
  }
}

// Sidebar status indicator
async function checkStatus() {
  const dot = $('#sidebarStatus');
  const text = $('#sidebarStatusText');

  // Quick check: just show which endpoint is configured
  if (currentEndpoint === 'local' && settings.localIp) {
    dot.className = 'status-dot connected';
    text.textContent = `Local: ${settings.localIp}`;
  } else if (currentEndpoint === 'online' && settings.convexUrl) {
    dot.className = 'status-dot connected';
    text.textContent = 'Online: Convex';
  } else {
    dot.className = 'status-dot';
    text.textContent = 'Not configured';
  }
}
