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
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginSubtitle = document.getElementById('loginSubtitle');
  const loginFooterNote = document.getElementById('loginFooterNote');
  const cooldownLoader = document.getElementById('cooldownLoader');
  const cooldownSeconds = document.getElementById('cooldownSeconds');
  const jar = document.querySelector('.jar');
  const jarNeck = document.querySelector('.jar-neck');
  const MEMBERS = ['Isac','Hannah','Andreas','Karl','Daniel','Doug','Marina'];
  const VALUE_PER_COIN = 5; // SEK per coin

  let count = 0;
  let memberCounts = Object.fromEntries(MEMBERS.map(m=>[m,0]));
  let history = [];
  let withdrawals = []; // Track withdrawal history
  let storage = null;
  let currentSession = null;
  let bootstrap = null;
  const RATE_LIMIT_MS = 30000; // 30 seconds
  
  // User-specific cooldown functions using localStorage (now with hashed identifiers)
  function getUserCooldownKey(userIdentifier) {
    return `cooldown_${userIdentifier}`;
  }
  
  function getUserLastClickTime(userIdentifier) {
    if (!userIdentifier) return 0;
    const stored = localStorage.getItem(getUserCooldownKey(userIdentifier));
    return stored ? Number.parseInt(stored, 10) : 0;
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
    if (globalThis.ApiStorage === undefined) {
      console.error('Missing ApiStorage. Make sure api-storage.js is loaded.');
      return null;
    }
    return new globalThis.ApiStorage();
  }

  // Session management functions
  function normalizeSession(sessionPayload) {
    if (!sessionPayload?.authenticated || !sessionPayload.user) {
      return null;
    }

    return {
      userName: sessionPayload.user.displayName || sessionPayload.user.login,
      userIdentifier: sessionPayload.user.login,
      userLogin: sessionPayload.user.login,
      authProvider: sessionPayload.user.provider,
      avatarUrl: sessionPayload.user.avatarUrl || ''
    };
  }

  async function loadBootstrap() {
    try {
      bootstrap = await storage.getBootstrap();
      updateLoginCopy();
    } catch (error) {
      console.error('❌ Failed to load bootstrap config:', error.message);
      bootstrap = { authMode: 'github', loginPath: storage.resolveUrl('/api/auth/login') };
    }

    return bootstrap;
  }

  function clearUserSession() {
    currentSession = null;
    console.log('🗑️ Session cleared');
  }

  async function refreshUserSession() {
    try {
      const sessionPayload = await storage.getSession();
      currentSession = normalizeSession(sessionPayload);
    } catch (error) {
      console.error('❌ Failed to load session:', error.message);
      currentSession = null;
    }

    return currentSession;
  }

  function getCurrentUserSession() {
    return currentSession;
  }

  function trackUserActivity() {
    return currentSession;
  }

  function updateLoginCopy() {
    if (!loginBtn) {
      return;
    }

    const isDevelopmentAuth = bootstrap?.authMode === 'development';
    loginBtn.textContent = isDevelopmentAuth ? 'Continue In Local Mode' : 'Continue With GitHub';

    if (loginSubtitle) {
      loginSubtitle.textContent = isDevelopmentAuth
        ? 'Local development mode is enabled for this server.'
        : 'Sign in with GitHub to access the complaint can.';
    }

    if (loginFooterNote) {
      loginFooterNote.textContent = isDevelopmentAuth
        ? 'Authentication is mocked locally until GitHub OAuth is configured.'
        : 'Authentication is verified server-side with your GitHub account.';
    }
  }

  function showLoginModal() {
    loginModal.style.display = 'flex';
    loginBtn?.focus();
  }

  function hideLoginModal() {
    loginModal.style.display = 'none';
  }

  function initializeUserName() {
    const session = getCurrentUserSession();
    
    if (session) {
      console.log('🔐 Restoring user session for:', session.userName);
      updateUserDisplay(session.userName);
      hideLoginModal();
      document.body.classList.add('app-loaded');
      logoutBtn.hidden = false;
    } else {
      console.log('🔑 No valid session found, showing login');
      showLoginModal();
      logoutBtn.hidden = true;
    }
  }

  async function handleLogin() {
    const loginPath = storage.resolveUrl(bootstrap?.loginPath || '/api/auth/login');
    const nextPath = storage.getLoginReturnTarget();
    console.log('🔐 Redirecting to server-side auth flow');

    if (!loginPath) {
      alert('Authentication is not configured on this server.');
      return;
    }

    globalThis.location.assign(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
  }

  async function handleLogout() {
    try {
      await storage.logout();
    } catch (error) {
      console.error('Failed to log out cleanly:', error.message);
    }

    clearUserSession();
    
    updateUserDisplay('Guest');
    document.body.classList.remove('app-loaded');
    logoutBtn.hidden = true;
    
    enableButtons();
    
    showLoginModal();
  }

  // Login button click
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
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
      if (!getCurrentUserSession()) {
        showLoginModal();
      }
    });
  }

  function disableButtons() {
    const session = getCurrentUserSession();
    const userIdentifier = session?.userIdentifier;
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
      withdrawals = data.withdrawals || []; // Load withdrawal history
      
      // Ensure all members exist in the data
      MEMBERS.forEach(member => {
        if (!(member in memberCounts)) {
          memberCounts[member] = 0;
        }
      });
      
      console.log('Loaded coin data:', { count, memberCounts, historyEntries: history.length, withdrawalsCount: withdrawals.length });
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
    const fragment = document.createDocumentFragment();
    // Render all coins - they layer on top of each other
    for (let i = 0; i < n; i++) {
      const coin = createPositionedCoin(i, false);
      fragment.appendChild(coin);
    }
    container.replaceChildren(fragment);
  }

  async function addCoin(member) {
    const session = getCurrentUserSession();
    const userIdentifier = session?.userIdentifier;
    const userName = session?.userName;
    
    if (!userIdentifier || !userName) {
      alert('Please log in to vote');
      showLoginModal();
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
    
    // Track user activity to extend session
    trackUserActivity();
    
    // Disable all buttons
    disableButtons();
    
    // Get current user info
    const currentUser = session?.userName || 'Anonymous';
    
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
    
    try {
      const savedData = await storage.addCoin(member);
      
      count = savedData.total;
      memberCounts = savedData.members;
      history = savedData.history || [];
      withdrawals = savedData.withdrawals || [];
      updateDisplay();
      renderMemberStats();
      
      console.log(`Coin added for ${member}. Total: ${count}`);
    } catch (error) {
      console.error('Failed to save coin:', error.message);
      
      let errorMessage = 'Failed to save coin data!';
      if (error.status === 401) {
        errorMessage = 'Your session has expired. Please sign in again.';
      } else if (error.status === 403) {
        errorMessage = 'You are not allowed to add complaints.';
      } else if (error.status === 429) {
        const remainingSeconds = error.payload?.remainingSeconds;
        errorMessage = remainingSeconds
          ? `Please wait ${remainingSeconds} seconds before adding another complaint.`
          : 'Please wait before adding another complaint.';
      }
      
      alert(errorMessage);
      
      // Rollback optimistic update
      count--;
      memberCounts[member] = (memberCounts[member] || 1) - 1;
      history.shift();
      updateDisplay();
      renderMemberStats();
      if (userIdentifier) {
        localStorage.removeItem(getUserCooldownKey(userIdentifier));
      }
      if (error.status === 401 || error.status === 403) {
        clearUserSession();
        showLoginModal();
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

  let resizeRenderFrame = 0;
  globalThis.addEventListener('resize', () => {
    if (resizeRenderFrame) {
      cancelAnimationFrame(resizeRenderFrame);
    }

    resizeRenderFrame = requestAnimationFrame(() => {
      resizeRenderFrame = 0;
      renderCoins(count);
    });
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
  globalThis.resetCoins = actualReset;

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

  // Withdraw modal event listeners
  const withdrawModal = document.getElementById('withdrawModal');
  const withdrawBtn = document.getElementById('withdrawBtn');
  const cancelWithdrawBtn = document.getElementById('cancelWithdraw');
  const confirmWithdrawBtn = document.getElementById('confirmWithdraw');
  const withdrawModalBackdrop = withdrawModal?.querySelector('.modal-backdrop');
  
  withdrawBtn?.addEventListener('click', openWithdrawModal);
  
  cancelWithdrawBtn?.addEventListener('click', () => {
    withdrawModal.hidden = true;
  });
  
  withdrawModalBackdrop?.addEventListener('click', () => {
    withdrawModal.hidden = true;
  });
  
  confirmWithdrawBtn?.addEventListener('click', performWithdraw);
  
  // Withdrawals history modal event listeners
  const withdrawalsModal = document.getElementById('withdrawalsModal');
  const withdrawalsBtn = document.getElementById('withdrawalsBtn');
  const closeWithdrawalsModalBtn = document.getElementById('closeWithdrawalsModal');
  const withdrawalsModalBackdrop = withdrawalsModal?.querySelector('.modal-backdrop');
  
  withdrawalsBtn?.addEventListener('click', openWithdrawalsViewer);
  
  closeWithdrawalsModalBtn?.addEventListener('click', () => {
    withdrawalsModal.hidden = true;
  });
  
  withdrawalsModalBackdrop?.addEventListener('click', () => {
    withdrawalsModal.hidden = true;
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

  function getWeekKey(date) {
    const weekDate = new Date(date);
    const day = weekDate.getDay();
    const diff = weekDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(weekDate.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
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
    const sortedWeeks = Object.keys(weeklyData).sort((left, right) => left.localeCompare(right));
    
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
    const statsSummary = document.getElementById('statsSummary');
    
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
      if (data?.given.some(val => val > 0)) { // Only draw if member has given complaints
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
      if (data?.received.some(val => val > 0)) { // Only draw if member has received complaints
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

  // ===== WITHDRAW FUNCTIONS =====
  
  function openWithdrawModal() {
    const withdrawModal = document.getElementById('withdrawModal');
    const withdrawSummary = document.getElementById('withdrawSummary');
    const withdrawNoteInput = document.getElementById('withdrawNote');
    const withdrawPasswordInput = document.getElementById('withdrawPassword');
    const withdrawPasswordError = document.getElementById('withdrawPasswordError');
    
    // Check if there's anything to withdraw
    if (count === 0) {
      alert('Nothing to withdraw! The can is empty.');
      return;
    }
    
    // Check if user is logged in
    const session = getCurrentUserSession();
    if (!session) {
      alert('Please log in to withdraw funds');
      showLoginModal();
      return;
    }
    
    // Clear password field and hide error
    if (withdrawPasswordInput) {
      withdrawPasswordInput.value = '';
    }
    if (withdrawPasswordError) {
      withdrawPasswordError.hidden = true;
    }
    
    const totalAmount = count * VALUE_PER_COIN;
    
    // Get date range from history
    let periodStart = 'N/A';
    let periodEnd = new Date().toLocaleDateString();
    if (history.length > 0) {
      const sortedHistory = [...history].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      periodStart = new Date(sortedHistory[0].timestamp).toLocaleDateString();
    }
    
    // Generate leaderboard for summary
    const sorted = Object.entries(memberCounts).sort((a, b) => b[1] - a[1]);
    const topComplainers = sorted.filter(([, cnt]) => cnt > 0).slice(0, 3);
    const leaderboardHtml = topComplainers.length > 0 
      ? topComplainers.map(([name, cnt], idx) => {
          const medals = ['🥇', '🥈', '🥉'];
          return `${medals[idx]} ${name}: ${cnt}`;
        }).join(' • ')
      : 'No complaints yet';
    
    withdrawSummary.innerHTML = `
      <div class="withdraw-amount">${totalAmount} SEK</div>
      <div class="withdraw-details">
        <strong>${count}</strong> complaint${count === 1 ? '' : 's'} • Period: ${periodStart} - ${periodEnd}<br>
        <span style="font-size: 0.85rem; margin-top: 0.5rem; display: inline-block;">
          ${leaderboardHtml}
        </span>
      </div>
    `;
    
    // Clear note input
    if (withdrawNoteInput) {
      withdrawNoteInput.value = '';
    }
    
    withdrawModal.hidden = false;
  }
  
  async function performWithdraw() {
    const withdrawModal = document.getElementById('withdrawModal');
    const withdrawNoteInput = document.getElementById('withdrawNote');
    const withdrawPasswordInput = document.getElementById('withdrawPassword');
    const withdrawPasswordError = document.getElementById('withdrawPasswordError');
    
    // Check if user is logged in
    const session = getCurrentUserSession();
    if (!session) {
      alert('Please log in to withdraw funds');
      withdrawModal.hidden = true;
      return;
    }
    
    // Validate password
    const password = withdrawPasswordInput?.value || '';
    if (!password) {
      if (withdrawPasswordError) {
        withdrawPasswordError.textContent = 'Password is required';
        withdrawPasswordError.hidden = false;
      }
      withdrawPasswordInput?.focus();
      return;
    }
    
    if (withdrawPasswordError) {
      withdrawPasswordError.hidden = true;
    }
    
    if (!storage) {
      alert('Storage not available. Please check your configuration.');
      return;
    }
    
    const totalAmount = count * VALUE_PER_COIN;

    try {
      const response = await storage.withdraw({
        note: withdrawNoteInput?.value.trim() || '',
        password
      });
      const savedData = response.state || response;
      
      count = savedData.total;
      memberCounts = savedData.members;
      history = savedData.history || [];
      withdrawals = savedData.withdrawals || [];
      
      // Update UI
      updateDisplay();
      renderCoins(count);
      renderMemberStats();
      toggleReset();
      
      withdrawModal.hidden = true;
      
      setTimeout(() => {
        alert(`Successfully withdrew ${totalAmount} SEK! 🎉\nThe can has been reset for a new period.`);
      }, 100);
      
      console.log('Withdrawal completed:', response.withdrawal || savedData);
    } catch (error) {
      console.error('Failed to save withdrawal:', error.message);

      if (withdrawPasswordError && error.status === 403) {
        withdrawPasswordError.textContent = 'Incorrect password';
        withdrawPasswordError.hidden = false;
        withdrawPasswordInput?.select();
        return;
      }

      if (error.status === 401) {
        clearUserSession();
        withdrawModal.hidden = true;
        showLoginModal();
      }

      alert('Failed to process withdrawal: ' + error.message);
    }
  }
  
  function openWithdrawalsViewer() {
    const withdrawalsModal = document.getElementById('withdrawalsModal');
    const withdrawalsContent = document.getElementById('withdrawalsContent');
    
    if (withdrawals.length === 0) {
      withdrawalsContent.innerHTML = `
        <div class="withdrawals-empty">
          <p>No withdrawals yet.</p>
          <p>When you withdraw funds, the history will be saved here!</p>
        </div>
      `;
      withdrawalsModal.hidden = false;
      return;
    }
    
    // Calculate total withdrawn
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const totalCoins = withdrawals.reduce((sum, w) => sum + w.coinCount, 0);
    
    let html = `
      <div class="withdrawals-total">
        <div class="withdrawals-total-amount">${totalWithdrawn} SEK</div>
        <div class="withdrawals-total-label">
          Total withdrawn across ${withdrawals.length} withdrawal${withdrawals.length === 1 ? '' : 's'} (${totalCoins} coins)
        </div>
      </div>
    `;
    
    // List each withdrawal
    withdrawals.forEach((withdrawal, index) => {
      const date = new Date(withdrawal.timestamp);
      const periodStart = new Date(withdrawal.period.startDate).toLocaleDateString();
      const periodEnd = new Date(withdrawal.period.endDate).toLocaleDateString();
      
      // Generate leaderboard
      const sorted = Object.entries(withdrawal.memberCounts).sort((a, b) => b[1] - a[1]);
      const rankForCount = new Map();
      for (const [, cnt] of sorted) {
        if (cnt === 0) break;
        if (!rankForCount.has(cnt) && rankForCount.size < 3) {
          rankForCount.set(cnt, rankForCount.size + 1);
        }
      }
      
      const leaderboardHtml = sorted
        .filter(([, cnt]) => cnt > 0)
        .map(([name, cnt]) => {
          const rank = rankForCount.get(cnt) || 0;
          let rankClass = '';
          if (rank === 1) rankClass = 'gold';
          else if (rank === 2) rankClass = 'silver';
          else if (rank === 3) rankClass = 'bronze';
          return `<span class="withdrawal-member-stat ${rankClass}">${name}: ${cnt}</span>`;
        }).join('');
      
      html += `
        <div class="withdrawal-item" data-index="${index}">
          <div class="withdrawal-header" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('expanded');">
            <div class="withdrawal-header-left">
              <div class="withdrawal-date">${date.toLocaleDateString()} at ${date.toLocaleTimeString()}</div>
              ${withdrawal.note ? `<div class="withdrawal-note">"${withdrawal.note}"</div>` : ''}
            </div>
            <div class="withdrawal-header-right">
              <div class="withdrawal-amount-badge">${withdrawal.amount} SEK</div>
              <div class="withdrawal-coins-count">${withdrawal.coinCount} coin${withdrawal.coinCount === 1 ? '' : 's'}</div>
            </div>
            <span class="expand-indicator">▼</span>
          </div>
          <div class="withdrawal-details-panel">
            <div class="withdrawal-section">
              <div class="withdrawal-section-title">📅 Period</div>
              <div class="withdrawal-period">${periodStart} - ${periodEnd}</div>
            </div>
            <div class="withdrawal-section">
              <div class="withdrawal-section-title">🏆 Leaderboard</div>
              <div class="withdrawal-leaderboard">${leaderboardHtml || '<span style="color: var(--text-secondary);">No complaints in this period</span>'}</div>
            </div>
            <div class="withdrawal-section">
              <div class="withdrawal-section-title">👤 Withdrawn by</div>
              <div class="withdrawal-period">${withdrawal.withdrawnBy}</div>
            </div>
            <div class="withdrawal-section withdrawal-expandable">
              <div class="withdrawal-section-header" onclick="this.parentElement.classList.toggle('section-expanded'); if(this.parentElement.classList.contains('section-expanded')) { drawWithdrawalChartById(${index}); }">
                <div class="withdrawal-section-title">📊 Analytics</div>
                <span class="section-expand-indicator">▶</span>
              </div>
              <div class="withdrawal-section-content">
                <div class="withdrawal-chart-container">
                  <canvas id="withdrawalChart-${index}" width="400" height="200"></canvas>
                </div>
              </div>
            </div>
            <div class="withdrawal-section withdrawal-expandable">
              <div class="withdrawal-section-header" onclick="this.parentElement.classList.toggle('section-expanded');">
                <div class="withdrawal-section-title">📜 History (${withdrawal.history?.length || 0} entries)</div>
                <span class="section-expand-indicator">▶</span>
              </div>
              <div class="withdrawal-section-content">
                <div class="withdrawal-history-list">
                  ${generateWithdrawalHistoryHtml(withdrawal.history || [])}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    withdrawalsContent.innerHTML = html;
    withdrawalsModal.hidden = false;
  }
  
  // Global function to draw chart when section is expanded
  globalThis.drawWithdrawalChartById = function(index) {
    if (withdrawals[index]) {
      drawWithdrawalChart(withdrawals[index], index);
    }
  };
  
  function generateWithdrawalHistoryHtml(historyEntries) {
    if (!historyEntries || historyEntries.length === 0) {
      return '<div class="withdrawal-history-empty">No history entries</div>';
    }
    
    // Show last 10 entries, with option to expand
    const displayEntries = historyEntries.slice(0, 10);
    const hasMore = historyEntries.length > 10;
    
    let html = displayEntries.map(entry => {
      const date = new Date(entry.timestamp);
      const timeAgo = getTimeAgo(date);
      return `
        <div class="withdrawal-history-item">
          <span class="withdrawal-history-action">🪙 <strong>${entry.addedBy}</strong> → <strong>${entry.member}</strong></span>
          <span class="withdrawal-history-time">${timeAgo}</span>
        </div>
      `;
    }).join('');
    
    if (hasMore) {
      html += `<div class="withdrawal-history-more">...and ${historyEntries.length - 10} more entries</div>`;
    }
    
    return html;
  }
  
  function drawWithdrawalChart(withdrawal, index) {
    const canvas = document.getElementById(`withdrawalChart-${index}`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const memberCounts = withdrawal.memberCounts || {};
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const members = Object.keys(memberCounts);
    const maxValue = Math.max(...Object.values(memberCounts), 1);
    
    // Chart dimensions
    const chartWidth = canvas.width - 80;
    const chartHeight = canvas.height - 60;
    const chartX = 50;
    const chartY = 20;
    const barWidth = chartWidth / (members.length * 2 + 1);
    
    // Draw bars
    members.forEach((member, i) => {
      const count = memberCounts[member];
      const barHeight = (count / maxValue) * chartHeight;
      const x = chartX + (i * 2 + 1) * barWidth;
      const y = chartY + chartHeight - barHeight;
      
      // Bar color based on rank
      const sorted = Object.entries(memberCounts).sort((a, b) => b[1] - a[1]);
      const rank = sorted.findIndex(([m]) => m === member);
      
      if (rank === 0 && count > 0) ctx.fillStyle = '#f59e0b'; // Gold
      else if (rank === 1 && count > 0) ctx.fillStyle = '#9ca3af'; // Silver
      else if (rank === 2 && count > 0) ctx.fillStyle = '#d97706'; // Bronze
      else ctx.fillStyle = '#2563eb'; // Default blue
      
      ctx.fillRect(x, y, barWidth * 0.8, barHeight);
      
      // Member name
      ctx.fillStyle = '#a0a0a0';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(member.slice(0, 6), x + barWidth * 0.4, chartY + chartHeight + 15);
      
      // Value on bar
      if (barHeight > 15) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(count.toString(), x + barWidth * 0.4, y + 12);
      }
    });
    
    // Draw Y-axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY);
    ctx.lineTo(chartX, chartY + chartHeight);
    ctx.lineTo(chartX + chartWidth, chartY + chartHeight);
    ctx.stroke();
  }

  // Keyboard accessibility: space/enter when focused on button is native; no extra needed.

  // Check for existing user cooldown on page load
  function checkExistingCooldown() {
    const session = getCurrentUserSession();
    const userIdentifier = session?.userIdentifier;
    if (!userIdentifier) return;
    
    const remainingCooldown = getRemainingCooldown(userIdentifier);
    if (remainingCooldown > 0) {
      disableButtons();
    }
  }

  // Initialize app
  async function init() {
    console.log('Initializing Complain Can app...');

    storage = initStorage();

    if (!storage) {
      alert('Application API is not available. Configure the backend endpoint and refresh the page.');
      return;
    }

    await loadBootstrap();
    await refreshUserSession();
    initializeUserName();
    await load();
    
    // Check if user has an existing cooldown
    checkExistingCooldown();
    
    console.log('App initialized successfully');
  }
  
  init();
})();
