#!/usr/bin/env node
/** Simple Express server to persist coin additions to JSON and log file. */
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data', 'coins.json');
const LOG_FILE = path.join(__dirname, 'data', 'coins.log');
const MEMBERS = ['Isac','Hannah','Andreas','Karl','Daniel','Doug','Marina'];

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
  } catch(error_) {
    console.warn('loadData: falling back to fresh dataset:', error_.message);
    const fresh = {total:0,members:Object.fromEntries(MEMBERS.map(m=>[m,0])),updated:null};
    try { saveData(fresh); } catch(error__) {
      console.error('Failed to persist fresh dataset:', error__.message);
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
    console.warn('saveData: write skipped due to concurrent write lock');
    return;
  }
  writing = true;
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data,null,2));
    fs.renameSync(tmp, DATA_FILE); // atomic replace on most filesystems
  } catch(error_) {
    console.error('saveData error:', error_.message);
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
    const { member } = req.body;
    if (!member || !MEMBERS.includes(member)) {
      return res.status(400).json({ error: 'Invalid member' });
    }
    const data = loadData();
    data.total += 1;
    data.members[member] += 1;
    saveData(data);
    appendLog(`${new Date().toISOString()} ${member} +1 -> total=${data.total}`);
    res.json(data);
  } catch(error_) {
    console.error('POST /api/coins failed:', error_.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/coins/reset', (req,res)=>{
  try {
    const fresh = {total:0,members:Object.fromEntries(MEMBERS.map(m=>[m,0])),updated:null};
    saveData(fresh);
    appendLog(`${new Date().toISOString()} RESET -> total=0`);
    res.json(fresh);
  } catch(error_) {
    console.error('POST /api/coins/reset failed:', error_.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const server = app.listen(PORT, ()=> {
  console.log(`Coin server running on http://localhost:${PORT}`);
});

function graceful(signal){
  console.log(`\n${signal} received, shutting down...`);
  server.close(()=>{
    console.log('HTTP server closed.');
    process.exit(0);
  });
  // Failsafe exit after 5s
  setTimeout(()=>process.exit(1), 5000).unref();
}
for (const sig of ['SIGTERM','SIGINT']) {
  process.on(sig, ()=>graceful(sig));
}
