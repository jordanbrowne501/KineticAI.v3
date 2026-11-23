// KineticAI Virtual Sports Coach Logic

// --- FIX 1: REAL SUPABASE AUTH ---
// 1) Create a free project at https://supabase.com/dashboard
// 2) Settings > API > copy Project URL and anon public key below
// 3) Auth > Providers > enable Email
// Never paste the service_role key here - only the anon public key.
const SUPABASE_URL = "const SUPABASE_URL = "https://thmzulwgpxinidzawnne.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XFO5_MGm_zFyOthdnlnfwQ_4AnTUYi2";
const supabaseClient = window.supabase.createClient("https://thmzulwgpxinidzawnne.supabase.co", sb_publishable_XFO5_MGm_zFyOthdnlnfwQ_4AnTUYi2

);
let currentUser = null;

const sportsData = {
    basketball: {
        title: "Basketball",
        overallScore: 78,
        ratingTitle: "Solid Mechanics",
        ratingDesc: "Good shot angle, but release point is early. Practice your follow-through.",
        poster: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80",
        videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        storageUsed: "2.4 GB / 5.0 GB",
        storagePercent: 48,
        metrics: [
            { name: "Elbow Tucked Angle", score: 85 },
            { name: "Release Height", score: 70 },
            { name: "Knee Dip Synchronization", score: 80 }
        ],
        flaws: [
            "Flaw: Elbow flares outward by 12° during jump phase.",
            "Correction: Maintain vertical alignment of wrist, elbow, and hip."
        ],
        videos: [
            {
                title: "Fix Your Shooting Form: Perfect Elbow Alignment",
                channel: "Pure Sweat Basketball",
                thumbnail: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=400&q=80",
                url: "https://www.youtube.com/results?search_query=basketball+shooting+form+elbow"
            },
            {
                title: "Mastering Higher Release Point & Wrist Snap",
                channel: "ShotMechanics",
                thumbnail: "https://images.unsplash.com/photo-1519766304817-4f37bda74a29?auto=format&fit=crop&w=400&q=80",
                url: "https://www.youtube.com/results?search_query=basketball+higher+release+point"
            }
        ],
    },
    volleyball: {
        title: "Volleyball",
        overallScore: 64,
        ratingTitle: "Needs Arm Swing Adjustment",
        ratingDesc: "Approach speed is good, but your hitting shoulder droops prior to contact.",
        poster: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=800&q=80",
        videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        storageUsed: "3.8 GB / 5.0 GB",
        storagePercent: 76,
        metrics: [
            { name: "Approach Speed", score: 88 },
            { name: "Jump Vertical Peak", score: 72 },
            { name: "Arm Swing Torque", score: 55 }
        ],
        flaws: [
            "Flaw: Contacting ball 4 inches below maximum vertical height.",
            "Correction: Accelerate non-dominant arm up early to guide hitting path."
        ],
        videos: [
            {
                title: "Volleyball Spiking: How to Hit at Peak Height",
                channel: "Elevate Yourself",
                thumbnail: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=400&q=80",
                url: "https://www.youtube.com/results?search_query=volleyball+spiking+peak+height"
            },
            {
                title: "Fixing Arm Swing Biomechanics in Volleyball",
                channel: "Victoria Volleyball",
                thumbnail: "https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=400&q=80",
                url: "https://www.youtube.com/results?search_query=volleyball+arm+swing+technique"
            }
        ],
    },
    boxing: {
        title: "Boxing",
        overallScore: 82,
        ratingTitle: "Sharp Punch Mechanics",
        ratingDesc: "Excellent cross turn torque, but left guard drops slightly when throwing right.",
        poster: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80",
        videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        storageUsed: "1.2 GB / 5.0 GB",
        storagePercent: 24,
        metrics: [
            { name: "Guard Retention", score: 68 },
            { name: "Punch Snap & Velocity", score: 92 },
            { name: "Hip Kinetic Rotation", score: 86 }
        ],
        flaws: [
            "Flaw: Opposite hand drops to chin line during power delivery.",
            "Correction: Glue non-punching cheek/glove to temple for defense coverage."
        ],
        videos: [
            {
                title: "Boxing Defense: Never Drop Your Guard While Punching",
                channel: "ExpertBoxing",
                thumbnail: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=400&q=80",
                url: "https://www.youtube.com/results?search_query=boxing+keep+guard+up"
            },
            {
                title: "Generate Maximum Power in your Right Cross",
                channel: "Tony Jeffries",
                thumbnail: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=400&q=80",
                url: "https://www.youtube.com/results?search_query=boxing+right+cross+power"
            }
        ],
    }
};

const sampleDriveFiles = [
    { name: "Volleyball_Spike_Practice_Oct.mp4", sport: "volleyball", size: "45.2 MB", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" },
    { name: "Basketball_JumpShot_Drills.mp4", sport: "basketball", size: "38.6 MB", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
    { name: "Boxing_Heavybag_Combo1.mp4", sport: "boxing", size: "52.1 MB", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" }
];

const tierSpeeds = {
    free: { name: "Free Tier", delay: 8000, latency: "~300ms", text: "Processing via Shared Queue..." },
    pro: { name: "Pro Tier", delay: 3000, latency: "~25ms", text: "Fast GPU Neural Processing..." },
    elite: { name: "Elite Tier", delay: 1000, latency: "~5ms", text: "Low-latency Edge Stream Active..." }
};

// DOM Elements
const sportSelect = document.getElementById("sport-select");
const tierSelect = document.getElementById("tier-select");
const playBtn = document.getElementById("play-btn");
const analyzeBtn = document.getElementById("analyze-btn");
const playerVideo = document.getElementById("player-video");
const videoSource = document.getElementById("video-source");
const clipUpload = document.getElementById("clip-upload");
const folderUpload = document.getElementById("folder-upload");
const activeFileBadge = document.getElementById("active-file-badge");
const folderQueueContainer = document.getElementById("folder-queue-container");
const folderQueueList = document.getElementById("folder-queue-list");
const queueCountSpan = document.getElementById("queue-count");

const loader = document.getElementById("processing-loader");
const loaderText = document.getElementById("loader-text");
const loaderSub = document.getElementById("loader-sub");
const latencyBadge = document.getElementById("latency-badge");

// Auth Elements
const openAuthBtn = document.getElementById("open-auth-btn");
const closeAuthModalBtn = document.getElementById("close-auth-modal");
const authModal = document.getElementById("auth-modal");
const authForm = document.getElementById("auth-form");
const authModalTitle = document.getElementById("auth-modal-title");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const nameFieldGroup = document.getElementById("name-field-group");
const userProfile = document.getElementById("user-profile");
const userAvatar = document.getElementById("user-avatar");
const userNameDisplay = document.getElementById("user-name-display");
const logoutBtn = document.getElementById("logout-btn");

// Google Drive Modal Elements
const gdrivePickBtn = document.getElementById("gdrive-pick-btn");
const gdriveModal = document.getElementById("gdrive-modal");
const closeGdriveModalBtn = document.getElementById("close-gdrive-modal");
const gdriveFileList = document.getElementById("gdrive-file-list");

let isSignUp = false;
let isCustomVideoActive = false;
let customFileName = "";
let uploadedFolderFiles = [];


// Active State
let currentSport = "basketball";
let currentTier = "pro";

// Check session on startup - real Supabase session, not localStorage
initAuthSession();
updateUI(currentSport);
populateDriveFiles();

// Auth Logic & Events
async function initAuthSession() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session?.user) {
        currentUser = data.session.user;
        renderLoggedInUser(currentUser);
    }
    // Keep UI in sync if login/logout happens in another tab
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        if (currentUser) renderLoggedInUser(currentUser);
        else {
            userProfile.classList.add("hidden");
            openAuthBtn.classList.remove("hidden");
        }
    });
}

openAuthBtn.addEventListener("click", () => authModal.classList.remove("hidden"));
closeAuthModalBtn.addEventListener("click", () => authModal.classList.add("hidden"));

authToggleBtn.addEventListener("click", (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    if (isSignUp) {
        authModalTitle.textContent = "Create KineticAI Account";
        authSubmitBtn.textContent = "Sign Up";
        authToggleText.textContent = "Already have an account?";
        authToggleBtn.textContent = "Sign In";
        nameFieldGroup.style.display = "flex";
    } else {
        authModalTitle.textContent = "Sign In to KineticAI";
        authSubmitBtn.textContent = "Sign In";
        authToggleText.textContent = "Don't have an account?";
        authToggleBtn.textContent = "Create Account";
        nameFieldGroup.style.display = "none";
    }
});

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const name = document.getElementById("auth-name").value.trim() || email.split("@")[0];
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = isSignUp ? "Creating account..." : "Signing in...";
    try {
        let result;
        if (isSignUp) {
            result = await supabaseClient.auth.signUp({
                email, password,
                options: { data: { full_name: name } }
            });
            if (result.error) throw result.error;
            // Save profile row so data is tied to this user in Supabase, not localStorage
            if (result.data.user) {
                await supabaseClient.from("profiles").upsert({
                    id: result.data.user.id,
                    email,
                    full_name: name
                });
            }
            alert("Account created! Check your email to confirm, then sign in.");
        } else {
            result = await supabaseClient.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            currentUser = result.data.user;
            renderLoggedInUser(currentUser);
            authModal.classList.add("hidden");
        }
    } catch (err) {
        alert(err.message || "Login failed. Check your email and password.");
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isSignUp ? "Sign Up" : "Sign In";
    }
});

logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    currentUser = null;
    userProfile.classList.add("hidden");
    openAuthBtn.classList.remove("hidden");
});

function renderLoggedInUser(user) {
    const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Athlete";
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    userAvatar.textContent = initials || "AT";
    userNameDisplay.textContent = name;
    openAuthBtn.classList.add("hidden");
    userProfile.classList.remove("hidden");
}

// Google Drive Picker Modal Events
gdrivePickBtn.addEventListener("click", () => {
    gdriveModal.classList.remove("hidden");
});

closeGdriveModalBtn.addEventListener("click", () => {
    gdriveModal.classList.add("hidden");
});

function populateDriveFiles() {
    gdriveFileList.innerHTML = sampleDriveFiles.map((file, index) => `
        <div class="gdrive-file-item" data-index="${index}">
            <div class="gdrive-file-info">
                <svg width="20" height="20" viewBox="0 0 87.3 78"><path fill="#0066da" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.45l5.4 9.4z"/><path fill="#00ac47" d="M43.65 25L29.9 1.2C28.55.4 27 0 25.4 0H15.9c-1.55 0-3.1.4-4.45 1.2l13.75 23.8h28.45z"/><path fill="#ea4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.35 1.2-2.9 1.2-4.45H59.8l13.75 23.75z"/><path fill="#00832d" d="M27.5 53H59.8L43.65 80c-.8.8-1.9 1.3-3 1.3h-19.3c-1.1 0-2.2-.5-3-1.3L27.5 53z"/><path fill="#ffba00" d="M59.8 53l16.35-28.3c-.8-1.4-1.95-2.5-3.3-3.3L59.05 9.75c-1.35-.8-2.9-1.2-4.45-1.2H25.4l18.25 31.5L59.8 53z"/><path fill="#2684fc" d="M43.65 31.5L29.9 55.3h27.5L71.15 31.5H43.65z"/></svg>
                <div>
                    <div class="gdrive-file-name">${file.name}</div>
                    <div class="gdrive-file-meta">Sport: ${file.sport.toUpperCase()} • ${file.size}</div>
                </div>
            </div>
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Select</button>
        </div>
    `).join("");

    document.querySelectorAll(".gdrive-file-item").forEach(item => {
        item.addEventListener("click", () => {
            const idx = item.getAttribute("data-index");
            const selectedFile = sampleDriveFiles[idx];
            
            currentSport = selectedFile.sport;
            sportSelect.value = currentSport;
            isCustomVideoActive = true;
            customFileName = selectedFile.name;
            
            loadCustomVideoSource(selectedFile.url, selectedFile.name);
            updateUI(currentSport, true);
            runAIAnalysis(selectedFile.name);
            gdriveModal.classList.add("hidden");
        });
    });
}

// Single/Multi File Upload Handling
clipUpload.addEventListener("change", (event) => {
    const files = Array.from(event.target.files).filter(f => f.type.startsWith("video/"));
    if (files.length > 0) {
        handleSelectedVideoFiles(files);
    }
});

// Folder Upload Handling
folderUpload.addEventListener("change", (event) => {
    const files = Array.from(event.target.files).filter(f => f.type.startsWith("video/"));
    if (files.length > 0) {
        handleSelectedVideoFiles(files);
    } else {
        alert("No video files (.mp4, .mov, .webm) were found inside the selected folder.");
    }
});

function handleSelectedVideoFiles(videoFiles) {
    uploadedFolderFiles = videoFiles;
    
    if (videoFiles.length > 1) {
        queueCountSpan.textContent = videoFiles.length;
        folderQueueContainer.classList.remove("hidden");
        renderFolderQueue(0);
    } else {
        folderQueueContainer.classList.add("hidden");
    }

    activateCustomFile(0);
}

function renderFolderQueue(activeIndex) {
    folderQueueList.innerHTML = uploadedFolderFiles.map((file, idx) => `
        <div class="queue-item ${idx === activeIndex ? 'active' : ''}" data-idx="${idx}">
            🎥 ${file.name}
        </div>
    `).join("");

    document.querySelectorAll(".queue-item").forEach(el => {
        el.addEventListener("click", () => {
            const idx = parseInt(el.getAttribute("data-idx"));
            renderFolderQueue(idx);
            activateCustomFile(idx);
        });
    });
}

function activateCustomFile(index) {
    const file = uploadedFolderFiles[index];
    if (!file) return;

    const fileURL = URL.createObjectURL(file);
    isCustomVideoActive = true;
    customFileName = file.name;

    const lowerName = file.name.toLowerCase();
    if (lowerName.includes("volley")) {
        currentSport = "volleyball";
        sportSelect.value = "volleyball";
    } else if (lowerName.includes("basket")) {
        currentSport = "basketball";
        sportSelect.value = "basketball";
    } else if (lowerName.includes("box")) {
        currentSport = "boxing";
        sportSelect.value = "boxing";
    }

    loadCustomVideoSource(fileURL, file.name);
    updateUI(currentSport, true);
    runAIAnalysis(file.name);
}

function loadCustomVideoSource(url, filename) {
    playerVideo.pause();
    videoSource.src = url;
    playerVideo.load();
    playerVideo.play().catch(err => console.log("Autoplay deferred:", err));

    activeFileBadge.textContent = `File: ${filename}`;
    activeFileBadge.classList.remove("hidden");
}

// Sport & Analysis Handlers
sportSelect.addEventListener("change", (e) => {
    currentSport = e.target.value;
    isCustomVideoActive = false;
    activeFileBadge.classList.add("hidden");
    updateUI(currentSport, false);
});

tierSelect.addEventListener("change", (e) => {
    currentTier = e.target.value;
    latencyBadge.textContent = `Latency: ${tierSpeeds[currentTier].latency}`;
});

playBtn.addEventListener("click", () => {
    if (playerVideo.paused) {
        playerVideo.play();
    } else {
        playerVideo.pause();
    }
});

analyzeBtn.addEventListener("click", () => {
    runAIAnalysis(isCustomVideoActive ? customFileName : null);
});

function updateUI(sportKey, keepCustomVideo = false) {
    const data = sportsData[sportKey];

    if (!keepCustomVideo) {
        playerVideo.pause();
        playerVideo.poster = data.poster;
        videoSource.src = data.videoSrc;
        playerVideo.load();
    }

    document.getElementById("current-sport-badge").textContent = data.title;
    document.getElementById("overall-score").textContent = data.overallScore;
    document.getElementById("gauge-circle").style.background = `conic-gradient(#00f2fe ${data.overallScore}%, #1f293d 0deg)`;
    document.getElementById("skill-rating-title").textContent = data.ratingTitle;
    document.getElementById("skill-rating-desc").textContent = data.ratingDesc;

    document.getElementById("storage-text").textContent = data.storageUsed;
    document.getElementById("storage-bar").style.width = `${data.storagePercent}%`;

    const metricsContainer = document.getElementById("metrics-container");
    metricsContainer.innerHTML = data.metrics.map(m => `
        <div class="metric-item">
            <div class="metric-header">
                <span class="metric-name">${m.name}</span>
                <span class="metric-score">${m.score}%</span>
            </div>
            <div class="metric-bar-bg">
                <div class="metric-bar-fill" style="width: ${m.score}%;"></div>
            </div>
        </div>
    `).join("");

    const flawsContainer = document.getElementById("flaws-list");
    flawsContainer.innerHTML = data.flaws.map(flaw => `
        <li class="flaw-card">
            <span class="flaw-icon">⚠️</span>
            <div>${flaw}</div>
        </li>
    `).join("");

    const videosContainer = document.getElementById("recommendations-grid");
    videosContainer.innerHTML = data.videos.map(v => `
        <a href="${v.url}" target="_blank" class="video-card">
            <div class="thumbnail-container">
                <img src="${v.thumbnail}" alt="Thumbnail">
                <span class="play-badge">YouTube</span>
            </div>
            <div class="video-info">
                <div class="video-title">${v.title}</div>
                <div class="video-channel">${v.channel}</div>
            </div>
        </a>
    `).join("");

}

function runAIAnalysis(fileName = null) {
    const tier = tierSpeeds[currentTier];
    loaderText.textContent = fileName ? `Scanning "${fileName}"...` : tier.text;
    loaderSub.textContent = `Estimated time: ${tier.delay / 1000}s (${tier.name})`;
    loader.classList.remove("hidden");

    setTimeout(() => {
        loader.classList.add("hidden");
        
        if (fileName) {
            generateCustomAnalysisData(fileName, currentSport);
        } else {
        }
    }, tier.delay);
}

function generateCustomAnalysisData(fileName, sportKey) {
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
        hash = fileName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const seed = Math.abs(hash);

    const dynamicScore = 68 + (seed % 26);
    document.getElementById("overall-score").textContent = dynamicScore;
    document.getElementById("gauge-circle").style.background = `conic-gradient(#00f2fe ${dynamicScore}%, #1f293d 0deg)`;
    
    document.getElementById("skill-rating-title").textContent = dynamicScore >= 80 ? "Strong Biomechanics" : "Form Optimization Needed";
    document.getElementById("skill-rating-desc").textContent = `AI scan completed for "${fileName}". Key kinetic chain angles evaluated.`;

    const baseMetrics = sportsData[sportKey].metrics;
    const metricsContainer = document.getElementById("metrics-container");
    metricsContainer.innerHTML = baseMetrics.map((m, idx) => {
        const variedScore = Math.min(98, Math.max(52, m.score + ((seed + idx * 17) % 21) - 10));
        return `
            <div class="metric-item">
                <div class="metric-header">
                    <span class="metric-name">${m.name}</span>
                    <span class="metric-score">${variedScore}%</span>
                </div>
                <div class="metric-bar-bg">
                    <div class="metric-bar-fill" style="width: ${variedScore}%;"></div>
                </div>
            </div>
        `;
    }).join("");

}
