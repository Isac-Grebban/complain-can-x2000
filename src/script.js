// Minimal JS: coin addition, count management, persistence, and simple animation hook
(function() {
  // App elements
  const memberButtons = Array.from(document.querySelectorAll('.member-btn'));
  const resetBtn = document.getElementById('resetBtn');
  const historyBtn = document.getElementById('historyBtn');
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
  let history = [];
  let storage = null;
  let allowedEmails = [];
  const RATE_LIMIT_MS = 30000; // 30 seconds
  
  // User-specific cooldown functions using localStorage (now with hashed identifiers)
  function getUserCooldownKey(userIdentifier) {
    return `cooldown_${userIdentifier}`;
  }
  
  function getUserLastClickTime(userIdentifier) {
    if (!userIdentifier) return 0;
    const stored = localStorage.getItem(getUserCooldownKey(userIdentifier));
    return stored ? parseInt(stored, 10) : 0;
  }
  
  function setUserLastClickTime(userIdentifier, timestamp) {
    if (!userIdentifier) return;
    localStorage.setItem(getUserCooldownKey(userIdentifier), timestamp.toString());
  }
  
  function getRemainingCooldown(userIdentifier) {
    if (!userIdentifier) return 0;
    const lastClickTime = getUserLastClickTime(userIdentifier);
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    return Math.max(0, RATE_LIMIT_MS - timeSinceLastClick);
  }
  
  // Initialize storage
  function initStorage() {
    if (typeof window.CONFIG === 'undefined' || typeof window.GistStorage === 'undefined') {
      console.error('Missing CONFIG or GistStorage. Make sure config.js and gist-storage.js are loaded.');
      return null;
    }
    return new window.GistStorage(window.CONFIG);
  }

  // Load allowed email hashes (now using SHA256 for privacy)
  async function loadAllowedEmails() {
    console.log('📥 Loading allowed emails...');
    console.log('🌐 Current URL:', window.location.href);
    console.log('📂 Fetching from:', window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '') + '/email-hashes.json');
    
    try {
      // Use relative path to work with GitHub Pages subdirectory deployment
      const res = await fetch('./email-hashes.json');
      console.log('📡 Fetch response status:', res.status);
      console.log('📡 Fetch response headers:', [...res.headers.entries()]);
      
      if (res.ok) {
        const text = await res.text();
        console.log('📄 Raw response text:', text);
        console.log('📄 Response length:', text.length);
        
        if (!text || text.trim() === '') {
          console.error('❌ Empty response from email-hashes.json');
          allowedEmails = [];
          return;
        }
        
        const data = JSON.parse(text);
        console.log('📄 Parsed email config:', data);
        console.log('📄 Config keys:', Object.keys(data));
        
        // Support both legacy format (plain emails) and new format (hashes)
        if (data.allowedEmailHashes && data.allowedEmailHashes.length > 0) {
          // New secure format with hashes
          allowedEmails = data.allowedEmailHashes;
          console.log('✅ Loaded secure email hashes for validation, count:', allowedEmails.length);
          console.log('🔑 First few hashes:', allowedEmails.slice(0, 2));
        } else if (data.allowedEmails && data.allowedEmails.length > 0) {
          // Legacy format - convert plain emails to hashes on-the-fly
          console.warn('⚠️  Found legacy plain-text emails. Converting to hashes...');
          allowedEmails = [];
          
          // Convert legacy emails to hashes if EmailHasher is available
          if (window.emailHasher) {
            for (const email of data.allowedEmails) {
              try {
                const hash = await window.emailHasher.hashEmail(email);
                allowedEmails.push(hash);
              } catch (error) {
                console.error('Failed to hash email:', email, error);
              }
            }
            console.log('✅ Converted legacy emails to hashes, count:', allowedEmails.length);
          } else {
            // Fallback: use plain emails directly (less secure but works)
            console.warn('⚠️  EmailHasher not available, using plain emails (INSECURE!)');
            allowedEmails = data.allowedEmails;
          }
        } else {
          console.warn('⚠️  No allowedEmailHashes or allowedEmails found in config');
          console.warn('📄 Config structure:', Object.keys(data));
          allowedEmails = [];
        }
      } else {
        console.error('❌ Failed to fetch email-hashes.json, status:', res.status);
        allowedEmails = [];
      }
    } catch (error) {
      console.error('❌ Failed to load allowed emails:', error.message);
      allowedEmails = [];
    }
    
    console.log('📋 Final allowedEmails array:', allowedEmails);
  }

  // User name handling is now done by EmailHasher class

  function initializeUserName() {
    const userName = sessionStorage.getItem('userName');
    const userIdentifier = sessionStorage.getItem('userIdentifier');
    const userEmailHash = sessionStorage.getItem('userEmailHash');
    
    if (userName && userIdentifier && userEmailHash) {
      // Already logged in with valid hash-based session
      updateUserDisplay(userName);
      loginModal.style.display = 'none';
      document.body.classList.add('app-loaded');
      logoutBtn.hidden = false;
    } else {
      // Show login modal
      loginModal.style.display = 'flex';
      emailInput.focus();
      logoutBtn.hidden = true;
    }
  }

  async function handleLogin() {
    const email = emailInput.value.trim();
    
    console.log('🔐 Login attempt for email:', email);
    
    if (!email) {
      alert('Please enter an email address');
      return;
    }
    
    console.log('📋 Allowed emails/hashes count:', allowedEmails.length);
    console.log('📧 Checking email:', email);
    
    // Check if we have any allowed emails/hashes
    if (allowedEmails.length === 0) {
      console.error('❌ No allowed emails configured');
      alert('No authorized emails configured. Please contact an administrator.');
      return;
    }
    
    let isValid = false;
    let userHash = null;
    
    // Try different validation methods
    if (window.emailHasher) {
      console.log('✅ EmailHasher available, using secure validation');
      
      try {
        // Method 1: New secure hash validation
        const validation = await window.emailHasher.validateAndHashEmail(email, allowedEmails);
        
        if (validation.isValid) {
          console.log('✅ Hash validation successful');
          isValid = true;
          userHash = validation.hash;
        } else {
          console.log('⚠️  Hash validation failed, trying legacy validation...');
          
          // Method 2: Legacy plain email validation (fallback)
          const normalizedEmail = email.toLowerCase().trim();
          if (allowedEmails.includes(normalizedEmail)) {
            console.log('✅ Legacy validation successful');
            isValid = true;
            userHash = await window.emailHasher.hashEmail(email);
          }
        }
      } catch (error) {
        console.error('❌ Validation error:', error);
      }
    } else {
      console.warn('⚠️  EmailHasher not available, using basic validation');
      // Method 3: Basic validation without hashing (least secure)
      const normalizedEmail = email.toLowerCase().trim();
      isValid = allowedEmails.includes(normalizedEmail);
    }
    
    if (!isValid) {
      console.warn('❌ All validation methods failed');
      alert('Access denied: Email not authorized for this application');
      return;
    }
    
    console.log('✅ Email validation successful');
    
    // Extract display name and create identifiers
    let userName, userIdentifier;
    
    if (window.emailHasher) {
      userName = window.emailHasher.extractDisplayNameFromEmail(email);
      userIdentifier = userHash ? window.emailHasher.createUserIdentifier(userHash) : email.split('@')[0];
    } else {
      // Fallback name extraction
      userName = email.split('@')[0].split('.')[0];
      userName = userName.charAt(0).toUpperCase() + userName.slice(1);
      userIdentifier = email;
    }
    
    if (userName) {
      // Store user data
      sessionStorage.setItem('userName', userName);
      sessionStorage.setItem('userIdentifier', userIdentifier);
      if (userHash) {
        sessionStorage.setItem('userEmailHash', userHash);
      }
      
      updateUserDisplay(userName);
      loginModal.style.display = 'none';
      document.body.classList.add('app-loaded');
      logoutBtn.hidden = false;
      
      // Check for existing cooldown after login
      checkExistingCooldown();
    }
  }

  function handleLogout() {
    // Clear session storage (now includes hashed identifiers)
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('userIdentifier');
    sessionStorage.removeItem('userEmailHash');
    
    // Reset UI
    updateUserDisplay('Guest');
    document.body.classList.remove('app-loaded');
    logoutBtn.hidden = true;
    
    // Enable buttons since cooldown is user-specific
    enableButtons();
    
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
    const userIdentifier = sessionStorage.getItem('userIdentifier');
    if (!userIdentifier) return;
    
    // Disable all member buttons
    for (const btn of memberButtons) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }
    
    // Calculate actual remaining time from localStorage (now using hashed identifier)
    const remainingCooldown = getRemainingCooldown(userIdentifier);
    let remainingSeconds = Math.ceil(remainingCooldown / 1000);
    
    // If no cooldown remaining, don't show the loader
    if (remainingSeconds <= 0) {
      enableButtons();
      return;
    }
    
    // Show loader with countdown
    cooldownLoader.hidden = false;
    cooldownSeconds.textContent = remainingSeconds;
    
    // Restart the progress bar animation with actual remaining time
    const progressBar = cooldownLoader.querySelector('.loader-progress');
    const progressDuration = remainingSeconds;
    progressBar.style.animation = 'none';
    setTimeout(() => {
      progressBar.style.animation = `progressCountdown ${progressDuration}s linear forwards`;
    }, 10);
    
    // Update countdown text every second
    const countdown = setInterval(() => {
      const currentRemainingCooldown = getRemainingCooldown(userIdentifier);
      remainingSeconds = Math.ceil(currentRemainingCooldown / 1000);
      cooldownSeconds.textContent = Math.max(0, remainingSeconds);
      
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
      history = data.history || [];
      
      // Ensure all members exist in the data
      MEMBERS.forEach(member => {
        if (!(member in memberCounts)) {
          memberCounts[member] = 0;
        }
      });
      
      console.log('Loaded coin data:', { count, memberCounts, historyEntries: history.length });
    } catch (error) {
      console.error('Failed to load coin data:', error.message);
      // Use fallback data
      count = 0;
      memberCounts = Object.fromEntries(MEMBERS.map(m=>[m,0]));
      history = [];
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
    // Check if user is logged in with authorized credentials
    const userIdentifier = sessionStorage.getItem('userIdentifier');
    const userEmailHash = sessionStorage.getItem('userEmailHash');
    const userName = sessionStorage.getItem('userName');
    
    if (!userIdentifier || !userEmailHash || !userName) {
      alert('Please log in to vote');
      loginModal.style.display = 'flex';
      emailInput.focus();
      return;
    }
    
    // Verify email hash is still in allowed list (for revoked access)
    if (allowedEmails.length > 0 && !allowedEmails.includes(userEmailHash)) {
      alert('Your access has been revoked. Please contact an administrator.');
      sessionStorage.removeItem('userName');
      sessionStorage.removeItem('userIdentifier');
      sessionStorage.removeItem('userEmailHash');
      loginModal.style.display = 'flex';
      emailInput.focus();
      return;
    }
    
    // User-specific rate limiting using localStorage (with hashed identifier)
    const now = Date.now();
    const remainingCooldown = getRemainingCooldown(userIdentifier);
    
    if (remainingCooldown > 0) {
      const remainingSeconds = Math.ceil(remainingCooldown / 1000);
      alert(`Please wait ${remainingSeconds} seconds before adding another coin`);
      return;
    }
    
    if (!storage) {
      alert('Storage not available. Please check your configuration.');
      return;
    }
    
    // Update user's last click time in localStorage (using hashed identifier)
    setUserLastClickTime(userIdentifier, now);
    
    // Disable all buttons
    disableButtons();
    
    // Get current user info
    const currentUser = sessionStorage.getItem('userName') || 'Anonymous';
    
    // Create history entry
    const historyEntry = {
      id: Date.now() + Math.random(), // Unique ID
      timestamp: new Date().toISOString(),
      member: member,
      addedBy: currentUser,
      action: 'add_coin'
    };
    
    // Optimistically update UI
    count++;
    memberCounts[member] = (memberCounts[member] || 0) + 1;
    history.unshift(historyEntry); // Add to beginning of array
    
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
        members: memberCounts,
        history: history
      };
      
      const savedData = await storage.saveData(dataToSave);
      
      // Update with the actual saved data (in case of concurrent updates)
      count = savedData.total;
      memberCounts = savedData.members;
      history = savedData.history || [];
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
      // Reset user's cooldown on error
      const userIdentifier = sessionStorage.getItem('userIdentifier');
      if (userIdentifier) {
        localStorage.removeItem(getUserCooldownKey(userIdentifier));
      }
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
  
  // History and Stats button event listeners
  if (historyBtn) {
    historyBtn.addEventListener('click', openHistoryViewer);
  }
  
  const statsBtn = document.getElementById('statsBtn');
  if (statsBtn) {
    statsBtn.addEventListener('click', openStatsViewer);
  }
  
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

  // History modal event listeners
  const historyModal = document.getElementById('historyModal');
  const closeHistoryModalBtn = document.getElementById('closeHistoryModal');
  const historyModalBackdrop = historyModal?.querySelector('.modal-backdrop');
  
  closeHistoryModalBtn?.addEventListener('click', () => {
    historyModal.hidden = true;
  });
  
  historyModalBackdrop?.addEventListener('click', () => {
    historyModal.hidden = true;
  });

  // Stats modal event listeners
  const statsModal = document.getElementById('statsModal');
  const closeStatsModalBtn = document.getElementById('closeStatsModal');
  const statsModalBackdrop = statsModal?.querySelector('.modal-backdrop');
  
  closeStatsModalBtn?.addEventListener('click', () => {
    statsModal.hidden = true;
  });
  
  statsModalBackdrop?.addEventListener('click', () => {
    statsModal.hidden = true;
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

  // History viewer function
  function openHistoryViewer() {
    const historyModal = document.getElementById('historyModal');
    const historyContent = document.getElementById('historyContent');
    
    // Generate history content
    const historyHtml = history.length === 0 ? 
      '<div class="history-empty">No complaints recorded yet. Start complaining to build the history!</div>' :
      `
        <div style="text-align: center; margin-bottom: 1rem; padding: 0.75rem; background: rgba(37, 99, 235, 0.1); border-radius: 0.375rem; color: var(--text-secondary);">
          <strong>${history.length}</strong> total entries • <strong>${count}</strong> complaints (${count * VALUE_PER_COIN} SEK)
        </div>
        ${history.map(entry => {
          const date = new Date(entry.timestamp);
          const timeAgo = getTimeAgo(date);
          const formattedTime = date.toLocaleString();
          
          return `
            <div class="history-item">
              <div class="history-details">
                <div class="history-action">
                  🪙 <strong style="color: var(--accent);">${entry.addedBy}</strong> added a coin for <strong style="color: var(--accent);">${entry.member}</strong>
                </div>
                <div class="history-meta">
                  <span>${formattedTime}</span>
                  <span class="history-timestamp">${timeAgo}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      `;
    
    // Set content and show modal
    historyContent.innerHTML = historyHtml;
    historyModal.hidden = false;
  }
  
  // Helper function for time ago
  function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return diffMinutes + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 30) return diffDays + 'd ago';
    return date.toLocaleDateString();
  }

  // Statistics functions
  function generateStatsData() {
    const statsData = {};
    
    // Initialize stats for all members
    MEMBERS.forEach(member => {
      statsData[member] = {
        given: 0,     // Complaints they reported about others
        received: memberCounts[member] || 0  // Complaints they received
      };
    });
    
    // Calculate given complaints from history
    history.forEach(entry => {
      if (entry.addedBy && statsData[entry.addedBy] !== undefined) {
        statsData[entry.addedBy].given++;
      }
    });
    
    return statsData;
  }
  
  function generateTimeBasedData() {
    if (history.length === 0) return { timePoints: [], memberData: {} };
    
    // Sort history by timestamp
    const sortedHistory = [...history].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Initialize member data
    const memberData = {};
    MEMBERS.forEach(member => {
      memberData[member] = {
        given: [],
        received: []
      };
    });
    
    // Group data by weeks
    const weeklyData = {};
    
    // Helper function to get the start of week (Monday) as key
    function getWeekKey(date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return monday.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    
    // Process each history entry and group by week
    sortedHistory.forEach(entry => {
      const weekKey = getWeekKey(entry.timestamp);
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          startDate: new Date(weekKey),
          given: {},
          received: {}
        };
        MEMBERS.forEach(member => {
          weeklyData[weekKey].given[member] = 0;
          weeklyData[weekKey].received[member] = 0;
        });
      }
      
      // Count complaints for this week
      if (entry.addedBy && weeklyData[weekKey].given[entry.addedBy] !== undefined) {
        weeklyData[weekKey].given[entry.addedBy]++;
      }
      if (entry.member && weeklyData[weekKey].received[entry.member] !== undefined) {
        weeklyData[weekKey].received[entry.member]++;
      }
    });
    
    // Sort weeks chronologically
    const sortedWeeks = Object.keys(weeklyData).sort();
    
    // Add one week earlier than the first data point for better context
    if (sortedWeeks.length > 0) {
      const firstWeekDate = new Date(sortedWeeks[0]);
      firstWeekDate.setDate(firstWeekDate.getDate() - 7); // Go back one week
      const earlierWeekKey = firstWeekDate.toISOString().split('T')[0];
      
      // Only add if it's not already in the data
      if (!weeklyData[earlierWeekKey]) {
        weeklyData[earlierWeekKey] = {
          startDate: firstWeekDate,
          given: {},
          received: {}
        };
        MEMBERS.forEach(member => {
          weeklyData[earlierWeekKey].given[member] = 0;
          weeklyData[earlierWeekKey].received[member] = 0;
        });
        
        // Re-sort weeks to include the new earlier week
        sortedWeeks.unshift(earlierWeekKey);
      }
    }
    
    // Calculate cumulative data for each week
    const cumulativeGiven = {};
    const cumulativeReceived = {};
    MEMBERS.forEach(member => {
      cumulativeGiven[member] = 0;
      cumulativeReceived[member] = 0;
    });
    
    const timePoints = [];
    
    sortedWeeks.forEach(weekKey => {
      const weekData = weeklyData[weekKey];
      
      // Update cumulative counts
      MEMBERS.forEach(member => {
        cumulativeGiven[member] += weekData.given[member];
        cumulativeReceived[member] += weekData.received[member];
      });
      
      // Create time point for this week
      const startDate = weekData.startDate;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      
      timePoints.push({
        timestamp: startDate,
        label: `Week of ${startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
      });
      
      // Record current cumulative values for all members
      MEMBERS.forEach(member => {
        memberData[member].given.push(cumulativeGiven[member]);
        memberData[member].received.push(cumulativeReceived[member]);
      });
    });
    
    return { timePoints, memberData };
  }
  
  let currentChartType = 'bar'; // Track current chart type
  
  function openStatsViewer() {
    const statsModal = document.getElementById('statsModal');
    const statsContent = document.getElementById('statsContent');
    const statsSummary = document.getElementById('statsSummary');
    const statsLegend = document.getElementById('statsLegend');
    
    const statsData = generateStatsData();
    
    // Create summary
    const totalGiven = Object.values(statsData).reduce((sum, data) => sum + data.given, 0);
    const totalReceived = Object.values(statsData).reduce((sum, data) => sum + data.received, 0);
    
    statsSummary.innerHTML = `
      <strong>${totalGiven}</strong> total complaints reported • 
      <strong>${totalReceived}</strong> total complaints
    `;
    
    // Create legend
    updateLegend();
    
    // Setup toggle button event listeners
    setupChartToggle();
    
    // Draw initial chart
    drawChart();
    
    // Show modal
    statsModal.hidden = false;
  }
  
  function setupChartToggle() {
    const barChartBtn = document.getElementById('barChartBtn');
    const lineChartBtn = document.getElementById('lineChartBtn');
    
    // Remove existing listeners
    barChartBtn.replaceWith(barChartBtn.cloneNode(true));
    lineChartBtn.replaceWith(lineChartBtn.cloneNode(true));
    
    // Get the new elements
    const newBarChartBtn = document.getElementById('barChartBtn');
    const newLineChartBtn = document.getElementById('lineChartBtn');
    
    newBarChartBtn.addEventListener('click', () => {
      currentChartType = 'bar';
      newBarChartBtn.classList.add('active');
      newLineChartBtn.classList.remove('active');
      updateLegend();
      drawChart();
    });
    
    newLineChartBtn.addEventListener('click', () => {
      currentChartType = 'line';
      newLineChartBtn.classList.add('active');
      newBarChartBtn.classList.remove('active');
      updateLegend();
      drawChart();
    });
  }
  
  function updateLegend() {
    const statsLegend = document.getElementById('statsLegend');
    
    if (currentChartType === 'bar') {
      statsLegend.innerHTML = `
        <div class="legend-item">
          <div class="legend-color" style="background: #2563eb;"></div>
          <span>Complaints Reported</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #dc2626;"></div>
          <span>Complaints</span>
        </div>
      `;
    } else {
      // For line chart, show member-specific legend
      const colors = [
        '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', 
        '#db2777', '#0891b2', '#65a30d'
      ];
      
      let legendHtml = '<div class="line-legend-container">';
      
      // Add explanation header
      legendHtml += `
        <div class="legend-section">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 0.9rem;">Line Styles:</h4>
          <div class="legend-item">
            <div class="legend-line-dashed"></div>
            <span>Reported (dashed line, ●)</span>
          </div>
          <div class="legend-item">
            <div class="legend-line-solid"></div>
            <span>Complaints (solid line, ◆)</span>
          </div>
        </div>
      `;
      
      // Add member colors
      legendHtml += `
        <div class="legend-section">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 0.9rem;">Members:</h4>
          <div class="legend-members">
      `;
      
      MEMBERS.forEach((member, index) => {
        const color = colors[index % colors.length];
        legendHtml += `
          <div class="legend-item">
            <div class="legend-color" style="background: ${color};"></div>
            <span>${member}</span>
          </div>
        `;
      });
      
      legendHtml += '</div></div></div>';
      statsLegend.innerHTML = legendHtml;
    }
  }
  
  function drawChart() {
    if (currentChartType === 'bar') {
      const statsData = generateStatsData();
      drawStatsChart(statsData);
    } else {
      const timeData = generateTimeBasedData();
      drawLineChart(timeData);
    }
  }
  
  function drawStatsChart(statsData) {
    const canvas = document.getElementById('statsChart');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const members = Object.keys(statsData);
    const maxValue = Math.max(
      ...Object.values(statsData).map(data => Math.max(data.given, data.received)),
      1 // Ensure minimum of 1 to avoid division by zero
    );
    
    // Chart dimensions
    const chartWidth = canvas.width - 100;
    const chartHeight = canvas.height - 80;
    const chartX = 60;
    const chartY = 40;
    const barWidth = chartWidth / (members.length * 2 + 1);
    
    // Set styles
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    
    // Draw bars and labels
    members.forEach((member, index) => {
      const data = statsData[member];
      const x = chartX + (index * 2 + 1) * barWidth;
      
      // Given bar (blue)
      const givenHeight = (data.given / maxValue) * chartHeight;
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x - barWidth * 0.4, chartY + chartHeight - givenHeight, barWidth * 0.35, givenHeight);
      
      // Received bar (red)
      const receivedHeight = (data.received / maxValue) * chartHeight;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + barWidth * 0.05, chartY + chartHeight - receivedHeight, barWidth * 0.35, receivedHeight);
      
      // Member name
      ctx.fillStyle = '#ffffff';
      ctx.fillText(member, x, chartY + chartHeight + 20);
      
      // Values on bars if they're large enough
      if (givenHeight > 20) {
        ctx.fillText(data.given.toString(), x - barWidth * 0.225, chartY + chartHeight - givenHeight + 15);
      }
      if (receivedHeight > 20) {
        ctx.fillText(data.received.toString(), x + barWidth * 0.225, chartY + chartHeight - receivedHeight + 15);
      }
    });
    
    // Draw Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue / 5) * i);
      const y = chartY + chartHeight - (chartHeight / 5) * i;
      ctx.fillStyle = '#a0a0a0';
      ctx.fillText(value.toString(), chartX - 10, y + 4);
      
      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartWidth, y);
      ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY);
    ctx.lineTo(chartX, chartY + chartHeight);
    ctx.lineTo(chartX + chartWidth, chartY + chartHeight);
    ctx.stroke();
  }
  
  function drawLineChart(timeData) {
    const canvas = document.getElementById('statsChart');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const { timePoints, memberData } = timeData;
    
    if (timePoints.length === 0) {
      // Draw "No data" message
      ctx.fillStyle = '#a0a0a0';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No historical data available', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    // Chart dimensions
    const chartWidth = canvas.width - 120;
    const chartHeight = canvas.height - 100;
    const chartX = 80;
    const chartY = 40;
    
    // Find max value for scaling
    let maxValue = 0;
    Object.values(memberData).forEach(data => {
      maxValue = Math.max(maxValue, ...data.given, ...data.received);
    });
    maxValue = Math.max(maxValue, 1); // Ensure minimum of 1
    
    // Colors for different members
    const colors = [
      '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', 
      '#db2777', '#0891b2', '#65a30d'
    ];
    
    // Draw grid lines and Y-axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue / 5) * i);
      const y = chartY + chartHeight - (chartHeight / 5) * i;
      ctx.fillText(value.toString(), chartX - 10, y + 4);
      
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartWidth, y);
      ctx.stroke();
    }
    
    // Draw X-axis time labels
    ctx.textAlign = 'center';
    const maxLabels = Math.min(8, timePoints.length); // Show more labels for weeks, but cap at 8
    const labelInterval = Math.max(1, Math.floor(timePoints.length / maxLabels));
    
    timePoints.forEach((point, index) => {
      if (index % labelInterval === 0 || index === timePoints.length - 1) {
        const x = chartX + (index / Math.max(1, timePoints.length - 1)) * chartWidth;
        // Use the label from the time point which is already formatted for weeks
        const shortLabel = point.label.replace('Week of ', '');
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(shortLabel, x, chartY + chartHeight + 20);
      }
    });
    
    // Draw lines for each member's given complaints
    MEMBERS.forEach((member, memberIndex) => {
      const data = memberData[member];
      if (data && data.given.some(val => val > 0)) { // Only draw if member has given complaints
        const color = colors[memberIndex % colors.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]); // Dashed line for reported
        ctx.beginPath();
        
        data.given.forEach((value, index) => {
          const x = chartX + (index / Math.max(1, timePoints.length - 1)) * chartWidth;
          const y = chartY + chartHeight - (value / maxValue) * chartHeight;
          
          // Only draw lines if we have more than one point
          if (timePoints.length > 1) {
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        });
        
        // Only stroke if we have lines to draw
        if (timePoints.length > 1) {
          ctx.stroke();
        }
        
        // Draw circle points for given complaints
        ctx.fillStyle = color;
        data.given.forEach((value, index) => {
          const x = chartX + (index / Math.max(1, timePoints.length - 1)) * chartWidth;
          const y = chartY + chartHeight - (value / maxValue) * chartHeight;
          
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fill();
          
          // Add white border for better visibility
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
    });
    
    // Draw lines for each member's received complaints (dashed)
    MEMBERS.forEach((member, memberIndex) => {
      const data = memberData[member];
      if (data && data.received.some(val => val > 0)) { // Only draw if member has received complaints
        const color = colors[memberIndex % colors.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([]); // Solid line for complaints
        ctx.beginPath();
        
        data.received.forEach((value, index) => {
          const x = chartX + (index / Math.max(1, timePoints.length - 1)) * chartWidth;
          const y = chartY + chartHeight - (value / maxValue) * chartHeight;
          
          // Only draw lines if we have more than one point
          if (timePoints.length > 1) {
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        });
        
        // Only stroke if we have lines to draw
        if (timePoints.length > 1) {
          ctx.stroke();
        }
        
        // Draw diamond points for received complaints
        ctx.setLineDash([]); // Reset line dash for points
        ctx.fillStyle = color;
        data.received.forEach((value, index) => {
          const x = chartX + (index / Math.max(1, timePoints.length - 1)) * chartWidth;
          const y = chartY + chartHeight - (value / maxValue) * chartHeight;
          
          // Draw diamond shape
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-4, -4, 8, 8);
          
          // Add white border for better visibility
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(-4, -4, 8, 8);
          ctx.restore();
        });
      }
    });
    
    // Draw axes
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY);
    ctx.lineTo(chartX, chartY + chartHeight);
    ctx.lineTo(chartX + chartWidth, chartY + chartHeight);
    ctx.stroke();
  }

  // Keyboard accessibility: space/enter when focused on button is native; no extra needed.

  // Check for existing user cooldown on page load
  function checkExistingCooldown() {
    const userIdentifier = sessionStorage.getItem('userIdentifier');
    if (!userIdentifier) return;
    
    const remainingCooldown = getRemainingCooldown(userIdentifier);
    if (remainingCooldown > 0) {
      disableButtons();
    }
  }

  // Initialize app
  async function init() {
    console.log('Initializing Complain Can app...');
    
    // Wait for EmailHasher to be available
    let attempts = 0;
    while (!window.emailHasher && attempts < 50) {
      console.log('Waiting for EmailHasher to load...');
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.emailHasher) {
      console.error('❌ EmailHasher failed to load - login functionality will not work');
      alert('Email hashing system failed to load. Please refresh the page.');
      return;
    }
    
    console.log('✅ EmailHasher loaded successfully');
    
    // Initialize storage first
    storage = initStorage();
    
    await loadAllowedEmails();
    initializeUserName();
    await load();
    
    // Check if user has an existing cooldown
    checkExistingCooldown();
    
    console.log('App initialized successfully');
  }
  
  init();
})();
