// Firebase configuration
const firebaseConfig = {
  authDomain: "don-t-press-that-button.firebaseapp.com",
  databaseURL: "https://don-t-press-that-button-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "don-t-press-that-button",
  storageBucket: "don-t-press-that-button.firebasestorage.app",
  messagingSenderId: "1046000874474",
  appId: "1:1046000874474:web:ee6a57d4fa7beee161f893",
  measurementId: "G-X2EMEBYD3W"
};

// Discord Webhook URL - Replace with your actual webhook URL
let discordWebhookURL = "https://discord.com/api/webhooks/1469822972444278947/bwPDjZ6UQHZvKjUH0BW314vDIUV7MkGY_7clLTAXR8SFtWRmyM0jnD1zH54kP0QrHlj8";

// DOM elements
const timerDisplay = document.getElementById('timer');
const pressCountDisplay = document.getElementById('press-count');
const lastPressDisplay = document.getElementById('last-press');
const firebaseStatus = document.getElementById('firebase-status');
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username');
const pressersList = document.getElementById('pressers-list');
const uniquePressersDisplay = document.getElementById('unique-pressers');
const topPresserDisplay = document.getElementById('top-presser');
const mostRecentPresserDisplay = document.getElementById('most-recent-presser');
const buttonLeft = document.getElementById('button-left');
const buttonRight = document.getElementById('button-right');
const leftPressesDisplay = document.getElementById('left-presses');
const rightPressesDisplay = document.getElementById('right-presses');
const preferenceRatioDisplay = document.getElementById('preference-ratio');
const mysteryMessage = document.getElementById('mystery-message');

// Global variables
let timerInterval;
let lastPressTime = null;
let totalPresses = 0;
let isConnected = false;
let database;
let lastDiscordNotification = 0;
const NOTIFICATION_COOLDOWN = 10000; // 10 seconds cooldown between Discord notifications
let currentUsername = localStorage.getItem('buttonUsername') || 'Anonymous';
let pressersData = [];
let uniquePressersCount = 0;

// Dual button stats
let buttonStats = {
  left: { presses: 0, lastPressed: null, pressers: [] },
  right: { presses: 0, lastPressed: null, pressers: [] }
};

// Mystery messages
const mysteryMessages = {
  left: [
    "Button A... a classic choice. But why?",
    "The left path chosen. Does it feel different?",
    "Option A selected. Was there a reason?",
    "Blue button pressed. Did you expect something special?"
  ],
  right: [
    "Button B... going against the grain?",
    "The right path taken. Any particular reason?",
    "Option B chosen. Was it a conscious decision?",
    "Purple button pressed. Did it call to you?"
  ],
  general: [
    "Does your choice matter? Only one way to find out...",
    "The buttons watch... and learn...",
    "Patterns emerge from chaos. Do you see them?",
    "Left or right? The universe continues either way.",
    "Your decision has been recorded. For what purpose?"
  ]
};

// Initialize Firebase
function initializeFirebase() {
    try {
        // Check if Firebase is already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        database = firebase.database();
        console.log("Firebase initialized successfully");
        
        // Monitor connection state
        monitorConnection();
        
    } catch (error) {
        console.error("Firebase initialization error:", error);
        firebaseStatus.textContent = "Initialization Error";
        firebaseStatus.style.color = "#ff4d4d";
        startLocalFallback();
    }
}

// Monitor Firebase connection
function monitorConnection() {
    const connectedRef = database.ref(".info/connected");
    
    connectedRef.on("value", (snap) => {
        isConnected = snap.val() === true;
        
        if (isConnected) {
            firebaseStatus.textContent = "Connected ✓";
            firebaseStatus.style.color = "#4dff88";
            console.log("Connected to Firebase");
            
            // Load data from Firebase
            loadDataFromFirebase();
            
        } else {
            firebaseStatus.textContent = "Reconnecting...";
            firebaseStatus.style.color = "#ffcc00";
            console.log("Disconnected from Firebase");
        }
    });
}

// Load data from Firebase
function loadDataFromFirebase() {
    const timerRef = database.ref('timer');
    
    // Listen for value changes
    timerRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            console.log("Data loaded from Firebase:", data);
            
            // Parse the stored timestamp
            if (data.lastPressTime) {
                lastPressTime = new Date(data.lastPressTime);
            } else {
                // If no timestamp exists, create one
                lastPressTime = new Date();
                updateFirebaseTimestamp(lastPressTime.toISOString(), data.totalPresses || 0);
            }
            
            totalPresses = data.totalPresses || 0;
            
            // Update UI
            updateUI();
            
            // Start the timer
            startTimer();
            
            // Load pressers data
            loadPressersData();
            
            // Load button stats
            loadButtonStats();
            
        } else {
            // Initialize data if it doesn't exist
            console.log("No data found, initializing...");
            initializeFirebaseData();
        }
    }, (error) => {
        console.error("Error loading data:", error);
        firebaseStatus.textContent = "Data Error";
        firebaseStatus.style.color = "#ff9900";
        startLocalFallback();
    });
}

function loadPressersData() {
    const pressersRef = database.ref('pressers');
    
    pressersRef.on('value', (snapshot) => {
        const data = snapshot.val();
        pressersData = data ? Object.values(data) : [];
        
        // Sort by timestamp (most recent first)
        pressersData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Update unique pressers count
        const uniqueNames = [...new Set(pressersData.map(p => p.username))];
        uniquePressersCount = uniqueNames.length;
        
        // Update UI with pressers data
        updatePressersList();
        updatePressersStats();
        
        // Update unique pressers display
        uniquePressersDisplay.textContent = uniquePressersCount;
        
    }, (error) => {
        console.error("Error loading pressers data:", error);
    });
}

function loadButtonStats() {
    if (!database || !isConnected) return;
    
    const statsRef = database.ref('buttonStats');
    statsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            buttonStats.left = data.left || { presses: 0, lastPressed: null, pressers: [] };
            buttonStats.right = data.right || { presses: 0, lastPressed: null, pressers: [] };
            updateButtonStats();
        }
    });
}

// Initialize Firebase data
function initializeFirebaseData() {
    const initialTime = new Date().toISOString();
    const initialData = {
        lastPressTime: initialTime,
        totalPresses: 0,
        created: initialTime,
        serverOffset: Date.now()
    };
    
    database.ref('timer').set(initialData)
        .then(() => {
            console.log("Firebase data initialized");
            lastPressTime = new Date(initialTime);
            totalPresses = 0;
            updateUI();
            startTimer();
            loadPressersData(); // Load pressers data
            loadButtonStats(); // Load button stats
        })
        .catch((error) => {
            console.error("Error initializing data:", error);
            startLocalFallback();
        });
}

function saveUsername() {
    const username = usernameInput.value.trim();
    
    if (username) {
        currentUsername = username;
        localStorage.setItem('buttonUsername', username);
        
        // Show success feedback
        const originalText = saveUsernameBtn.innerHTML;
        saveUsernameBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        saveUsernameBtn.style.background = "linear-gradient(to bottom, #4dff88, #00cc66)";
        
        setTimeout(() => {
            saveUsernameBtn.innerHTML = originalText;
            saveUsernameBtn.style.background = "linear-gradient(to bottom, #4da6ff, #3366cc)";
        }, 2000);
        
        console.log("Username saved:", username);
    }
}

// Update Firebase timestamp
function updateFirebaseTimestamp(timestamp, currentPresses) {
    if (!database || !isConnected) return;
    
    database.ref('timer').update({
        lastPressTime: timestamp,
        totalPresses: currentPresses + 1
    }).catch(error => {
        console.error("Error updating Firebase:", error);
    });
}

// Function to send Discord notification
async function sendDiscordNotification(timerValue, totalPresses, username = 'Anonymous', buttonUsed = 'unknown') {
    // Check if webhook is configured
    if (!discordWebhookURL || discordWebhookURL === "YOUR_DISCORD_WEBHOOK_URL_HERE") {
        console.warn("Discord webhook URL not configured");
        return;
    }
    
    // Rate limiting check
    const now = Date.now();
    if (now - lastDiscordNotification < NOTIFICATION_COOLDOWN) {
        console.log("Rate limited - skipping Discord notification");
        return;
    }
    
    lastDiscordNotification = now;
    
    try {
        // Button color based on which was pressed
        const buttonColor = buttonUsed === 'left' ? 0x4da6ff : 0xb366ff;
        const buttonName = buttonUsed === 'left' ? 'Button A (Blue)' : 'Button B (Purple)';
        
        // Create Discord embed
        const embed = {
            title: `🚨 ${buttonName} Pressed!`,
            description: `**${username}** couldn't resist the temptation!`,
            color: buttonColor,
            fields: [
                {
                    name: "👤 Pressed By",
                    value: username,
                    inline: true
                },
                {
                    name: "🔘 Button Used",
                    value: buttonName,
                    inline: true
                },
                {
                    name: "⏰ Timer Reset At",
                    value: `\`${timerValue}\``,
                    inline: true
                },
                {
                    name: "🔢 Total Presses",
                    value: `**${totalPresses}**`,
                    inline: true
                },
                {
                    name: "📊 Button Stats",
                    value: `A: ${buttonStats.left.presses} | B: ${buttonStats.right.presses}`,
                    inline: true
                },
                {
                    name: "📅 Time of Press",
                    value: new Date().toLocaleString(),
                    inline: true
                }
            ],
            footer: {
                text: "Don't Press That Button! • Dual Button Edition"
            },
            timestamp: new Date().toISOString(),
            thumbnail: {
                url: buttonUsed === 'left' ? 
                    "https://cdn-icons-png.flaticon.com/512/7028/7028151.png" :
                    "https://cdn-icons-png.flaticon.com/512/3131/3131605.png"
            }
        };
        
        // Send to Discord webhook
        const response = await fetch(discordWebhookURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                embeds: [embed],
                username: "Button Watcher",
                avatar_url: "https://cdn-icons-png.flaticon.com/512/7028/7028151.png"
            })
        });
        
        if (!response.ok) {
            console.error("Failed to send Discord notification:", response.status);
        } else {
            console.log("Discord notification sent successfully");
        }
    } catch (error) {
        console.error("Error sending Discord notification:", error);
    }
}

// Function to send milestone notifications (optional)
async function sendMilestoneNotification(totalPresses) {
    const milestones = [10, 25, 50, 100, 250, 500, 1000, 5000];
    
    if (milestones.includes(totalPresses)) {
        try {
            const embed = {
                title: "🎉 Milestone Reached!",
                description: `**${totalPresses}** total button presses!`,
                color: 0x4dff88,
                fields: [
                    {
                        name: "🎊 Achievement",
                        value: `${totalPresses} Presses`,
                        inline: true
                    },
                    {
                        name: "🔘 Button Distribution",
                        value: `A: ${buttonStats.left.presses} | B: ${buttonStats.right.presses}`,
                        inline: true
                    },
                    {
                        name: "👥 Unique Pressers",
                        value: uniquePressersCount,
                        inline: true
                    }
                ],
                footer: {
                    text: "Don't Press That Button! • Milestone Alert"
                },
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: "https://cdn-icons-png.flaticon.com/512/7028/7028151.png"
                }
            };
            
            await fetch(discordWebhookURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: `🎉 **Milestone Alert!** We've reached ${totalPresses} total button presses!`,
                    embeds: [embed],
                    username: "Button Watcher",
                    avatar_url: "https://cdn-icons-png.flaticon.com/512/7028/7028151.png"
                })
            });
        } catch (error) {
            console.error("Error sending milestone notification:", error);
        }
    }
}

// Start the timer
function startTimer() {
    // Clear any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Update immediately
    updateTimer();
    
    // Update every second
    timerInterval = setInterval(updateTimer, 1000);
}

// Update the timer display
function updateTimer() {
    if (!lastPressTime) return;
    
    // Calculate elapsed time from the stored timestamp
    const now = new Date();
    const diffInSeconds = Math.floor((now - lastPressTime) / 1000);
    
    // Format as HH:MM:SS
    const hours = Math.floor(diffInSeconds / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);
    const seconds = diffInSeconds % 60;
    
    const formattedTime = 
        String(hours).padStart(2, '0') + ':' +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');
    
    timerDisplay.textContent = formattedTime;
    
    // Update color based on elapsed time
    updateTimerColor(diffInSeconds);
}

// Update UI elements
function updateUI() {
    // Update press count
    pressCountDisplay.textContent = totalPresses;
    
    // Update last press time display
    if (lastPressTime) {
        lastPressDisplay.textContent = formatDateTime(lastPressTime);
    } else {
        lastPressDisplay.textContent = "Never";
    }
    
    // Update unique pressers count
    uniquePressersDisplay.textContent = uniquePressersCount;
}

// Update button stats display
function updateButtonStats() {
    leftPressesDisplay.textContent = buttonStats.left.presses;
    rightPressesDisplay.textContent = buttonStats.right.presses;
    
    // Calculate preference ratio
    const total = buttonStats.left.presses + buttonStats.right.presses;
    if (total > 0) {
        const leftPercent = Math.round((buttonStats.left.presses / total) * 100);
        preferenceRatioDisplay.textContent = `${leftPercent}%`;
    }
}

// Format date/time for display
function formatDateTime(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return "Just now";
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
}

// Update timer color based on elapsed time
function updateTimerColor(secondsElapsed) {
    if (secondsElapsed < 60) {
        timerDisplay.style.color = "#ff4d4d";
        timerDisplay.style.textShadow = "0 0 10px rgba(255, 77, 77, 0.7)";
    } else if (secondsElapsed < 300) {
        timerDisplay.style.color = "#ffcc00";
        timerDisplay.style.textShadow = "0 0 10px rgba(255, 204, 0, 0.7)";
    } else if (secondsElapsed < 3600) {
        timerDisplay.style.color = "#4dff88";
        timerDisplay.style.textShadow = "0 0 10px rgba(77, 255, 136, 0.7)";
    } else if (secondsElapsed < 86400) {
        timerDisplay.style.color = "#4da6ff";
        timerDisplay.style.textShadow = "0 0 10px rgba(77, 166, 255, 0.7)";
    } else {
        timerDisplay.style.color = "#b366ff";
        timerDisplay.style.textShadow = "0 0 10px rgba(179, 102, 255, 0.7)";
    }
}

// Handle dual button press
async function handleDualButtonPress(side) {
    // Prevent multiple rapid clicks
    const button = document.getElementById(`button-${side}`);
    if (button.disabled) return;
    
    // Check if user has entered a name
    if (!currentUsername || currentUsername === 'Anonymous') {
        // Prompt for username if not set
        const username = prompt(`Enter your name before pressing Button ${side === 'left' ? 'A' : 'B'}:`, "Anonymous");
        if (username && username.trim()) {
            currentUsername = username.trim();
            localStorage.setItem('buttonUsername', currentUsername);
            usernameInput.value = currentUsername;
        } else {
            currentUsername = 'Anonymous';
        }
    }
    
    // Visual feedback
    button.disabled = true;
    button.style.transform = "scale(0.95)";
    button.style.boxShadow = `0 5px 15px rgba(${side === 'left' ? '77, 166, 255' : '179, 102, 255'}, 0.3)`;
    
    const originalText = button.innerHTML;
    const originalBG = button.style.background;
    
    if (side === 'left') {
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${currentUsername.toUpperCase()}...`;
        button.style.background = "linear-gradient(135deg, #00ccff, #0066ff)";
    } else {
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${currentUsername.toUpperCase()}...`;
        button.style.background = "linear-gradient(135deg, #cc66ff, #9900ff)";
    }
    
    // Capture the timer value BEFORE resetting
    const timerValueBeforeReset = timerDisplay.textContent;
    
    try {
        // Get current timestamp
        const currentTime = new Date().toISOString();
        
        if (isConnected && database) {
            // Update main timer (both buttons do the same thing)
            await database.ref('timer').update({
                lastPressTime: currentTime,
                totalPresses: totalPresses + 1
            });
            
            // Update button-specific stats
            buttonStats[side].presses++;
            buttonStats[side].lastPressed = currentTime;
            
            if (!buttonStats[side].pressers.includes(currentUsername)) {
                buttonStats[side].pressers.push(currentUsername);
            }
            
            await database.ref(`buttonStats/${side}`).update({
                presses: buttonStats[side].presses,
                lastPressed: buttonStats[side].lastPressed,
                pressers: buttonStats[side].pressers
            });
            
            // Save presser information with button used
            const presserId = Date.now().toString();
            await database.ref(`pressers/${presserId}`).set({
                username: currentUsername,
                timestamp: currentTime,
                buttonUsed: side,
                timerValue: timerValueBeforeReset
            });
            
            // Update local variables
            lastPressTime = new Date(currentTime);
            totalPresses += 1;
            
            // Update pressers data locally
            pressersData.unshift({
                username: currentUsername,
                timestamp: currentTime,
                buttonUsed: side,
                timerValue: timerValueBeforeReset
            });
            
            // Show success
            button.innerHTML = side === 'left' ? 
                '<i class="fas fa-check"></i> RESET A!' : 
                '<i class="fas fa-check"></i> RESET B!';
            button.style.background = "linear-gradient(to bottom, #4dff88, #00cc66)";
            
        } else {
            // Fallback to localStorage
            localStorage.setItem('lastPressTime', currentTime);
            localStorage.setItem('totalPresses', totalPresses + 1);
            
            // Update local button stats
            buttonStats[side].presses++;
            buttonStats[side].lastPressed = currentTime;
            
            // Save to local pressers list
            const localPressers = JSON.parse(localStorage.getItem('localPressers') || '[]');
            localPressers.unshift({
                username: currentUsername,
                timestamp: currentTime,
                buttonUsed: side,
                timerValue: timerValueBeforeReset
            });
            localStorage.setItem('localPressers', JSON.stringify(localPressers));
            
            // Save button stats locally
            localStorage.setItem('buttonStats', JSON.stringify(buttonStats));
            
            lastPressTime = new Date(currentTime);
            totalPresses += 1;
            
            button.innerHTML = side === 'left' ? 
                '<i class="fas fa-cloud"></i> OFFLINE A' : 
                '<i class="fas fa-cloud"></i> OFFLINE B';
            button.style.background = "linear-gradient(to bottom, #ff9900, #ff6600)";
        }
        
        // Update UI immediately
        updateUI();
        updateTimer();
        updateButtonStats();
        updatePressersList();
        updatePressersStats();
        
        // Update unique pressers count
        const uniqueNames = [...new Set(pressersData.map(p => p.username))];
        uniquePressersCount = uniqueNames.length;
        uniquePressersDisplay.textContent = uniquePressersCount;
        
        // Show mystery message
        showMysteryMessage(side);
        
        // Analyze user pattern occasionally
        if (Math.random() < 0.3) {
            analyzeUserPattern(currentUsername);
        }
        
        // Send Discord notification with button info
        await sendDiscordNotification(timerValueBeforeReset, totalPresses, currentUsername, side);
        
        // Check for milestone
        await sendMilestoneNotification(totalPresses);
        
        // Secret: Occasionally hint at the truth
        createIllusionOfDifference(side);
        
    } catch (error) {
        console.error("Error updating timer:", error);
        
        button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ERROR!';
        button.style.background = "linear-gradient(to bottom, #ff3333, #cc0000)";
    }
    
    // Reset button after delay
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = originalBG;
        button.style.transform = "";
        button.style.boxShadow = "";
        button.disabled = false;
    }, 1000);
}

function updatePressersList() {
    pressersList.innerHTML = '';
    
    if (pressersData.length === 0) {
        pressersList.innerHTML = '<div class="empty-list">No one has pressed the button yet. Be the first!</div>';
        return;
    }
    
    // Show only recent pressers (last 10)
    const recentPressers = pressersData.slice(0, 10);
    
    // Count presses per user
    const pressCounts = {};
    pressersData.forEach(presser => {
        pressCounts[presser.username] = (pressCounts[presser.username] || 0) + 1;
    });
    
    recentPressers.forEach((presser, index) => {
        const presserElement = document.createElement('div');
        presserElement.className = `presser-item ${index === 0 ? 'recent' : ''}`;
        
        const timeAgo = formatDateTime(new Date(presser.timestamp));
        const pressCount = pressCounts[presser.username] || 1;
        const buttonIcon = presser.buttonUsed === 'left' ? 
            '<i class="fas fa-circle" style="color: #4da6ff;"></i>' : 
            '<i class="fas fa-circle" style="color: #b366ff;"></i>';
        
        presserElement.innerHTML = `
            <div class="presser-info">
                <div class="presser-name">${buttonIcon} ${presser.username}</div>
                <div class="presser-time">${timeAgo} • Timer: ${presser.timerValue || '00:00:00'}</div>
            </div>
            <div class="presser-count">${pressCount}x</div>
        `;
        
        pressersList.appendChild(presserElement);
    });
}

function updatePressersStats() {
    if (pressersData.length === 0) {
        topPresserDisplay.textContent = 'None';
        mostRecentPresserDisplay.textContent = 'None';
        return;
    }
    
    // Find top presser
    const pressCounts = {};
    pressersData.forEach(presser => {
        pressCounts[presser.username] = (pressCounts[presser.username] || 0) + 1;
    });
    
    let topPresser = '';
    let maxPresses = 0;
    
    Object.entries(pressCounts).forEach(([username, count]) => {
        if (count > maxPresses) {
            maxPresses = count;
            topPresser = username;
        }
    });
    
    // Update displays
    topPresserDisplay.textContent = topPresser ? `${topPresser} (${maxPresses}x)` : 'None';
    
    // Most recent presser
    const mostRecent = pressersData[0];
    mostRecentPresserDisplay.textContent = mostRecent ? mostRecent.username : 'None';
}

// Show mystery message
function showMysteryMessage(side) {
    const messages = [
        ...mysteryMessages[side],
        ...mysteryMessages.general
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    mysteryMessage.innerHTML = `<i class="fas fa-brain"></i> ${randomMessage}`;
    
    // Occasionally show "deep" messages
    if (Math.random() < 0.3) {
        setTimeout(() => {
            const deepMessages = [
                "They both reset the timer. Did you know? Does it matter?",
                "The only difference is the color. Or is there more?",
                "Your choice is recorded. The data grows.",
                "A or B? The timer resets regardless.",
                "The buttons are watching. Always watching.",
                "Choice is an illusion. The timer resets anyway."
            ];
            mysteryMessage.innerHTML = `<i class="fas fa-eye"></i> ${deepMessages[Math.floor(Math.random() * deepMessages.length)]}`;
        }, 2000);
    }
}

// Analyze user pattern
function analyzeUserPattern(username) {
    const userPresses = pressersData.filter(p => p.username === username);
    const leftPresses = userPresses.filter(p => p.buttonUsed === 'left').length;
    const rightPresses = userPresses.filter(p => p.buttonUsed === 'right').length;
    
    if (userPresses.length >= 3) {
        const ratio = leftPresses / userPresses.length;
        if (ratio > 0.8) {
            showTemporaryMessage(`${username} seems to prefer Button A...`, 3000);
        } else if (ratio < 0.2) {
            showTemporaryMessage(`${username} is a Button B person...`, 3000);
        }
    }
}

// Show temporary message
function showTemporaryMessage(message, duration) {
    const tempMsg = document.createElement('div');
    tempMsg.className = 'temporary-message';
    tempMsg.textContent = message;
    tempMsg.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 10px;
        z-index: 1000;
        font-size: 0.9rem;
        border-left: 4px solid #4dff88;
    `;
    
    document.body.appendChild(tempMsg);
    
    setTimeout(() => {
        tempMsg.style.opacity = '0';
        tempMsg.style.transition = 'opacity 0.5s';
        setTimeout(() => tempMsg.remove(), 500);
    }, duration);
}

// Create illusion of difference
function createIllusionOfDifference(side) {
    if (Math.random() < 0.05) { // 5% chance
        const messages = {
            left: [
                "Button A feels... warmer?",
                "Did Button A just vibrate?",
                "Button A clicked differently that time...",
                "Button A's light seems brighter..."
            ],
            right: [
                "Button B has a different click sound...",
                "Button B feels cooler to the touch...",
                "Button B's glow changed...",
                "Button B responded faster..."
            ]
        };
        
        const randomMsg = messages[side][Math.floor(Math.random() * messages[side].length)];
        showTemporaryMessage(randomMsg, 2000);
    }
}

// Local fallback (when Firebase isn't available)
function startLocalFallback() {
    console.log("Starting local fallback mode");
    
    // Try to get data from localStorage
    const storedTime = localStorage.getItem('lastPressTime');
    const storedPresses = localStorage.getItem('totalPresses');
    const localPressers = JSON.parse(localStorage.getItem('localPressers') || '[]');
    const localButtonStats = JSON.parse(localStorage.getItem('buttonStats') || '{"left":{"presses":0,"lastPressed":null,"pressers":[]},"right":{"presses":0,"lastPressed":null,"pressers":[]}}');
    
    if (storedTime) {
        lastPressTime = new Date(storedTime);
        totalPresses = parseInt(storedPresses) || 0;
        pressersData = localPressers;
        buttonStats = localButtonStats;
    } else {
        // Use current time as starting point
        lastPressTime = new Date();
        totalPresses = 0;
        pressersData = [];
        buttonStats = {
            left: { presses: 0, lastPressed: null, pressers: [] },
            right: { presses: 0, lastPressed: null, pressers: [] }
        };
        localStorage.setItem('lastPressTime', lastPressTime.toISOString());
        localStorage.setItem('totalPresses', totalPresses);
        localStorage.setItem('localPressers', JSON.stringify([]));
        localStorage.setItem('buttonStats', JSON.stringify(buttonStats));
    }
    
    // Update UI
    updateUI();
    updateButtonStats();
    updatePressersList();
    updatePressersStats();
    
    // Update unique pressers count
    const uniqueNames = [...new Set(pressersData.map(p => p.username))];
    uniquePressersCount = uniqueNames.length;
    uniquePressersDisplay.textContent = uniquePressersCount;
    
    startTimer();
    
    // Show offline status
    firebaseStatus.innerHTML = "Offline Mode <i class='fas fa-exclamation-triangle'></i>";
    firebaseStatus.style.color = "#ff9900";
}

// Load Discord webhook from localStorage if saved
function loadDiscordWebhook() {
    const savedWebhook = localStorage.getItem('discordWebhook');
    if (savedWebhook && savedWebhook.startsWith('https://discord.com/api/webhooks/')) {
        discordWebhookURL = savedWebhook;
        console.log("Loaded Discord webhook from localStorage");
    }
}

// Initialize dual buttons
function initializeDualButtons() {
    buttonLeft.addEventListener('click', () => handleDualButtonPress('left'));
    buttonRight.addEventListener('click', () => handleDualButtonPress('right'));
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log("Don't Press That Button - Dual Button Edition initialized");
    
    // Load saved username
    if (currentUsername) {
        usernameInput.value = currentUsername;
    }
    
    // Load Discord webhook from storage
    loadDiscordWebhook();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Initialize dual buttons
    initializeDualButtons();
    
    // Add save username button event
    saveUsernameBtn.addEventListener('click', saveUsername);
    
    // Save username on Enter key
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveUsername();
        }
    });
    
    // Add keyboard support for buttons
    document.addEventListener('keydown', (e) => {
        if (buttonLeft.disabled || buttonRight.disabled) return;
        
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
            e.preventDefault();
            buttonLeft.focus();
            handleDualButtonPress('left');
        } else if (e.code === 'KeyB' || e.code === 'ArrowRight') {
            e.preventDefault();
            buttonRight.focus();
            handleDualButtonPress('right');
        } else if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            // Randomly pick a button on space/enter
            const randomButton = Math.random() < 0.5 ? 'left' : 'right';
            const button = randomButton === 'left' ? buttonLeft : buttonRight;
            button.focus();
            handleDualButtonPress(randomButton);
        }
    });
    
    // Fallback check after 3 seconds
    setTimeout(() => {
        if (!isConnected && !timerInterval) {
            startLocalFallback();
        }
    }, 3000);
    
    // Secret reveal after many presses
    const secretRevealInterval = setInterval(() => {
        if (totalPresses >= 100 && Math.random() < 0.01) {
            const subtitles = document.querySelectorAll('.button-subtitle');
            subtitles.forEach(subtitle => {
                const original = subtitle.textContent;
                subtitle.textContent = "SAME FUNCTION";
                subtitle.style.color = '#ff4d4d';
                subtitle.style.fontWeight = 'bold';
                
                setTimeout(() => {
                    subtitle.textContent = original;
                    subtitle.style.color = '';
                    subtitle.style.fontWeight = '';
                }, 3000);
            });
            
            showTemporaryMessage("The truth is revealed... temporarily", 3000);
        }
    }, 10000);
});