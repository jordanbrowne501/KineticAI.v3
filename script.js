// KineticAI Virtual Sports Coach Logic

// --- FIX 1: REAL SUPABASE AUTH ---
// 1) Create a free project at https://supabase.com/dashboard
// 2) Settings > API > copy Project URL and anon public key below
// 3) Auth > Providers > enable Email
// Never paste the service_role key here - only the anon public key.
const SUPABASE_URL = "https://thmzulwgpxinidzawnne.supabase.co/";
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

// V11: Gemini coaching - START, not finished.
// NEVER put a Gemini API key in this file - anyone can read it.
// The safe way is a Supabase Edge Function (see gemini-edge-function.ts
// in this zip). That function holds the key on the server and calls Gemini.
// Set GEMINI_EDGE_FUNCTION_URL below once you deploy that function, e.g.
// "https://thmzulwgpxinidzawnne.supabase.co/functions/v1/gemini-coach"
// Until then, the site uses local rule-based coaching from the measured
// angles - it still gives real, specific advice, just not from Gemini yet.
const GEMINI_EDGE_FUNCTION_URL = "";
let currentCoachingText = null;

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
let currentVideoPath = null; // V8: Supabase Storage path, e.g. "<user-id>/1234567890-clip.mp4"
let currentVideoHash = null; // V10: SHA-256 of the file bytes - same clip = same hash, even if renamed
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

// V11: Forgot password - sends a reset email via Supabase.
// The email link goes back to the site (redirect URL must be set in
// Supabase Auth > URL Configuration, same as the sign-up link).
// When the user clicks that link, Supabase puts type=recovery in the URL -
// the site detects that below and asks them to set a new password.
document.getElementById("forgot-password-btn")?.addEventListener("click", async () => {
    const status = document.getElementById("forgot-password-status");
    const email = document.getElementById("auth-email").value.trim();
    if (!supabaseClient) { alert("Supabase is not connected yet."); return; }
    if (!email || !email.includes("@")) { alert("Type your email address in the Email box first, then click Forgot password."); return; }
    status.textContent = "Sending reset email...";
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: "https://jordanbrowne501.github.io/KineticAI.v3/"
    });
    if (error) { status.textContent = ""; alert("Reset failed: " + error.message); return; }
    status.textContent = "Check your email for a reset link.";
    alert("Password reset email sent to " + email + ". Click the link in that email, then set a new password on the site.");
});

// V11: Password recovery - if the URL has type=recovery, the user just
// clicked a reset link. Supabase has already given them a session, so
// show the modal and let them set a new password.
async function handlePasswordRecovery() {
    if (!window.location.hash.includes("type=recovery")) return;
    if (!supabaseClient) return;
    authModal.classList.remove("hidden");
    authModalTitle.textContent = "Set a new password";
    authSubmitBtn.textContent = "Save new password";
    document.getElementById("auth-password").required = true;
    // Re-use the auth form submit for this: it is handled in the submit
    // listener below - if a recovery session exists, updateUser is used.
    isSignUp = false;
}
handlePasswordRecovery();

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
        // V11: password recovery - user came from a reset email link
        if (window.location.hash.includes("type=recovery")) {
            const { error } = await supabaseClient.auth.updateUser({ password });
            if (error) throw error;
            alert("Password updated! You can now sign in with your new password.");
            window.location.hash = "";
            authModal.classList.add("hidden");
            authModalTitle.textContent = "Sign In to KineticAI";
            authSubmitBtn.textContent = "Sign In";
            return;
        }
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
    loadUserSessions();
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
    loadUserSessions();
}

// V11: AI Coach - Gemini, start.
// This is the wiring, with a safe fallback. It NEVER sends the video itself
// to an LLM, and it NEVER puts a Gemini key in the browser.
// It sends only the MEASURED numbers (sport, score, joint-angle scores).
// If GEMINI_EDGE_FUNCTION_URL is set, it calls your Supabase Edge Function,
// which holds the Gemini key on the server and returns coaching text.
// If that is not set (or fails), it falls back to local rule-based coaching
// built from the lowest-scoring metrics - still specific, not generic.
function localCoachingText(score, best, flaws) {
    const lines = [];
    lines.push(`You scored ${score}/100 on ${currentSport}.`);
    if (flaws && flaws.length) {
        const worst = flaws.slice().sort((a, b) => (best[a.name] || 0) - (best[b.name] || 0))[0];
        lines.push(`Your biggest weakness right now is ${worst.name} at ${best[worst.name] || 0}%. Focus your next practice on that one movement - improving it will lift your whole score the most.`);
        lines.push(`Drill: ${worst.drill} - do 3 sets of 10, slow and controlled, before you try it at full speed again.`);
    } else {
        lines.push(`No major flaws in this clip - your form is solid across all measured angles. To push higher, work on consistency: repeat the same movement 10 times and aim for the same score every time.`);
    }
    const bestMetric = Object.entries(best || {}).sort((a, b) => b[1] - a[1])[0];
    if (bestMetric) lines.push(`Your strongest area was ${bestMetric[0]} at ${bestMetric[1]}% - keep doing whatever you are doing there.`);
    return lines.join(" ");
}

// V14: Gemini actually watches the clip.
// Capture 6 still frames from the video (10%, 25%, 40%, 55%, 70%, 90%),
// as small JPEGs, and send those frames + the MediaPipe measurements to
// Gemini via the Edge Function. Gemini can then see your form - body
// position, timing, follow-through - not just the numbers.
// If frame capture fails (e.g. a saved session video that will not seek),
// it falls back to metrics-only, same as v12/v13.
async function captureVideoFrames() {
    try {
        if (!playerVideo || !playerVideo.duration || !isFinite(playerVideo.duration)) return [];
        const wasPaused = playerVideo.paused;
        const currentTime = playerVideo.currentTime;
        const frames = [];
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 640 / (playerVideo.videoWidth || 640));
        canvas.width = Math.max(2, Math.round((playerVideo.videoWidth || 640) * scale));
        canvas.height = Math.max(2, Math.round((playerVideo.videoHeight || 360) * scale));
        const ctx = canvas.getContext("2d");
        for (const pct of [0.1, 0.25, 0.4, 0.55, 0.7, 0.9]) {
            const t = Math.min(playerVideo.duration - 0.1, Math.max(0, playerVideo.duration * pct));
            await new Promise((res) => {
                const onSeek = () => { playerVideo.removeEventListener("seeked", onSeek); res(); };
                playerVideo.addEventListener("seeked", onSeek);
                playerVideo.currentTime = t;
                setTimeout(res, 800); // do not hang forever on a bad seek
            });
            ctx.drawImage(playerVideo, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            frames.push(dataUrl.split(",")[1]); // base64 only, no data: prefix
        }
        playerVideo.currentTime = currentTime;
        if (!wasPaused) playerVideo.play().catch(() => {});
        return frames;
    } catch (e) { console.log("Frame capture failed, using metrics only:", e); return []; }
}

async function getAICoaching() {
    const textEl = document.getElementById("ai-coach-text");
    if (!grading || !grading.best || !Object.keys(grading.best).length) {
        textEl.textContent = "Grade a clip first - Coach Kinetic needs your measured scores to give you specific advice.";
        return;
    }
    const score = overallFromBest(grading.best);
    const defs = SPORT_GRADING[currentSport] || [];
    const flaws = defs.filter((d) => (grading.best[d.name] || 0) < 70);
    textEl.textContent = "Coach Kinetic is watching your clip... capturing frames, then grading what he sees.";
    // Try Gemini via Edge Function first - now WITH video frames
    if (GEMINI_EDGE_FUNCTION_URL) {
        try {
            const frames = await captureVideoFrames();
            const res = await fetch(GEMINI_EDGE_FUNCTION_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + SUPABASE_ANON_KEY,
                    "apikey": SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ sport: currentSport, score, metrics: grading.best, medianAngles: grading.median, flaws: flaws.map((d) => d.name), frames })
            });
            const data = await res.json();
            if (data && data.coaching) {
                currentCoachingText = data.coaching;
                // V14: if Gemini gave its own video grade, show it next to the MediaPipe score
                if (data.gemini_score !== undefined && data.gemini_score !== null) {
                    currentCoachingText = `Coach Kinetic video grade: ${data.gemini_score}/100 (Measured: ${score}/100). ` + data.coaching;
                    document.getElementById("skill-rating-desc").textContent = `Measured: ${score}/100 - Coach Kinetic watched your clip and graded it ${data.gemini_score}/100.`;
                }
                textEl.textContent = currentCoachingText;
                return;
            }
            if (data && data.error) console.log("Gemini error:", data.error);
        } catch (e) { console.log("Gemini Edge Function failed, using local coaching:", e); }
    }
    // Fallback: local rule-based coaching (Gemini not connected yet)
    currentCoachingText = localCoachingText(score, grading.best, flaws) + " (Coach Kinetic is not connected yet - connect him via the Edge Function in the v15 README.)";
    textEl.textContent = currentCoachingText;
}
document.getElementById("ask-coach-btn")?.addEventListener("click", getAICoaching);

// V9: My Sessions - load the signed-in user's saved sessions from Supabase,
// and let them watch a saved clip again (private bucket, so via a signed URL).
async function loadUserSessions() {
    const list = document.getElementById("history-list");
    if (!list) return;
    if (!supabaseClient || !currentUser) {
        list.innerHTML = '<p style="color: #94a3b8;">Sign in to see your saved sessions.</p>';
        return;
    }
    list.innerHTML = '<p style="color: #94a3b8;">Loading your sessions...</p>';
    try {
        const { data, error } = await supabaseClient
            .from("sessions")
            .select("id, sport, file_name, score, metrics, flaws, video_path, created_at")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(20);
        if (error) throw error;
        if (!data || !data.length) {
            list.innerHTML = '<p style="color: #94a3b8;">No sessions yet - upload a clip and grade it to start your history.</p>';
            return;
        }
        list.innerHTML = data.map((s) => {
            const date = new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
            const metrics = s.metrics ? Object.entries(s.metrics).map(([k, v]) => `${k}: ${v}%`).join(" - ") : "";
            return `<div class="history-item">
                <div class="history-score">${s.score}/100</div>
                <div class="history-meta">
                    <div class="history-title">${(s.sport || "").toUpperCase()} - ${s.file_name || "clip"}</div>
                    <div class="history-sub">${date}${metrics ? " - " + metrics : ""}</div>
                </div>
                ${s.video_path ? `<button class="history-play" data-path="${s.video_path}" data-score="${s.score}" data-sport="${s.sport || ""}" data-file="${s.file_name || "clip"}">Watch</button>` : ""}
                <button class="history-delete" data-id="${s.id}" data-path="${s.video_path || ""}">Delete</button>
            </div>`;
        }).join("");
        list.querySelectorAll(".history-play").forEach((btn) => {
            btn.addEventListener("click", async () => {
                try {
                    const { data: urlData, error } = await supabaseClient.storage.from("videos").createSignedUrl(btn.dataset.path, 3600);
                    if (error) throw error;
                    playerVideo.pause();
                    videoSource.src = urlData.signedUrl;
                    playerVideo.load();
                    isCustomVideoActive = true;
                    customFileName = btn.dataset.file;
                    currentSport = btn.dataset.sport || currentSport;
                    sportSelect.value = currentSport;
                    updateUI(currentSport, true);
                    document.getElementById("overall-score").textContent = btn.dataset.score;
                    document.getElementById("skill-rating-title").textContent = "Saved session";
                    document.getElementById("skill-rating-desc").textContent = `Watching your saved clip "${btn.dataset.file}" - score ${btn.dataset.score}/100.`;
                    playerVideo.play().catch(() => {});
                    window.scrollTo({ top: 0, behavior: "smooth" });
                } catch (e) { alert("Could not load that video: " + (e.message || e)); }
            });
        });
        list.querySelectorAll(".history-delete").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (!confirm("Delete this session? This also deletes the video from cloud storage.")) return;
                try {
                    if (btn.dataset.path) await supabaseClient.storage.from("videos").remove([btn.dataset.path]);
                    await supabaseClient.from("sessions").delete().eq("id", btn.dataset.id);
                    loadUserSessions();
                } catch (e) { alert("Delete failed: " + (e.message || e)); }
            });
        });
    } catch (e) {
        list.innerHTML = '<p style="color: #94a3b8;">Could not load sessions: ' + (e.message || e) + '</p>';
    }
}
document.getElementById("refresh-history-btn")?.addEventListener("click", loadUserSessions);

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

// V8: Upload the video to Supabase Storage (private bucket "videos").
// Runs in the background - grading starts immediately from the local file,
// it does not wait for the upload. If not signed in, or the bucket does
// not exist yet, it logs the reason and grading still works.
// V10: Hash the file so the site knows if it is the same clip again.
// SHA-256 of the actual video bytes - renaming the file does NOT change it,
// re-recording the same moment does (different bytes = different hash).
async function hashFile(file) {
    try {
        const buf = await file.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buf);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { console.log("Hash failed:", e); return null; }
}

// V11: Compress a video in the browser before it goes to Supabase.
// Re-encodes to max 720p at ~1.5 Mbps via canvas + MediaRecorder.
// This is for STORAGE only - grading still uses the original local file,
// so the score is not affected. If compression fails for any reason
// (browser does not support it, codec issue), it falls back to the
// original file and the upload still works.
async function compressVideo(file) {
    try {
        if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return file;
        if (file.size < 5 * 1024 * 1024) return file; // already small, not worth re-encoding
        const url = URL.createObjectURL(file);
        const vid = document.createElement("video");
        vid.muted = true; vid.playsInline = true; vid.src = url;
        await new Promise((res, rej) => { vid.onloadedmetadata = res; vid.onerror = rej; });
        const scale = Math.min(1, 720 / Math.max(vid.videoWidth, vid.videoHeight));
        const w = Math.max(2, Math.round(vid.videoWidth * scale / 2) * 2);
        const h = Math.max(2, Math.round(vid.videoHeight * scale / 2) * 2);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        const stream = canvas.captureStream(30);
        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1500000 });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        const done = new Promise((res) => { rec.onstop = res; });
        const draw = () => { if (!vid.paused && !vid.ended) ctx.drawImage(vid, 0, 0, w, h); requestAnimationFrame(draw); };
        rec.start(500);
        draw();
        await vid.play();
        await new Promise((res) => { vid.onended = res; });
        rec.stop();
        await done;
        URL.revokeObjectURL(url);
        const blob = new Blob(chunks, { type: "video/webm" });
        if (!blob.size || blob.size >= file.size) return file; // compression did not help
        console.log(`Compressed video: ${(file.size / 1048576).toFixed(1)}MB -> ${(blob.size / 1048576).toFixed(1)}MB`);
        const ext = file.name.split(".").pop();
        return new File([blob], file.name.replace(/\.[^.]+$/, ".webm"), { type: "video/webm" });
    } catch (e) { console.log("Compression failed, using original:", e); return file; }
}

async function uploadVideoToSupabase(file) {
    currentVideoPath = null;
    currentVideoHash = null;
    if (!supabaseClient || !currentUser) {
        console.log("Video not uploaded to cloud - sign in first to save videos.");
        return null;
    }
    try {
        // 1. Hash it first
        activeFileBadge.textContent = `Checking if this clip was already uploaded...`;
        activeFileBadge.classList.remove("hidden");
        const hash = await hashFile(file);
        currentVideoHash = hash;
        // 2. If this user already has a session with this exact hash, reuse it - no new upload, no extra storage
        if (hash) {
            const { data: existing } = await supabaseClient
                .from("sessions")
                .select("id, video_path, score")
                .eq("user_id", currentUser.id)
                .eq("video_hash", hash)
                .limit(1);
            if (existing && existing.length && existing[0].video_path) {
                currentVideoPath = existing[0].video_path;
                console.log("Duplicate clip detected - reusing saved video, no extra storage used. Previous score:", existing[0].score);
                activeFileBadge.textContent = `File: ${file.name} - already uploaded before, reusing saved copy (no extra storage)`;
                return currentVideoPath;
            }
        }
        // 3. Not a duplicate - compress first (V11), then upload once, using
        // the hash in the path so a second upload lands on the same path
        activeFileBadge.textContent = `Compressing ${file.name} to save space...`;
        const uploadFile = await compressVideo(file);
        const ext = (uploadFile.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
        const path = hash
            ? `${currentUser.id}/${hash}.${ext}`
            : `${currentUser.id}/${Date.now()}-${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        activeFileBadge.textContent = `Uploading ${file.name} to cloud...`;
        const { error } = await supabaseClient.storage.from("videos").upload(path, uploadFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: uploadFile.type || "video/mp4"
        });
        if (error) {
            // Already exists in Storage (same hash path) - reuse it, do not store a copy
            if (error.message && /already exists|Duplicate/i.test(error.message)) {
                currentVideoPath = path;
                activeFileBadge.textContent = `File: ${file.name} - already uploaded before, reusing saved copy (no extra storage)`;
                return path;
            }
            console.log("Video upload failed:", error.message);
            activeFileBadge.textContent = `File: ${file.name} (cloud upload failed - check the videos bucket exists)`;
            return null;
        }
        currentVideoPath = path;
        console.log("Video uploaded to Supabase Storage:", path);
        activeFileBadge.textContent = `File: ${file.name} - saved to cloud`;
        return path;
    } catch (e) { console.log("Video upload failed:", e); return null; }
}

function activateCustomFile(index) {
    const file = uploadedFolderFiles[index];
    if (!file) return;

    uploadVideoToSupabase(file);
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
    document.getElementById("gauge-circle").style.background = `conic-gradient(#c8f31d 0%, #1f293d 0deg)`;
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

// --- V13 GRADING: real measurement, not best-frame luck ---
// V4-V12 bug that made scores look random/fake: it kept the BEST angle
// seen in ANY frame. Pass through the ideal range for 1 frame and you
// got 100%, even if the rest of the clip was bad. There was NO random
// number in the code (grep Math.random = nothing), but best-only scoring
// made 100% far too easy - e.g. Arm Swing 100% + Knee Bend 100% on a
// clip where the form was not actually that good.
// V13 fixes it:
// - Every valid frame stores its measured angle (in degrees).
// - Final score uses the MEDIAN angle across all frames, not the best.
//   You have to hold good form through most of the clip to score high.
// - Score also blends in consistency: % of frames inside the ideal range.
//   Final metric score = 70% median-angle score + 30% consistency score.
// - The UI now shows the measured angle, e.g. "Elbow Angle - 92 deg
//   (ideal 80-110 deg) - 61%", so you can see it is a real measurement.
// - Duplicate joints fixed: Arm Extension / Arm Swing now measure the
//   shoulder angle (hip-shoulder-elbow), Elbow Angle measures the elbow
//   (shoulder-elbow-wrist). They were the same joints before, so they
//   always gave the same score.
// - A metric needs at least 5 valid frames, otherwise it stays 0 with
//   "not enough clear frames" - no score from 1 lucky frame.
const SPORT_GRADING = {
    basketball: [
        { name: "Elbow Angle", joints: [11, 13, 15], idealMin: 80, idealMax: 105, drill: "Fix Your Shooting Form: Perfect Elbow Alignment", channel: "Pure Sweat Basketball" },
        { name: "Knee Dip", joints: [23, 25, 27], idealMin: 85, idealMax: 125, drill: "Basketball Jump Shot: Knee Dip & Power", channel: "ShotMechanics" },
        { name: "Arm Extension", joints: [13, 11, 23], idealMin: 150, idealMax: 180, drill: "Mastering Higher Release Point & Wrist Snap", channel: "ShotMechanics" }
    ],
    volleyball: [
        { name: "Arm Swing Extension", joints: [14, 12, 24], idealMin: 140, idealMax: 180, drill: "Volleyball Spiking: How to Hit at Peak Height", channel: "Elevate Yourself" },
        { name: "Knee Bend", joints: [23, 25, 27], idealMin: 85, idealMax: 130, drill: "Volleyball Approach & Jump Technique", channel: "Elevate Yourself" },
        { name: "Elbow Angle", joints: [12, 14, 16], idealMin: 80, idealMax: 110, drill: "Fixing Arm Swing Biomechanics in Volleyball", channel: "Victoria Volleyball" }
    ],
    boxing: [
        { name: "Guard Elbow", joints: [11, 13, 15], idealMin: 75, idealMax: 105, drill: "Boxing Defense: Never Drop Your Guard While Punching", channel: "ExpertBoxing" },
        { name: "Punch Extension", joints: [14, 12, 24], idealMin: 150, idealMax: 180, drill: "Generate Maximum Power in your Right Cross", channel: "Tony Jeffries" },
        { name: "Knee Bend", joints: [23, 25, 27], idealMin: 100, idealMax: 140, drill: "Boxing Footwork & Hip Rotation", channel: "ExpertBoxing" }
    ]
};

function medianAngle(arr) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
function scoreFromAngles(angles, idealMin, idealMax) {
    if (!angles || angles.length < 5) return { score: 0, median: null, inRangePct: 0, count: angles ? angles.length : 0 };
    const med = medianAngle(angles);
    const medianScore = scoreForAngle(med, idealMin, idealMax);
    const inRange = angles.filter((a) => a >= idealMin && a <= idealMax).length;
    const inRangePct = Math.round((inRange / angles.length) * 100);
    const score = Math.round(medianScore * 0.7 + inRangePct * 0.3);
    return { score, median: med, inRangePct, count: angles.length };
}

let poseDetector = null;
let grading = null; // V13: { best: {name: score}, angles: {name: [deg]}, median: {name: deg}, samples: 0, timer: null }

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
        if (lm[i1].visibility < 0.5 || lm[i2].visibility < 0.5 || lm[i3].visibility < 0.5) return;
        const ang = Math.round(angleAt(lm[i1], lm[i2], lm[i3]));
        if (!grading.angles[def.name]) grading.angles[def.name] = [];
        grading.angles[def.name].push(ang);
        // Live score is now the median-based score, recomputed each frame
        const r = scoreFromAngles(grading.angles[def.name], def.idealMin, def.idealMax);
        if (r.score !== (grading.best[def.name] || 0)) { grading.best[def.name] = r.score; changed = true; }
        grading.median[def.name] = r.median;
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
    document.getElementById("gauge-circle").style.background = `conic-gradient(#c8f31d ${score}%, #1f293d 0deg)`;
    document.getElementById("skill-rating-title").textContent = score === 0 ? "Grading in progress…" : score >= 80 ? "Strong Form" : score >= 60 ? "Solid Form" : "Form Needs Work";
    document.getElementById("skill-rating-desc").textContent = `Grading your clip live — median angle across ${grading.samples} frames. Current: ${score}/100.`;
    const defs = SPORT_GRADING[currentSport] || [];
    document.getElementById("metrics-container").innerHTML = defs.map((d) => {
        const s = grading.best[d.name] || 0;
        const med = grading.median ? grading.median[d.name] : null;
        const angleText = med !== null && med !== undefined ? ` - ${med} deg (ideal ${d.idealMin}-${d.idealMax} deg)` : " - not enough clear frames yet";
        return `<div class="metric-item"><div class="metric-header"><span class="metric-name">${d.name}${angleText}</span><span class="metric-score">${s}%</span></div><div class="metric-bar-bg"><div class="metric-bar-fill" style="width: ${s}%;"></div></div></div>`;
    }).join("");
}

async function finalizeGrading(fileName) {
    if (!grading) return;
    grading.active = false;
    if (grading.timer) clearInterval(grading.timer);
    // V13: final scores are recomputed from the full angle history (median),
    // not the live best - so the final score cannot be inflated by 1 frame.
    const defs = SPORT_GRADING[currentSport] || [];
    defs.forEach((d) => {
        const r = scoreFromAngles(grading.angles[d.name] || [], d.idealMin, d.idealMax);
        grading.best[d.name] = r.score;
        grading.median[d.name] = r.median;
    });
    const score = overallFromBest(grading.best);
    renderGradingLive();
    if (grading.samples === 0 || score === 0) {
        document.getElementById("skill-rating-title").textContent = "No athlete detected";
        document.getElementById("skill-rating-desc").textContent = `Could not measure form in "${fileName}". Try a clearer, full-body clip with good lighting — score stays at 0/100 until the AI can see you.`;
    } else {
        document.getElementById("skill-rating-title").textContent = score >= 80 ? "Strong Form" : score >= 60 ? "Solid Form" : "Form Needs Work";
        document.getElementById("skill-rating-desc").textContent = `Graded from your clip "${fileName}". Your score is ${score}/100, based on the median angle across ${grading.samples} frames - not your best single frame.`;
    }
    const flaws = defs.filter((d) => (grading.best[d.name] || 0) < 70);
    document.getElementById("flaws-list").innerHTML = flaws.length
        ? flaws.map((d) => `<li class="flaw-card"><span class="flaw-icon">⚠️</span><div>${d.name}: scored ${grading.best[d.name] || 0}% (median ${grading.median[d.name] ?? "?"} deg, ideal ${d.idealMin}-${d.idealMax} deg). Work on getting closer to the ideal range for this movement.</div></li>`).join("")
        : '<li class="flaw-card"><div>No major flaws detected in this clip.</div></li>';
    document.getElementById("recommendations-grid").innerHTML = (flaws.length ? flaws : defs.slice(0, 1)).map((d) => `
        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(d.drill)}" target="_blank" class="video-card">
            <div class="video-info"><div class="video-title">${d.drill}</div><div class="video-channel">${d.channel}</div></div>
        </a>`).join("");
    // V7/V8: Save this graded session to Supabase, if the user is signed in.
    // If not signed in, the score still shows on screen, it just is not saved.
    if (supabaseClient && currentUser && grading.samples > 0) {
        try {
            const sessionRow = {
                user_id: currentUser.id,
                sport: currentSport,
                file_name: fileName || "clip",
                score: score,
                metrics: grading.best,
                flaws: flaws.map((d) => d.name)
            };
            // V8: link the stored video, if the upload finished.
            // If the video_path column does not exist yet, retry without it.
            if (currentVideoPath) sessionRow.video_path = currentVideoPath;
            // V10: store the hash so future uploads of the same clip can be detected.
            if (currentVideoHash) sessionRow.video_hash = currentVideoHash;
            // V11: store AI coaching text if the user asked the coach before grading finished
            if (currentCoachingText) sessionRow.coaching_text = currentCoachingText;
            let { error } = await supabaseClient.from("sessions").insert(sessionRow);
            if (error && (error.message.includes("video_path") || error.message.includes("video_hash") || error.message.includes("coaching_text"))) {
                delete sessionRow.video_path;
                delete sessionRow.video_hash;
                delete sessionRow.coaching_text;
                ({ error } = await supabaseClient.from("sessions").insert(sessionRow));
                console.log("video_path/video_hash/coaching_text column missing - saved session without it. Run the v11 SQL to add them.");
            }
            if (error) {
                console.log("Session save failed:", error.message);
            } else {
                console.log("Session saved to Supabase.");
                document.getElementById("skill-rating-desc").textContent += " Saved to your account.";
                loadUserSessions();
            }
        } catch (e) { console.log("Session save failed:", e); }
    } else if (!currentUser) {
        console.log("Not signed in - session shown on screen but not saved to Supabase.");
    }
    // Next step: send grading.best + score to Gemini for coaching text.
}

async function analyzeUploadedVideo(fileName, sportKey) {
    // Score starts at 0. It only rises when MediaPipe measures good form.
    grading = { best: {}, angles: {}, median: {}, samples: 0, active: true, timer: null };
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
