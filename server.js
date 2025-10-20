#!/usr/bin/env node
/** Simple Express server to persist coin additions to JSON and log file. */
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data', 'coins.json');
const LOG_FILE = path.join(__dirname, 'data', 'coins.log');
const ALLOWED_EMAILS_FILE = path.join(__dirname, 'allowed-emails.json');
const MEMBERS = ['Isac','Hannah','Andreas','Karl','Daniel','Doug','Marina'];

// Load allowed emails
let allowedEmails = [];
try {
  const emailData = JSON.parse(fs.readFileSync(ALLOWED_EMAILS_FILE, 'utf8'));
  allowedEmails = emailData.allowedEmails || [];
} catch {
  // Silently fail
}

// Rate limiting: track last vote time per IP
const rateLimit = new Map();
const RATE_LIMIT_MS = 30000; // 30 seconds

app.use(express.json());
app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(__dirname));

function loadData(){
  try {
    const text = fs.readFileSync(DATA_FILE,'utf8');
    return JSON.parse(text);
  } catch {
    const fresh = {total:0,members:Object.fromEntries(MEMBERS.map(m=>[m,0])),updated:null};
    try { saveData(fresh); } catch {
      // Silently fail
    }
    return fresh;
  }
}
let writing = false;
function saveData(data){
  data.updated = new Date().toISOString();
  // Simple lock to avoid overlapping synchronous writes (rare in single-thread node, but protective if future async introduced)
  if (writing) {
    // In extreme edge case we skip; could queue if needed
    return;
  }
  writing = true;
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data,null,2));
    fs.renameSync(tmp, DATA_FILE); // atomic replace on most filesystems
  } catch {
    // Silently fail
  } finally {
    writing = false;
  }
}
function appendLog(entry){
  fs.appendFile(LOG_FILE, entry + '\n', ()=>{});
}

app.get('/api/coins', (req,res)=>{
  res.json(loadData());
});

app.post('/api/coins', (req,res)=>{
  try {
    const { member, email } = req.body;
    
    // Validate member
    if (!member || !MEMBERS.includes(member)) {
      return res.status(400).json({ error: 'Invalid member' });
    }
    
    // Validate email authorization
    if (!email) {
      return res.status(401).json({ error: 'Email required for voting' });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Strict validation - must have allowed emails loaded
    if (allowedEmails.length === 0) {
      return res.status(500).json({ 
        error: 'Server configuration error', 
        message: 'Unable to verify email authorization' 
      });
    }
    
    if (!allowedEmails.includes(normalizedEmail)) {
      return res.status(403).json({ 
        error: 'Unauthorized email', 
        message: 'Your email is not authorized to vote' 
      });
    }
    
    // Rate limiting check
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const lastVote = rateLimit.get(clientIP);
    
    if (lastVote && (now - lastVote) < RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastVote)) / 1000);
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: `Please wait ${remainingSeconds} seconds before voting again`,
        remainingSeconds 
      });
    }
    
    // Update rate limit
    rateLimit.set(clientIP, now);
    
    const data = loadData();
    data.total += 1;
    data.members[member] += 1;
    saveData(data);
    appendLog(`${new Date().toISOString()} ${member} +1 -> total=${data.total} [Email: ${normalizedEmail}, IP: ${clientIP}]`);
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/coins/reset', (req,res)=>{
  try {
    const fresh = {total:0,members:Object.fromEntries(MEMBERS.map(m=>[m,0])),updated:null};
    saveData(fresh);
    appendLog(`${new Date().toISOString()} RESET -> total=0`);
    res.json(fresh);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const server = app.listen(PORT, ()=> {
  console.log(`Coin server running on http://localhost:${PORT}`);
});

function graceful(signal){
  server.close(()=>{
    process.exit(0);
  });
  // Failsafe exit after 5s
  setTimeout(()=>process.exit(1), 5000).unref();
}
for (const sig of ['SIGTERM','SIGINT']) {
  process.on(sig, ()=>graceful(sig));
}
