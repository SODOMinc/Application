let questions = [];
let popups = [];
let scoring = {};
let currentQuestion = 0;
let userId = null;
let answers = {};
let wickednessScore = 0;
let lastPopupType = null;
let repeatCount = 0;

const scriptURL = "https://script.google.com/macros/s/AKfycbz0juFAT5s8c3GsO-HZD9ctuF7jc7KMZfz63L-h-eWsOqtYdOub8D3UaDY0qxndwWAY8w/exec";
const appWrapper = document.getElementById("app");

// ------------------------------
// INIT
// ------------------------------
let ads = [];

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [qRes, sRes, pRes, aRes] = await Promise.all([
      fetch("questions.json"),
      fetch("scoring.json"),
      fetch("popups.json"),
      fetch("ads.json")
    ]);

    questions = await qRes.json();
    scoring   = await sRes.json();
    popups    = await pRes.json();
    ads       = await aRes.json();   // <-- FIXED
  } catch (err) {
    console.error("Error loading files:", err);
  }

  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("question-screen").classList.add("hidden");
  document.getElementById("welcome-title").textContent = "loading...";

  // random background on load
  randomizeBackground();

  getNewUserId().then(id => {
  userId = id;
  document.getElementById("welcome-title").textContent = `applicant ${id}`;
  const idEl = document.getElementById("applicant-id");
  if (idEl) idEl.textContent = id; // <-- Update top-bar ID immediately if already visible
  });

  document.getElementById("start-btn").addEventListener("click", startSurvey);
});

async function getNewUserId() {
  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      body: JSON.stringify({ init: true })
    });
    const data = await res.json();
    return data.userId || "#0000";
  } catch (err) {
    return "#0000";
  }
}

// ------------------------------
// BACKGROUND RANDOMIZER
// ------------------------------
function randomizeBackground() {
  const bgs = ["bg_1.jpg", "bg_2.jpg", "bg_3.jpg"];
  const chosen = bgs[Math.floor(Math.random() * bgs.length)];
  document.body.style.backgroundImage = `url(${chosen})`;
}

// ------------------------------
// POPUP SCHEDULE
// ------------------------------
let popupSchedule = [];
let popupIndex = 0;

function schedulePopups() {
  const totalQs = questions.length;
  popupSchedule = [];

  // every 3rd question at most
  let i = 2;
  while (i < totalQs - 1) {
    popupSchedule.push(i);
    i += 1 + Math.floor(Math.random() * 3); // max spacing 3 questions
  }

  // ensure the last question always has a popup
  if (!popupSchedule.includes(totalQs - 1)) popupSchedule.push(totalQs - 1);
}

// ------------------------------
// SURVEY FLOW
// ------------------------------
function startSurvey() {
  schedulePopups();
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("question-screen").classList.remove("hidden");
  document.getElementById("applicant-id").textContent = userId;
  document.getElementById("next-btn").style.display = "block";
  showQuestion();
}

// ------------------------------
// QUESTION DISPLAY
// ------------------------------
let adIndex = 0;
function showQuestion() {
  const container = document.getElementById("question-container");
  const nextBtn = document.getElementById("next-btn");
  const q = questions[currentQuestion];

  // Render question
  container.innerHTML = `
    <h3 class="question-text">${q.question}</h3>
    <div class="options-wrapper"></div>
  `;

  fitQuestionText();

  nextBtn.disabled = true;
  nextBtn.textContent = "next";

  const wrapper = container.querySelector(".options-wrapper");

  // Render options
  q.options.forEach((option, idx) => {
    const id = `q${q.id}_opt${idx}`;
    const inputType = q.type === "multiple" ? "checkbox" : "radio";

    wrapper.innerHTML += `
      <label class="option-label">
        <input id="${id}" type="${inputType}" name="q${q.id}" value="${option}">
        ${option}
      </label>
    `;
  });

  const inputs = Array.from(container.querySelectorAll("input"));

  // Add change listeners
  inputs.forEach((el, idx) => {
    el.addEventListener("change", () => {
      if (q.type === "multiple") {
        const lastIdx = inputs.length - 1; // last option = 'none of the above'
        if (idx === lastIdx && el.checked) {
          // Uncheck all other options if last is checked
          inputs.forEach((other, i) => {
            if (i !== lastIdx) other.checked = false;
          });
        } else if (idx !== lastIdx && el.checked) {
          // Uncheck last option if any other is checked
          inputs[lastIdx].checked = false;
        }
      }

      // Enable next button if at least one selected
      nextBtn.disabled = !inputs.some(cb => cb.checked);
    });
  });

  // Set next button action
  nextBtn.onclick = collectSelections;

  //Advertisements
  if (Math.random() < 0.4 && ads.length > 0) {
    const ad = ads[adIndex % ads.length];
    adIndex++;
    showAdPopup(ad.text);
  }
  
  // Trigger popup if scheduled
  if (popupSchedule.includes(currentQuestion) || currentQuestion === questions.length - 1) {
    let popupData;

    // Always reserve the last popup for the final question
    if (currentQuestion === questions.length - 1) {
      popupData = popups[popups.length - 1];
    } else {
      // Use popups in listed order (skip the last one until the end)
      popupData = popups[popupIndex % (popups.length - 1)];
      popupIndex++;
    }

    spawnPopup(popupData);
  }
}

function fitQuestionText() {
  const questionEl = document.querySelector(".question-text");
  const optionEls = document.querySelectorAll(".option-label");

  if (!questionEl) return;

  const maxLines = 2;
  const lineHeight = parseFloat(window.getComputedStyle(questionEl).lineHeight);
  const maxHeight = maxLines * lineHeight;
  let fontSize = parseFloat(window.getComputedStyle(questionEl).fontSize);

  // shrink question text until it fits within two lines or hits a lower limit
  while (questionEl.scrollHeight > maxHeight && fontSize > 14) {
    fontSize -= 1;
    questionEl.style.fontSize = fontSize + "px";
  }

  // also slightly scale down option text relative to question size
  optionEls.forEach(el => {
    el.style.fontSize = Math.max(12, fontSize * 0.6) + "px";
  });
}

// ------------------------------
// POPUP SYSTEM
// ------------------------------

// Track recent popup types to avoid repetition and ensure full coverage
let usedPopupTypes = new Set();

function getPopupType() {
  let type;

  // If all types have been used at least once, reset the tracking set
  if (usedPopupTypes.size === 4) {
    usedPopupTypes.clear();
  }

  // Try to pick a new type that hasn’t been used yet (prefer diversity)
  const available = [1, 2, 3, 4].filter(t => !usedPopupTypes.has(t));

  // If all have been used or we're forced to repeat, pick from all 4
  if (available.length > 0) {
    type = available[Math.floor(Math.random() * available.length)];
  } else {
    do {
      type = Math.floor(Math.random() * 4) + 1;
    } while (lastPopupType === type && repeatCount >= 2);
  }

  // Track this type for next time
  usedPopupTypes.add(type);

  // Repeat-limit logic
  if (type === lastPopupType) {
    repeatCount++;
  } else {
    repeatCount = 1;
    lastPopupType = type;
  }

  return type;
}

function spawnPopup(popupData, parent = null) {
  const popup = document.createElement("div");
  popup.classList.add("popup-overlay", "annoying");

  const type = getPopupType();
  let html = "";

  // Type 1–3 use normal structure
  if (type === 1 || type === 2 || type === 3) {
    html += `<div class="popup-box small"><p class="popup-question">${popupData.text}</p>`;
    if (type === 1) {
      html += `
        <div class="progress-bar" style="width: 100%; height: 6px; background: #222; border-radius: 4px; overflow: hidden; margin-top: 10px;">
          <div class="progress-inner"></div>
        </div>
        <button class="agree-mini">I agree</button>`;
    } else {
      html += `<button class="agree-mini">I agree</button>`;
    }
    html += `</div>`;
  }

  // Type 4: scroll box with button below
  else if (type === 4) {
    popup.classList.add("type-4");
    html += `
      <div class="popup-box small type-4" style="display:flex; flex-direction:column; gap:8px;">
        <div class="scroll-box">
          ${Array(25).fill(popupData.text).map(t => `<p>${t}</p>`).join("")}
        </div>
        <div class="agree-mini-container">
          <button class="agree-mini" disabled>I agree</button>
        </div>
      </div>`;
  }

  popup.innerHTML = html;
  document.body.appendChild(popup);

  const popupBox = popup.querySelector(".popup-box");

  // Get popup size
  const pw = popupBox.offsetWidth;
  const ph = popupBox.offsetHeight;

  // Random placement
  let left = Math.random() * (window.innerWidth - pw);
  let top = Math.random() * (window.innerHeight - ph);

  // Clamp so popup stays inside viewport
  left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
  top = Math.max(10, Math.min(top, window.innerHeight - ph - 10));

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  // If popup is larger than viewport, center and allow scroll
  if (pw > window.innerWidth * 0.9 || ph > window.innerHeight * 0.9) {
    popup.style.left = "50%";
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.maxWidth = "90vw";
    popup.style.maxHeight = "90vh";
    popup.style.overflow = "auto";
  }
  
  const btn = popup.querySelector(".agree-mini");

  // Block main UI while popup is active
  appWrapper.classList.add("popups-active");
  document.getElementById("question-screen").style.pointerEvents = "none";

  // ---------------- TYPE-1 PROGRESS TIMER WITH EARLY-CLICK HANDLING ----------------
  if (type === 1) {
    let finished = false;
    let canClose = false;

    // create popup + progress bar as before
    const progressContainer = popup.querySelector(".progress-bar");
    const bar = popup.querySelector(".progress-inner");
    const speedMultiplier = 1; // or your existing value
    let start = performance.now();
    let remainingTime = 3000; // or your current setting

    function animate(t) {
      const elapsed = (t - start) / speedMultiplier;
      const progress = Math.max(0, 1 - elapsed / remainingTime);
      bar.style.width = progress * 100 + "%";

      if (!finished && progress > 0) {
        requestAnimationFrame(animate);
      } else if (!finished) {
        finished = true;
        canClose = true; // ✅ mark popup as closable now
        if (progressContainer) progressContainer.remove();
      }
    }

    requestAnimationFrame(animate);

    btn.addEventListener("click", (e) => {
      if (!canClose) {
        // Early click → flash red + slow timer a bit
        bar.style.background = "red";
        setTimeout(() => {
          bar.style.background = "linear-gradient(to right, #000080, #0000cd)";
        }, 500);

        remainingTime *= 1.3; // slightly extend timer
        e.stopPropagation();
        return;
      }

      // ✅ Normal close when finished
      popup.remove();
      appWrapper.classList.remove("popups-active");
      document.getElementById("question-screen").style.pointerEvents = "auto";
      if (popupData.text) answers[popupData.text] = "I agree";
    });
  }

  // ---------------- TYPE-2 MULTI-STEP ----------------
  if (type === 2) {
    let step = 0;
    const stepTexts = ["I agree", "I really agree", "I totally agree"];
    btn.addEventListener("click", () => {
      if (step < 2) {
        step++;
        btn.textContent = stepTexts[step];
        return;
      }
      popup.remove();
      if (document.querySelectorAll(".popup-overlay.annoying").length === 0) {
        appWrapper.classList.remove("popups-active");
        document.getElementById("question-screen").style.pointerEvents = "auto";
      }
      if (popupData.text) answers[popupData.text] = "I agree";
    });
  }

  // ---------------- TYPE-3 SPAWN CHILDREN ----------------
  if (type === 3 && !parent) {
    btn.addEventListener("click", () => {
      popup.remove();
      if (document.querySelectorAll(".popup-overlay.annoying").length === 0) {
        appWrapper.classList.remove("popups-active");
        document.getElementById("question-screen").style.pointerEvents = "auto";
      }
      const spawnCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < spawnCount; i++) {
        const delay = 150 + Math.random() * 200;
        setTimeout(() => {
          const childData = popups[Math.floor(Math.random() * popups.length)];
          spawnPopup(childData, popupData);
        }, i * delay);
      }
      if (popupData.text) answers[popupData.text] = "I agree";
    });
  }

  // ---------------- TYPE-4 SCROLL ----------------
  if (type === 4) {
    const scrollBox = popup.querySelector(".scroll-box");
    btn.disabled = true;
    scrollBox.addEventListener("scroll", () => {
      const nearBottom = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 10;
      if (nearBottom) btn.disabled = false;
    });

    btn.addEventListener("click", () => {
      popup.remove();
      if (document.querySelectorAll(".popup-overlay.annoying").length === 0) {
        appWrapper.classList.remove("popups-active");
        document.getElementById("question-screen").style.pointerEvents = "auto";
      }
      if (popupData.text) answers[popupData.text] = "I agree";
    });
  }
}

// ------------------------------
// COLLECT ANSWERS
// ------------------------------
function collectSelections() {
  const q = questions[currentQuestion];
  const selected = Array.from(document.querySelectorAll(`input[name="q${q.id}"]:checked`)).map(
    el => el.value
  );
  answers[q.question] = selected.join(", ");
  selected.forEach(val => addScore(q.id, val));

  goNext();
}

// ------------------------------
// SCORING / NAVIGATION
// ------------------------------
function addScore(qid, val) {
  const map = scoring[String(qid)];
  if (!map) return;
  const pts = map[val];
  if (typeof pts === "number") wickednessScore += pts;
}

function goNext() {
  currentQuestion++;
  const halfway = Math.floor(questions.length / 2);
  if (currentQuestion === halfway) {
    showIntermissionPopup();
    return;
  }
  if (currentQuestion < questions.length) showQuestion();
  else finalize();
}

// ------------------------------
// INTERMISSION POPUP
// ------------------------------
function showIntermissionPopup() {
  const popup = document.createElement("div");
  popup.classList.add("popup-overlay", "intermission");

  // determine icon type based on wickednessScore
  const iconFile = wickednessScore > 30 ? "int_sweet.png" : "int_sour.png";

  popup.innerHTML = `
    <div class="title-bar">
      <span class="title-text">CONTROL POINT</span>
    </div>
    <div class="popup-box intermission">
      <div class="icon"></div>
      <div class="text">
        <p>Please contribute a meaningful song to SODOM</p>
        <input id="intermission-input" type="text" placeholder="song name...">
        <button id="intermission-next" class="agree-mini" disabled>next</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Set the icon background
  const iconDiv = popup.querySelector(".icon");
  iconDiv.style.backgroundImage = `url('${iconFile}')`;
  iconDiv.style.backgroundSize = "contain";
  iconDiv.style.backgroundPosition = "center";
  iconDiv.style.backgroundRepeat = "no-repeat";
  iconDiv.style.width = "64px";
  iconDiv.style.height = "64px";
  iconDiv.style.marginBottom = "12px";

  const input = popup.querySelector("#intermission-input");
  const btn = popup.querySelector("#intermission-next");

  // Block main UI while popup is active (blur background & disable pointer events)
  appWrapper.classList.add("popups-active");
  document.getElementById("question-screen").style.pointerEvents = "none";

  input.addEventListener("input", () => {
    btn.disabled = input.value.trim().length <= 3;
  });

  btn.addEventListener("click", () => {
    popup.remove();

    // Restore main UI when intermission popup is closed
    appWrapper.classList.remove("popups-active");
    document.getElementById("question-screen").style.pointerEvents = "auto";

    showQuestion();
  });
}

// ------------------------------
// FINALIZATION
// ------------------------------
async function finalize() {
  const container = document.getElementById("question-container");
  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.remove();

  const role = assignRole(wickednessScore, answers);
  const flavor = getFlavorText(role);
  const ending = getEndingText(); // separate helper

  container.innerHTML = `
    <div class="final-screen">
      <h2 class="final-role">${role}</h2>
      <p class="final-flavor">${flavor}</p>
      <p class="final-ending">${ending}</p>
    </div>
  `;

  try {
    await fetch(scriptURL, {
      method: "POST",
      body: JSON.stringify({ userId, answers, wickednessScore, assignedRole: role })
    });
  } catch (err) {
    console.error("Submit error:", err);
  }
}

// ===============================
// ADVERTISEMENT POPUP (SEPARATE)
// ===============================
const adTitles = [
  "HOLD UP!",
  "INDULGE!",
  "LOOK HERE!",
  "ATTENTION!",
  "DESIRE!"
];

function showAdPopup(text) {
  const popup = document.createElement("div");
  popup.classList.add("ad-popup-overlay");

  const randomTitle = adTitles[Math.floor(Math.random() * adTitles.length)];

  popup.innerHTML = `
    <div class="ad-popup-box">
      <div class="ad-popup-titlebar">
        <span class="ad-popup-title">${randomTitle}</span>
        <button class="ad-popup-close">X</button>
      </div>

      <div class="ad-popup-content">
        <p class="ad-popup-text">${text}</p>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Disable main UI
  appWrapper.classList.add("popups-active");
  document.getElementById("question-screen").style.pointerEvents = "none";

  // Close logic
  popup.querySelector(".ad-popup-close").addEventListener("click", () => {
    popup.remove();
    if (!document.querySelector(".ad-popup-overlay")) {
      appWrapper.classList.remove("popups-active");
      document.getElementById("question-screen").style.pointerEvents = "auto";
    }
  });
}


// ------------------------------
// ROLE & FLAVOR
// ------------------------------
function assignRole(score, answersObj) {
  const flags = {
    admittedKill: (answersObj["Have you ever killed?"] || "").includes("Yes"),
    admittedSteal: (answersObj["Have you ever stolen?"] || "").includes("Yes"),
    highestLoyalty: (answersObj["I promise to give my whole self to the SODOM community"] || "").includes("I agree"),
    surrenderedBody: (answersObj["My body is in the hands of the city"] || "").includes("I agree"),
    lovesDestruction: (answersObj["Do you suffer from any of the following afflictions?"] || "").match(/I'm not limited by concern for others/i)
  };

  let role = "CIVIC TENDER";
  if (score >= 20 && score < 30) role = "PLEASURE CURATOR";
  if (score >= 30 && score < 40) role = "DEALER OF VICES";
  if (score >= 40 && score < 60) role = "GUARDIAN OF CORRUPTION";
  if (score >= 60 && score < 80) role = "HEALER";
  if (score >= 80 && score < 100) role = "HIGH HEDONIST";
  if (score >= 100) role = "CONSUL OF SINS";

  if (flags.admittedKill && score >= 50) role = "HEALER";
  if (flags.admittedSteal && score >= 30) role = "DEALER OF VICES";
  if (flags.highestLoyalty && score >= 70) role = "CONSUL OF SINS";
  if (flags.surrenderedBody && score >= 60) role = "HIGH HEDONIST";
  if (flags.lovesDestruction && score >= 40) role = "GUARDIAN OF CORRUPTION";

  return role;
}

function getFlavorText(role) {
  const t = {
    "CIVIC TENDER": `You will keep the fountains clean and the licenses current.`,
    "PLEASURE CURATOR": `Your hands will sculpt the city’s indulgences.`,
    "DEALER OF VICES": `Here you can deal in every delight outlawed by gentler worlds.`,
    "GUARDIAN OF CORRUPTION": `You will operate in alleys where light fears to tread.`,
    "HEALER": `You keep their fires lit.`,
    "HIGH HEDONIST": `Crowds chant your name, your presence fuels the city.`,
    "CONSUL OF SINS": `You whisper commands and the city will rearrange itself.`
  };
  return t[role];
}

function getEndingText() {
  return `THE GATES OF SODOM ARE OPEN.<br>YOUR HOMECOMING AWAITS YOU.`;
}