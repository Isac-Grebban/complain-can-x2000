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
  const logoutBtn = document.getElementById('logoutBtn');
  const cooldownLoader = document.getElementById('cooldownLoader');
  const cooldownSeconds = document.getElementById('cooldownSeconds');
  const jar = document.querySelector('.jar');
  const jarNeck = document.querySelector('.jar-neck');
  const MEMBERS = ['Isac','Hannah','Andreas','Karl','Daniel','Doug','Marina'];
  const VALUE_PER_COIN = 5; // SEK per coin

  let count = 0;
  let memberCounts = Object.fromEntries(MEMBERS.map(m=>[m,0]));
  let storage = null;
  let allowedEmails = [];
  let lastClickTime = 0;
  const RATE_LIMIT_MS = 30000; // 30 seconds
  
  // Initialize storage
  function initStorage() {
    if (typeof window.CONFIG === 'undefined' || typeof window.GistStorage === 'undefined') {
      console.error('Missing CONFIG or GistStorage. Make sure config.js and gist-storage.js are loaded.');
      return null;
    }
    return new window.GistStorage(window.CONFIG);
  }

  // Load allowed emails
  async function loadAllowedEmails() {
    try {
      const res = await fetch('/allowed-emails.json');
      if (res.ok) {
        const data = await res.json();
        allowedEmails = data.allowedEmails || [];
      }
    } catch {
      // Silently fail
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
      logoutBtn.hidden = false;
    } else {
      // Show login modal
      loginModal.style.display = 'flex';
      emailInput.focus();
      logoutBtn.hidden = true;
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
      logoutBtn.hidden = false;
    }
  }

  function handleLogout() {
    // Clear session storage
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('userEmail');
    
    // Reset UI
    updateUserDisplay('Guest');
    logoutBtn.hidden = true;
    
    // Show login modal
    emailInput.value = '';
    loginModal.style.display = 'flex';
    emailInput.focus();
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

  // Logout button click
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
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

  function disableButtons() {
    // Disable all member buttons
    for (const btn of memberButtons) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }
    
    // Show loader with countdown
    cooldownLoader.hidden = false;
    let remainingSeconds = 30;
    cooldownSeconds.textContent = remainingSeconds;
    
    // Restart the progress bar animation
    const progressBar = cooldownLoader.querySelector('.loader-progress');
    progressBar.style.animation = 'none';
    setTimeout(() => {
      progressBar.style.animation = 'progressCountdown 30s linear forwards';
    }, 10);
    
    // Update countdown text every second
    const countdown = setInterval(() => {
      remainingSeconds--;
      cooldownSeconds.textContent = remainingSeconds;
      
      if (remainingSeconds <= 0) {
        clearInterval(countdown);
        enableButtons();
      }
    }, 1000);
  }

  function enableButtons() {
    // Re-enable all member buttons
    for (const btn of memberButtons) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
    
    // Hide loader
    cooldownLoader.hidden = true;
  }

  async function load() {
    if (!storage) {
      storage = initStorage();
      if (!storage) {
        console.error('Failed to initialize storage');
        count = 0;
        memberCounts = Object.fromEntries(MEMBERS.map(m=>[m,0]));
        updateDisplay();
        renderCoins(count);
        renderMemberStats();
        toggleReset();
        return;
      }
    }

    try {
      const data = await storage.loadData();
      count = data.total || 0;
      memberCounts = data.members || Object.fromEntries(MEMBERS.map(m=>[m,0]));
      
      // Ensure all members exist in the data
      MEMBERS.forEach(member => {
        if (!(member in memberCounts)) {
          memberCounts[member] = 0;
        }
      });
      
      console.log('Loaded coin data:', { count, memberCounts });
    } catch (error) {
      console.error('Failed to load coin data:', error.message);
      // Use fallback data
      count = 0;
      memberCounts = Object.fromEntries(MEMBERS.map(m=>[m,0]));
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
    // Check if user is logged in with authorized email
    const userEmail = sessionStorage.getItem('userEmail');
    const userName = sessionStorage.getItem('userName');
    
    if (!userEmail || !userName) {
      alert('Please log in to vote');
      loginModal.style.display = 'flex';
      emailInput.focus();
      return;
    }
    
    // Verify email is still in allowed list
    if (allowedEmails.length > 0 && !allowedEmails.includes(userEmail.toLowerCase())) {
      alert('Your email is not authorized to vote. Please log in with an authorized email.');
      sessionStorage.removeItem('userName');
      sessionStorage.removeItem('userEmail');
      loginModal.style.display = 'flex';
      emailInput.focus();
      return;
    }
    
    // Client-side rate limiting
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    
    if (timeSinceLastClick < RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastClick) / 1000);
      alert(`Please wait ${remainingSeconds} seconds before adding another coin`);
      return;
    }
    
    if (!storage) {
      alert('Storage not available. Please check your configuration.');
      return;
    }
    
    // Update last click time
    lastClickTime = now;
    
    // Disable all buttons
    disableButtons();
    
    // Optimistically update UI
    count++;
    memberCounts[member] = (memberCounts[member] || 0) + 1;
    updateDisplay();
    renderMemberStats();
    liftLid();
    addCoinVisual(member);
    playCoinSound();
    toggleReset();
    
    // Persist to Gist
    try {
      const dataToSave = {
        total: count,
        members: memberCounts
      };
      
      const savedData = await storage.saveData(dataToSave);
      
      // Update with the actual saved data (in case of concurrent updates)
      count = savedData.total;
      memberCounts = savedData.members;
      updateDisplay();
      renderMemberStats();
      
      console.log(`Coin added for ${member}. Total: ${count}`);
    } catch (error) {
      console.error('Failed to save coin:', error.message);
      
      // Show user-friendly error message
      let errorMessage = 'Failed to save coin data!';
      if (error.message.includes('token not configured')) {
        errorMessage = 'GitHub token not configured. Please check the setup instructions.';
      } else if (error.message.includes('Gist ID not configured')) {
        errorMessage = 'Gist not configured. Please check the setup instructions.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Please check your GitHub token permissions.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Gist not found. Please check your gist ID in the configuration.';
      }
      
      alert(errorMessage);
      
      // Rollback optimistic update
      count--;
      memberCounts[member] = (memberCounts[member] || 1) - 1;
      updateDisplay();
      renderMemberStats();
      lastClickTime = 0;
      enableButtons();
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

  async function reset() {
    // No cheating allowed! 😄
    // Show the fun modal instead of a boring alert
    const modal = document.getElementById('cheatModal');
    modal.hidden = false;
    
    // Actually, let's provide a way to reset if needed (for testing)
    // This could be enabled by holding Shift while clicking or similar
    // For now, just show the modal
  }
  
  // Hidden reset function for testing/admin purposes
  async function actualReset() {
    if (!storage) {
      alert('Storage not available');
      return;
    }
    
    try {
      const resetData = await storage.resetData();
      count = resetData.total;
      memberCounts = resetData.members;
      updateDisplay();
      renderCoins(count);
      renderMemberStats();
      toggleReset();
      console.log('Data reset successfully');
    } catch (error) {
      console.error('Failed to reset data:', error.message);
      alert('Failed to reset data: ' + error.message);
    }
  }
  
  // Make reset available for testing (can be called from browser console)
  window.resetCoins = actualReset;

  function toggleReset() {
    resetBtn.hidden = count === 0;
  }

  for (const btn of memberButtons) {
    btn.addEventListener('click', () => addCoin(btn.dataset.member));
  }
  resetBtn.addEventListener('click', reset);
  
  // Jar swing animation on click with shake sound
  let jarShakeAudio;
  if (jar) {
    jar.addEventListener('click', () => {
      jar.classList.add('swinging');
      setTimeout(() => {
        jar.classList.remove('swinging');
      }, 800); // Match animation duration
      
      // Play shake sound only if there are coins
      if (count === 0) return;
      if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      try {
        if (!jarShakeAudio) {
          jarShakeAudio = new Audio('assets/shaking-coins-in-a-jar-2-38980.mp3');
          jarShakeAudio.volume = 0.4;
        }
        jarShakeAudio.currentTime = 0;
        jarShakeAudio.play().catch(() => {});
      } catch { }
    });
  }
  
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

  // Lid lift animation
  function liftLid() {
    if (!jarNeck) return;
    if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    jarNeck.classList.add('lifting');
    setTimeout(() => {
      jarNeck.classList.remove('lifting');
    }, 600); // Match animation duration
  }

  // Coin sound using MP3 file
  let coinAudio;
  function playCoinSound() {
    if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      // Create or reuse audio element
      if (!coinAudio) {
        coinAudio = new Audio('assets/coin-drop-39914.mp3');
        coinAudio.volume = 0.3; // Adjust volume (0.0 to 1.0)
      }
      // Reset and play (allows rapid clicks)
      coinAudio.currentTime = 0;
      coinAudio.play().catch(() => {});
    } catch { }
  }

  // Keyboard accessibility: space/enter when focused on button is native; no extra needed.

  // Initialize app
  async function init() {
    console.log('Initializing Complain Can app...');
    
    // Initialize storage first
    storage = initStorage();
    
    await loadAllowedEmails();
    initializeUserName();
    await load();
    
    console.log('App initialized successfully');
  }
  
  init();
})();
