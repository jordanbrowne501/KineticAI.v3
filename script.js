// KineticAI Virtual Sports Coach Logic

// --- FIX 1: REAL SUPABASE AUTH ---
// 1) Create a free project at https://supabase.com/dashboard
// 2) Settings > API > copy Project URL and anon public key below
// 3) Auth > Providers > enable Email
// Never paste the service_role key here - only the anon public key.
const SUPABASE_URL = "https://thmzulwgpxinidzawnne.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XFO5_MGm_zFyOthdnlnfwQ_4AnTUYi2";
// V6 FIX: Supabase must NEVER kill the rest of the site.
// If the URL/key are still placeholders, or the SDK fails to load,
// or the new sb_publishable_ key is not accepted by this SDK version,
// supabaseClient becomes null and sport/upload still work.
// Auth will show a clear message instead of breaking everything.
let supabaseClient = null;
try {
    if (typeof window.supabase !== "undefined" && window.supabase.createClient
        && SUPABASE_URL && !SUPABASE_URL.includes("YOUR-PROJECT")
        && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("YOUR-ANON")) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.log("Supabase not configured yet - sport/upload will still work, sign-in will not.");
    }
} catch (err) {
    console.log("Supabase init failed, continuing without login:", err);
    supabaseClient = null;
}
let currentUser = null;

const sportsData = {
    // V3: No pre-filled biomechanical data.
    // Scores, metrics, flaws and drills are ONLY created from the user's own
    // uploaded video, in analyzeUploadedVideo() below.
    // Plug real MediaPipe measurements + Gemini coaching in there.
    basketball: { title: "Basketball", poster: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80" },
    volleyball: { title: "Volleyball", poster: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=800&q=80" },
    boxing: { title: "Boxing", poster: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80" }
};

const sampleDriveFiles = []; // V3: no fake Drive files. Connect real Google Drive later, or leave empty.

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

// Check session on startup - wrapped so auth can never break sport/upload
try { initAuthSession(); } catch (e) { console.log('initAuthSession failed:', e); }
try { updateUI(currentSport); } catch (e) { console.log('updateUI failed:', e); }
try { populateDriveFiles(); } catch (e) { console.log('populateDriveFiles failed:', e); }

// Auth Logic & Events
async function initAuthSession() {
    if (!supabaseClient) return;
    try {
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
    } catch (e) { console.log("Auth session check failed:", e); }
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
    if (!supabaseClient) { alert("Supabase is not connected yet. Put your real Project URL and anon/publishable key in script.js (top of file), push to GitHub, and hard refresh."); return; }
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
            try {
                await supabaseClient.from("profiles").upsert({
                    id: currentUser.id,
                    email: currentUser.email,
                    full_name: currentUser.user_metadata?.full_name || currentUser.email.split("@")[0]
                });
            } catch (e) { console.log("Profile save on sign-in failed:", e); }
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
    if (supabaseClient) await supabaseClient.auth.signOut();
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
    if (!sampleDriveFiles.length) {
        gdriveFileList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">No Drive files connected yet.</p>';
        return;
    }
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
    const picked = Array.from(event.target.files);
    if (picked.some(f => f.name.toLowerCase().endsWith(".mov"))) {
        alert("That file is a .mov - most browsers (especially Chrome) cannot play .mov files, so it will not grade. Convert it to .mp4 first, then upload the .mp4. On iPhone, go to Settings > Camera > Formats > Most Compatible to record in MP4 from now on.");
    }
    const files = picked.filter(f => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
    if (files.length > 0) {
        handleSelectedVideoFiles(files);
    } else {
        alert("That file was not recognised as a video. Try an .mp4 or .webm file.");
    }
    event.target.value = "";
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
    latencyBadge.textContent = `Latency: —`;
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

    // V3: never load a demo video or fake scores.
    // If the user has not uploaded their own clip, show an empty state.
    if (!keepCustomVideo) {
        try {
            playerVideo.pause();
            if (data.poster) playerVideo.poster = data.poster;
            videoSource.removeAttribute("src");
            playerVideo.load();
        } catch (e) { console.log("Video reset failed:", e); }
    }

    document.getElementById("current-sport-badge").textContent = data.title;
    showEmptyAnalysis(data.title);

    // V5: Cloud Storage meter removed — nothing is stored in the cloud yet,
    // so showing any used storage was fake. Add a real meter later that
    // reads actual Supabase Storage usage for the logged-in user.
}

function showEmptyAnalysis(sportTitle) {
    document.getElementById("overall-score").textContent = "0";
    document.getElementById("gauge-circle").style.background = `conic-gradient(#00f2fe 0%, #1f293d 0deg)`;
    document.getElementById("skill-rating-title").textContent = "Ready to grade";
    document.getElementById("skill-rating-desc").textContent = `Your score starts at 0/100. Upload a clip of your ${sportTitle.toLowerCase()} and the AI will grade your form as it measures it.`;
    document.getElementById("metrics-container").innerHTML =
        '<p style="color: var(--text-secondary); font-size: 0.85rem;">No metrics yet — they will appear here after your first analysis.</p>';
    document.getElementById("flaws-list").innerHTML =
        '<li class="flaw-card"><div>No flaws detected yet — upload a video to start.</div></li>';
    document.getElementById("recommendations-grid").innerHTML =
        '<p style="color: var(--text-secondary); font-size: 0.85rem;">Your drills will appear here, based on your own video.</p>';
}

function runAIAnalysis(fileName = null) {
    // V3: no analysis without the user's own video.
    if (!fileName && !isCustomVideoActive) {
        alert("Upload a video first — analysis is tailored to your clip, there is no demo data anymore.");
        return;
    }
    const tier = tierSpeeds[currentTier];
    loaderText.textContent = fileName ? `Scanning "${fileName}"...` : tier.text;
    loaderSub.textContent = `Estimated time: ${tier.delay / 1000}s (${tier.name})`;
    loader.classList.remove("hidden");

    setTimeout(() => {
        loader.classList.add("hidden");
        analyzeUploadedVideo(fileName, currentSport);
    }, tier.delay);
}

// --- V4 GRADING: score starts at 0, builds only from measured form ---
// Metrics are defined per sport as an ideal joint-angle range.
// A metric scores 0 until MediaPipe actually sees that joint in the video,
// then 0-100 based on how close the measured angle is to ideal.
// Overall score = average of the metrics that were measured. No data = 0.
const SPORT_GRADING = {
    basketball: [
        { name: "Elbow Angle", joints: [11, 13, 15], idealMin: 80, idealMax: 105, drill: "Fix Your Shooting Form: Perfect Elbow Alignment", channel: "Pure Sweat Basketball" },
        { name: "Knee Dip", joints: [23, 25, 27], idealMin: 85, idealMax: 125, drill: "Basketball Jump Shot: Knee Dip & Power", channel: "ShotMechanics" },
        { name: "Arm Extension", joints: [11, 13, 15], idealMin: 150, idealMax: 180, drill: "Mastering Higher Release Point & Wrist Snap", channel: "ShotMechanics" }
    ],
    volleyball: [
        { name: "Arm Swing Extension", joints: [12, 14, 16], idealMin: 150, idealMax: 180, drill: "Volleyball Spiking: How to Hit at Peak Height", channel: "Elevate Yourself" },
        { name: "Knee Bend", joints: [23, 25, 27], idealMin: 85, idealMax: 130, drill: "Volleyball Approach & Jump Technique", channel: "Elevate Yourself" },
        { name: "Elbow Angle", joints: [12, 14, 16], idealMin: 80, idealMax: 110, drill: "Fixing Arm Swing Biomechanics in Volleyball", channel: "Victoria Volleyball" }
    ],
    boxing: [
        { name: "Guard Elbow", joints: [11, 13, 15], idealMin: 75, idealMax: 105, drill: "Boxing Defense: Never Drop Your Guard While Punching", channel: "ExpertBoxing" },
        { name: "Punch Extension", joints: [12, 14, 16], idealMin: 155, idealMax: 180, drill: "Generate Maximum Power in your Right Cross", channel: "Tony Jeffries" },
        { name: "Knee Bend", joints: [23, 25, 27], idealMin: 100, idealMax: 140, drill: "Boxing Footwork & Hip Rotation", channel: "ExpertBoxing" }
    ]
};

let poseDetector = null;
let grading = null; // { best: {metricName: score}, samples: 0, timer: null }

function angleAt(a, b, c) {
    const ab = [a.x - b.x, a.y - b.y];
    const cb = [c.x - b.x, c.y - b.y];
    const dot = ab[0] * cb[0] + ab[1] * cb[1];
    const magA = Math.hypot(ab[0], ab[1]) || 1;
    const magC = Math.hypot(cb[0], cb[1]) || 1;
    const cos = Math.max(-1, Math.min(1, dot / (magA * magC)));
    return Math.acos(cos) * 180 / Math.PI;
}

function scoreForAngle(angle, idealMin, idealMax) {
    if (angle >= idealMin && angle <= idealMax) return 100;
    const dist = angle < idealMin ? idealMin - angle : angle - idealMax;
    return Math.max(0, Math.round(100 - dist * 2));
}

function initPose() {
    if (poseDetector) return poseDetector;
    if (typeof Pose === "undefined") return null;
    poseDetector = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    poseDetector.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    poseDetector.onResults(onPoseResults);
    return poseDetector;
}

function onPoseResults(results) {
    if (!grading || !grading.active) return;
    const lm = results.poseLandmarks;
    if (!lm) return;
    grading.samples++;
    const defs = SPORT_GRADING[currentSport] || [];
    let changed = false;
    defs.forEach((def) => {
        const [i1, i2, i3] = def.joints;
        if (!lm[i1] || !lm[i2] || !lm[i3]) return;
        // Only trust visible landmarks
        if (lm[i1].visibility < 0.5 || lm[i2].visibility < 0.5 || lm[i3].visibility < 0.5) return;
        const ang = angleAt(lm[i1], lm[i2], lm[i3]);
        const s = scoreForAngle(ang, def.idealMin, def.idealMax);
        if (s > (grading.best[def.name] || 0)) { grading.best[def.name] = s; changed = true; }
    });
    if (changed) renderGradingLive();
}

function overallFromBest(best) {
    const vals = Object.values(best);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function renderGradingLive() {
    const score = overallFromBest(grading.best);
    document.getElementById("overall-score").textContent = score;
    document.getElementById("gauge-circle").style.background = `conic-gradient(#00f2fe ${score}%, #1f293d 0deg)`;
    document.getElementById("skill-rating-title").textContent = score === 0 ? "Grading in progress…" : score >= 80 ? "Strong Form" : score >= 60 ? "Solid Form" : "Form Needs Work";
    document.getElementById("skill-rating-desc").textContent = `Grading your clip live — score builds from 0 as the AI measures your form. Current: ${score}/100.`;
    const defs = SPORT_GRADING[currentSport] || [];
    document.getElementById("metrics-container").innerHTML = defs.map((d) => {
        const s = grading.best[d.name] || 0;
        return `<div class="metric-item"><div class="metric-header"><span class="metric-name">${d.name}</span><span class="metric-score">${s}%</span></div><div class="metric-bar-bg"><div class="metric-bar-fill" style="width: ${s}%;"></div></div></div>`;
    }).join("");
}

async function finalizeGrading(fileName) {
    if (!grading) return;
    grading.active = false;
    if (grading.timer) clearInterval(grading.timer);
    const score = overallFromBest(grading.best);
    const defs = SPORT_GRADING[currentSport] || [];
    renderGradingLive();
    if (grading.samples === 0 || score === 0) {
        document.getElementById("skill-rating-title").textContent = "No athlete detected";
        document.getElementById("skill-rating-desc").textContent = `Could not measure form in "${fileName}". Try a clearer, full-body clip with good lighting — score stays at 0/100 until the AI can see you.`;
    } else {
        document.getElementById("skill-rating-title").textContent = score >= 80 ? "Strong Form" : score >= 60 ? "Solid Form" : "Form Needs Work";
        document.getElementById("skill-rating-desc").textContent = `Graded from your clip "${fileName}". Your score is ${score}/100, based on the best form the AI measured.`;
    }
    const flaws = defs.filter((d) => (grading.best[d.name] || 0) < 70);
    document.getElementById("flaws-list").innerHTML = flaws.length
        ? flaws.map((d) => `<li class="flaw-card"><span class="flaw-icon">⚠️</span><div>${d.name}: scored ${grading.best[d.name] || 0}%. Work on getting closer to the ideal range for this movement.</div></li>`).join("")
        : '<li class="flaw-card"><div>No major flaws detected in this clip.</div></li>';
    document.getElementById("recommendations-grid").innerHTML = (flaws.length ? flaws : defs.slice(0, 1)).map((d) => `
        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(d.drill)}" target="_blank" class="video-card">
            <div class="video-info"><div class="video-title">${d.drill}</div><div class="video-channel">${d.channel}</div></div>
        </a>`).join("");
    // V7: Save this graded session to Supabase, if the user is signed in.
    // No Supabase changes needed - the sessions table and policies already exist.
    // If not signed in, the score still shows on screen, it just is not saved.
    if (supabaseClient && currentUser && grading.samples > 0) {
        try {
            const { error } = await supabaseClient.from("sessions").insert({
                user_id: currentUser.id,
                sport: currentSport,
                file_name: fileName || "clip",
                score: score,
                metrics: grading.best,
                flaws: flaws.map((d) => d.name)
            });
            if (error) {
                console.log("Session save failed:", error.message);
            } else {
                console.log("Session saved to Supabase.");
                document.getElementById("skill-rating-desc").textContent += " Saved to your account.";
            }
        } catch (e) { console.log("Session save failed:", e); }
    } else if (!currentUser) {
        console.log("Not signed in - session shown on screen but not saved to Supabase.");
    }
    // Next step: send grading.best + score to Gemini for coaching text.
}

async function analyzeUploadedVideo(fileName, sportKey) {
    // Score starts at 0. It only rises when MediaPipe measures good form.
    grading = { best: {}, samples: 0, active: true, timer: null };
    renderGradingLive();
    const pose = initPose();
    if (!pose) {
        grading.active = false;
        document.getElementById("skill-rating-title").textContent = "Pose tracking failed to load";
        document.getElementById("skill-rating-desc").textContent = "MediaPipe did not load — check your connection and try again. Score stays at 0/100.";
        return;
    }
    // Play the video and sample frames while it plays
    try { await playerVideo.play(); } catch (e) { console.log("Autoplay deferred:", e); }
    grading.timer = setInterval(() => {
        if (playerVideo.paused || playerVideo.ended) { finalizeGrading(fileName); return; }
        pose.send({ image: playerVideo }).catch(() => {});
    }, 300);
    playerVideo.onended = () => finalizeGrading(fileName);
    // Safety stop after 30s so grading always finishes
    setTimeout(() => { if (grading && grading.active) finalizeGrading(fileName); }, 30000);
}
