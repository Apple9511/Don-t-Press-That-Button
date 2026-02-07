// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyCIcOQdlXD6mJ1SmcT9bWOC1jhajeCiKmU",
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
const button = document.getElementById('the-button');
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
async function sendDiscordNotification(timerValue, totalPresses) {
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
        // Get some additional info (optional)
        const additionalInfo = {
            platform: navigator.platform,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        
        // Create Discord embed
        const embed = {
            title: "🚨 Button Pressed!",
        description: `**${username}** couldn't resist the temptation!`,
        color: 0xff416c,
        fields: [
            {
                name: "👤 Pressed By",
                value: username,
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
                name: "📅 Time of Press",
                value: new Date().toLocaleString(),
                inline: true
            }
        ],
            footer: {
                text: "Don't Press That Button! • Website Activity"
            },
            timestamp: new Date().toISOString(),
            thumbnail: {
                url: "https://cdn-icons-png.flaticon.com/512/7028/7028151.png"
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
                        name: "👥 Community Effort",
                        value: "Thanks to everyone who pressed!",
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

// Handle button press
async function handleButtonPress() {
    // Prevent multiple rapid clicks
    if (button.disabled) return;
    
    // Check if user has entered a name
    if (!currentUsername || currentUsername === 'Anonymous') {
        // Prompt for username if not set
        const username = prompt("Enter your name before pressing the button:", "Anonymous");
        if (username && username.trim()) {
            currentUsername = username.trim();
            localStorage.setItem('buttonUsername', currentUsername);
        } else {
            currentUsername = 'Anonymous';
        }
    }
    
    // Visual feedback
    button.disabled = true;
    button.style.transform = "scale(0.95)";
    button.style.boxShadow = "0 5px 15px rgba(255, 65, 108, 0.3)";
    
    const originalText = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${currentUsername.toUpperCase()}...`;
    
    // Capture the timer value BEFORE resetting
    const timerValueBeforeReset = timerDisplay.textContent;
    
    try {
        // Get current timestamp
        const currentTime = new Date().toISOString();
        
        if (isConnected && database) {
            // Update Firebase timer
            await database.ref('timer').update({
                lastPressTime: currentTime,
                totalPresses: totalPresses + 1
            });
            
            // Save presser information
            const presserId = Date.now().toString();
            await database.ref(`pressers/${presserId}`).set({
                username: currentUsername,
                timestamp: currentTime,
                timerValue: timerValueBeforeReset
            });
            
            // Update local variables
            lastPressTime = new Date(currentTime);
            totalPresses += 1;
            
            // Update pressers data locally
            pressersData.unshift({
                username: currentUsername,
                timestamp: currentTime,
                timerValue: timerValueBeforeReset
            });
            
            // Show success
            button.innerHTML = '<i class="fas fa-check"></i> RESET!';
            button.style.background = "linear-gradient(to bottom, #4dff88, #00cc66)";
            
        } else {
            // Fallback to localStorage
            localStorage.setItem('lastPressTime', currentTime);
            localStorage.setItem('totalPresses', totalPresses + 1);
            
            // Save to local pressers list
            const localPressers = JSON.parse(localStorage.getItem('localPressers') || '[]');
            localPressers.unshift({
                username: currentUsername,
                timestamp: currentTime,
                timerValue: timerValueBeforeReset
            });
            localStorage.setItem('localPressers', JSON.stringify(localPressers));
            
            lastPressTime = new Date(currentTime);
            totalPresses += 1;
            
            button.innerHTML = '<i class="fas fa-cloud"></i> OFFLINE';
            button.style.background = "linear-gradient(to bottom, #ff9900, #ff6600)";
        }
        
        // Update UI immediately
        updateUI();
        updateTimer();
        updatePressersList();
        updatePressersStats();
        
        // Update unique pressers count
        const uniqueNames = [...new Set(pressersData.map(p => p.username))];
        uniquePressersCount = uniqueNames.length;
        uniquePressersDisplay.textContent = uniquePressersCount;
        
        // Send Discord notification with username
        await sendDiscordNotification(timerValueBeforeReset, totalPresses, currentUsername);
        
        // Check for milestone
        await sendMilestoneNotification(totalPresses);
        
    } catch (error) {
        console.error("Error updating timer:", error);
        
        button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ERROR!';
        button.style.background = "linear-gradient(to bottom, #ff3333, #cc0000)";
    }
    
    // Reset button after delay
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = "linear-gradient(to bottom, #ff416c, #ff4b2b)";
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
        
        presserElement.innerHTML = `
            <div class="presser-info">
                <div class="presser-name">${presser.username}</div>
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

// Local fallback (when Firebase isn't available)
function startLocalFallback() {
    console.log("Starting local fallback mode");
    
    // Try to get data from localStorage
    const storedTime = localStorage.getItem('lastPressTime');
    const storedPresses = localStorage.getItem('totalPresses');
    const localPressers = JSON.parse(localStorage.getItem('localPressers') || '[]');
    
    if (storedTime) {
        lastPressTime = new Date(storedTime);
        totalPresses = parseInt(storedPresses) || 0;
        pressersData = localPressers;
    } else {
        // Use current time as starting point
        lastPressTime = new Date();
        totalPresses = 0;
        pressersData = [];
        localStorage.setItem('lastPressTime', lastPressTime.toISOString());
        localStorage.setItem('totalPresses', totalPresses);
        localStorage.setItem('localPressers', JSON.stringify([]));
    }
    
    // Update UI
    updateUI();
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

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log("Don't Press That Button initialized");
    
    // Load saved username
    if (currentUsername) {
        usernameInput.value = currentUsername;
    }
    
    // Load Discord webhook from storage
    loadDiscordWebhook();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Add click event to button
    button.addEventListener('click', handleButtonPress);
    
    // Add save username button event
    saveUsernameBtn.addEventListener('click', saveUsername);
    
    // Save username on Enter key
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveUsername();
        }
    });
    
    // Add keyboard support for button
    document.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !button.disabled) {
            e.preventDefault();
            button.focus();
            handleButtonPress();
        }
    });
    
    // Fallback check after 3 seconds
    setTimeout(() => {
        if (!isConnected && !timerInterval) {
            startLocalFallback();
        }
    }, 3000);
});