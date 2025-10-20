// Minimal JS: coin addition, count management, persistence, and simple animation hook
(function() {
  // App elements
  const memberButtons = Array.from(document.querySelectorAll('.member-btn'));
  const resetBtn = document.getElementById('resetBtn');
  const countValueEl = document.getElementById('countValue');
  const pluralSuffixEl = document.getElementById('pluralSuffix');
  const container = document.getElementById('coinContainer');
  const memberStatsEl = document.getElementById('memberStats');
  const userInfoEl = document.getElementById('userInfo');
  const loginModal = document.getElementById('loginModal');
  const emailInput = document.getElementById('emailInput');
  const loginBtn = document.getElementById('loginBtn');
  const API_BASE = ''; // Same origin (server serves static files)
  const MEMBERS = ['Isac','Hannah','Andreas','Karl','Daniel','Doug','Marina'];
  const VALUE_PER_COIN = 5; // SEK per coin

  let count = 0;
  let memberCounts = Object.fromEntries(MEMBERS.map(m=>[m,0]));
  let serverAvailable = false;
  let allowedEmails = [];

  // Load allowed emails
  async function loadAllowedEmails() {
    try {
      const res = await fetch('/allowed-emails.json');
      if (res.ok) {
        const data = await res.json();
        allowedEmails = data.allowedEmails || [];
        console.log('Loaded allowed emails:', allowedEmails.length);
      }
    } catch(err) {
      console.error('Could not load allowed emails:', err);
    }
  }

  // User name handling
  function extractNameFromEmail(email) {
    if (!email) return null;
    
    // Extract the part before @ symbol
    const localPart = email.split('@')[0];
    
    // If it contains a dot, take the first part (e.g., "andreas.heige" -> "andreas")
    // Otherwise use the whole local part (e.g., "karl" -> "karl")
    const firstName = localPart.includes('.') ? localPart.split('.')[0] : localPart;
    
    // Capitalize first letter
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }

  function initializeUserName() {
    const userName = sessionStorage.getItem('userName');
    const userEmail = sessionStorage.getItem('userEmail');
    
    if (userName && userEmail) {
      // Already logged in
      updateUserDisplay(userName);
      loginModal.style.display = 'none';
    } else {
      // Show login modal
      loginModal.style.display = 'flex';
      emailInput.focus();
    }
  }

  function handleLogin() {
    const email = emailInput.value.trim().toLowerCase();
    
    if (!email) {
      alert('Please enter an email address');
      return;
    }
    
    // Check if email is allowed
    if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
      alert('Sorry, this email is not authorized to access Grebcan.');
      return;
    }
    
    const userName = extractNameFromEmail(email);
    if (userName) {
      sessionStorage.setItem('userName', userName);
      sessionStorage.setItem('userEmail', email);
      updateUserDisplay(userName);
      loginModal.style.display = 'none';
    }
  }

  // Login button click
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }

  // Enter key in email input
  if (emailInput) {
    emailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleLogin();
      }
    });
  }

  function updateUserDisplay(name) {
    if (userInfoEl) {
      userInfoEl.textContent = `👤 ${name}`;
    }
  }

  // Allow changing name on click
  if (userInfoEl) {
    userInfoEl.addEventListener('click', () => {
      sessionStorage.removeItem('userName');
      sessionStorage.removeItem('userEmail');
      emailInput.value = '';
      loginModal.style.display = 'flex';
      emailInput.focus();
    });
  }

  async function load() {
    try {
      const res = await fetch(API_BASE + '/api/coins');
      if (res.ok) {
        const data = await res.json();
        count = data.total;
        memberCounts = data.members;
        serverAvailable = true;
        console.log('Loaded from server:', data);
      } else { 
        throw new Error(`Server responded ${res.status}`); 
      }
    } catch(error_) {
      console.error('Server unavailable; app requires backend to run:', error_.message);
      alert('Backend server not running! Start with: node server.js');
      // Reset to zero state when server unavailable
      count = 0;
      memberCounts = Object.fromEntries(MEMBERS.map(m=>[m,0]));
      serverAvailable = false;
    }
    updateDisplay();
    renderCoins(count);
    renderMemberStats();
    toggleReset();
  }

  function renderMemberStats() {
    memberStatsEl.innerHTML = '';
    const sorted = Object.entries(memberCounts).sort((a,b) => b[1] - a[1]);
    // Build rank mapping for counts (top 3 distinct counts only)
    const rankForCount = new Map();
    for (const [, cnt] of sorted) {
      if (cnt === 0) break; // stop ranking when zero encountered
      if (!rankForCount.has(cnt) && rankForCount.size < 3) {
        rankForCount.set(cnt, rankForCount.size + 1);
      }
    }
    for (const [m, cnt] of sorted) {
      const rank = rankForCount.get(cnt) || 0;
      let rankClass = '';
      if (rank === 1) rankClass = ' gold';
      else if (rank === 2) rankClass = ' silver';
      else if (rank === 3) rankClass = ' bronze';
      const div = document.createElement('div');
      div.className = 'stat' + rankClass;
      const amt = cnt * VALUE_PER_COIN;
      div.textContent = `${m}: ${cnt} complaint${cnt === 1 ? '' : 's'} (${amt} SEK)`;
      memberStatsEl.appendChild(div);
    }
  }


  function updateDisplay() {
    countValueEl.textContent = count;
    pluralSuffixEl.hidden = count === 1;
    const totalSekId = 'totalSek';
    let totalSekEl = document.getElementById(totalSekId);
    if (!totalSekEl) {
      totalSekEl = document.createElement('span');
      totalSekEl.id = totalSekId;
      totalSekEl.style.marginLeft = '0.5rem';
      totalSekEl.style.fontWeight = '600';
      document.getElementById('coinCount').appendChild(totalSekEl);
    }
    totalSekEl.textContent = `= ${count * VALUE_PER_COIN} SEK`;
  }

  function renderCoins(n) {
    container.innerHTML = '';
    // Render all coins - they layer on top of each other
    for (let i = 0; i < n; i++) {
      const coin = createPositionedCoin(i, false);
      container.appendChild(coin);
    }
  }

  async function addCoin(member) {
    if (!serverAvailable) {
      alert('Server not available. Cannot save coin.');
      return;
    }
    // Optimistically update UI
    count++;
    memberCounts[member] = (memberCounts[member] || 0) + 1;
    updateDisplay();
    renderMemberStats();
    addCoinVisual(member);
    playCoinSound();
    toggleReset();
    
    // Persist to server
    try {
      const res = await fetch(API_BASE + '/api/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member })
      });
      if (res.ok) {
        const data = await res.json();
        count = data.total; 
        memberCounts = data.members;
        updateDisplay();
        renderMemberStats();
        console.log('Saved to server:', data);
      } else {
        console.error('Server rejected coin:', res.status);
        alert('Failed to save coin to server!');
        // Rollback optimistic update
        count--;
        memberCounts[member] = (memberCounts[member] || 1) - 1;
        updateDisplay();
        renderMemberStats();
        serverAvailable = false;
      }
    } catch(error_) { 
      console.error('POST failed:', error_.message); 
      alert('Network error saving coin!');
      // Rollback
      count--;
      memberCounts[member] = (memberCounts[member] || 1) - 1;
      updateDisplay();
      renderMemberStats();
      serverAvailable = false; 
    }
  }

  function addCoinVisual(member) {
    const index = count - 1;
    const coin = createPositionedCoin(index, true, member);
    container.appendChild(coin);
    // Keep all coins visible - they layer on top of each other!
  }

  function createPositionedCoin(index, animate, member) {
    const coin = document.createElement('div');
    coin.className = 'coin ' + (member ? member.toLowerCase() : '');
    
    // Randomly assign coin color: gold, silver, or bronze
    const rand = Math.random();
    if (rand < 0.5) {
      coin.classList.add('coin-gold'); // 50% gold
    } else if (rand < 0.8) {
      coin.classList.add('coin-silver'); // 30% silver
    } else {
      coin.classList.add('coin-bronze'); // 20% bronze
    }
    
    // Determine layout metrics
    const jarRect = container.getBoundingClientRect();
  const coinSize = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--coin-size')); // px
    const paddingY = 20; // match approximate jar-inner bottom padding
    const usableHeight = jarRect.height - paddingY - coinSize;
    const usableWidth = jarRect.width - coinSize - 16; // horizontal inset

    // All coins stack inside jar - when we reach the top, start a new layer
    const perRow = Math.floor(usableWidth / (coinSize * 1.1));
    const coinsPerLayer = 200; // After 200 coins, start stacking in new layers on top
    
    const layer = Math.floor(index / coinsPerLayer);
    const indexInLayer = index % coinsPerLayer;
    
    const row = Math.floor(indexInLayer / perRow);
    const col = indexInLayer % perRow;
    
    // Position with slight offset for each layer to show depth
    const x = 8 + col * (coinSize * 1.05) + (Math.random() * 4 - 2) + (layer * 2); // layer offset
    const y = usableHeight - row * (coinSize * 0.6) - (layer * 3); // layers stack slightly higher
    
    // Add layer class for potential styling differences
    if (layer > 0) {
      coin.classList.add('layer-' + layer);
      // Make higher layers slightly more visible (closer to viewer)
      coin.style.zIndex = 100 + layer;
    }

    // Store target translation as CSS vars for animation keyframes
    coin.style.setProperty('--target-x', x + 'px');
    coin.style.setProperty('--target-y', y + 'px');
    coin.style.transform = `translate(${x}px, ${y}px)`;
    coin.style.opacity = '1';

  if (animate && !globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Start above jar
      const startX = x + (Math.random() * 40 - 20);
      const startY = - (coinSize * 4 + Math.random() * 40);
      const startTransform = `translate(${startX}px, ${startY}px) scale(.7)`;
      coin.style.setProperty('--start-transform', startTransform);
      coin.style.animation = 'coinFall 900ms cubic-bezier(.23,.82,.35,1.02), coinSettle 700ms 900ms ease-out';
    }
    return coin;
  }

  // Recalculate positions on resize
  globalThis.addEventListener('resize', () => {
    // Re-render all coins without animation
    renderCoins(count);
  });

  function reset() {
    // No cheating allowed! 😄
    // Show the fun modal instead of a boring alert
    const modal = document.getElementById('cheatModal');
    modal.hidden = false;
  }

  function toggleReset() {
    resetBtn.hidden = count === 0;
  }

  for (const btn of memberButtons) {
    btn.addEventListener('click', () => addCoin(btn.dataset.member));
  }
  resetBtn.addEventListener('click', reset);
  
  // Close modal when clicking the button or backdrop
  const modal = document.getElementById('cheatModal');
  const closeModalBtn = document.getElementById('closeModal');
  const modalBackdrop = modal?.querySelector('.modal-backdrop');
  
  closeModalBtn?.addEventListener('click', () => {
    modal.hidden = true;
  });
  
  modalBackdrop?.addEventListener('click', () => {
    modal.hidden = true;
  });

  // Coin sound using MP3 file
  let coinAudio;
  function playCoinSound() {
    if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      // Create or reuse audio element
      if (!coinAudio) {
        coinAudio = new Audio('coin-drop-39914.mp3');
        coinAudio.volume = 0.3; // Adjust volume (0.0 to 1.0)
      }
      // Reset and play (allows rapid clicks)
      coinAudio.currentTime = 0;
      coinAudio.play().catch(error_ => console.warn('Audio play failed:', error_.message));
    } catch(error_) { console.warn('Coin sound error:', error_.message); }
  }

  // Keyboard accessibility: space/enter when focused on button is native; no extra needed.

  // Initialize app
  async function init() {
    await loadAllowedEmails();
    initializeUserName();
    load();
  }
  
  init();
})();
