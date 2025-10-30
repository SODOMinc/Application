let questions = [];
let popups = [];
let scoring = {};
let currentQuestion = 0;
let userId = null;
let answers = {};
let wickednessScore = 0;
let lastPopupType = null;
let repeatCount = 0;

const scriptURL = "https://script.google.com/macros/s/AKfycbxISFj9iLg-KxEAKOeR_oB8uB_SoqQqK-C53cASnC0J8Gtnxv2ughCIkd5ZjDoKOrIXTg/exec";
const appWrapper = document.getElementById("app");

// ------------------------------
// INIT
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [qRes, sRes, pRes] = await Promise.all([
      fetch("questions.json"),
      fetch("scoring.json"),
      fetch("popups.json")
    ]);
    questions = await qRes.json();
    scoring = await sRes.json();
    popups = await pRes.json();
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
  showQuestion();
}

// ------------------------------
// QUESTION DISPLAY
// ------------------------------
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
  const el = document.querySelector(".question-text");
  if (!el) return;

  const maxLines = 2;
  const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight);
  const maxHeight = maxLines * lineHeight;
  let fontSize = parseFloat(window.getComputedStyle(el).fontSize);

  // shrink font size until it fits within two lines or hits a lower limit
  while (el.scrollHeight > maxHeight && fontSize > 14) {
    fontSize -= 1;
    el.style.fontSize = fontSize + "px";
  }
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
          <div class="progress-inner" style="height: 100%; width: 100%; background: var(--accent); transition: width linear;"></div>
        </div>
        <button class="agree-mini" disabled>I agree</button>`;
    } else {
      html += `<button class="agree-mini">I agree</button>`;
    }
    html += `</div>`;
  }

  // Type 4: scroll box with button below
  else if (type === 4) {
    popup.classList.add("type-4"); // for CSS targeting
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

  // Get the actual popup size after DOM insertion
  const popupBox = popup.querySelector(".popup-box");
  const pw = popupBox.offsetWidth;
  const ph = popupBox.offsetHeight;

  // Make sure popup never goes off screen, even on small devices
  let left = Math.random() * (window.innerWidth - pw);
  let top = Math.random() * (window.innerHeight - ph);

  // Clamp position so it's always fully visible
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

  // Block main UI while popup is active
  appWrapper.classList.add("popups-active");
  document.getElementById("question-screen").style.pointerEvents = "none";

  const btn = popup.querySelector(".agree-mini");

  // Type 1 progress timer
  if (type === 1) {
    const bar = popup.querySelector(".progress-inner");
    const progressContainer = popup.querySelector(".progress-bar"); // container div
    let time = 2000 + Math.random() * 2000;
    let start = performance.now();

    function animate(t) {
      const elapsed = t - start;
      const progress = Math.max(0, 1 - elapsed / time);
      bar.style.width = progress * 100 + "%";

      if (progress > 0) {
        requestAnimationFrame(animate);
      } else {
        // enable the button and remove the progress bar
        btn.disabled = false;
        if (progressContainer) progressContainer.remove();
      }
    }

    requestAnimationFrame(animate);
  }

  // Type 4 scroll-to-enable
  if (type === 4) {
    const scrollBox = popup.querySelector(".scroll-box");
    scrollBox.addEventListener("scroll", () => {
      const nearBottom = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 10;
      if (nearBottom) btn.disabled = false;
    });
  }

  // Type 2 multi-step
  let step = 0;
  const stepTexts = ["I agree", "I really agree", "I totally agree"];

  btn.addEventListener("click", () => {
    if (type === 2 && step < 2) {
      step++;
      btn.textContent = stepTexts[step];
      return;
    }

    popup.remove();

    // Restore main UI if no popups left
    if (document.querySelectorAll(".popup-overlay.annoying").length === 0) {
      appWrapper.classList.remove("popups-active");
      document.getElementById("question-screen").style.pointerEvents = "auto";
    }

    // Type 3 spawns children only if original
    if (type === 3 && !parent) {
      const spawnCount = 1 + Math.floor(Math.random() * 2); // 1 or 2 children
      for (let i = 0; i < spawnCount; i++) {
        const delay = 150 + Math.random() * 200; // 150ms to 350ms stagger
        setTimeout(() => {
          const childData = popups[Math.floor(Math.random() * popups.length)];
          spawnPopup(childData, popupData);
        }, i * delay);
      }
    }

    if (popupData.text) answers[popupData.text] = "I agree";
  });
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
        <p>Show your screen to the supervisor</p>
        <input id="intermission-input" type="text" placeholder="...">
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
  if (score >= 10 && score < 20) role = "PLEASURE CURATOR";
  if (score >= 20 && score < 30) role = "VICE MERCHANT";
  if (score >= 30 && score < 45) role = "WARDEN OF CORRUPTION";
  if (score >= 45 && score < 60) role = "FLAMEWRIGHT";
  if (score >= 60 && score < 80) role = "HIGH HEDONIST";
  if (score >= 80) role = "CONSUL OF SINS";

  if (flags.admittedKill && score >= 30) role = "FLAMEWRIGHT";
  if (flags.admittedSteal && score >= 20) role = "VICE MERCHANT";
  if (flags.highestLoyalty && score >= 40) role = "CONSUL OF SINS";
  if (flags.surrenderedBody && score >= 30) role = "HIGH HEDONIST";
  if (flags.lovesDestruction && score >= 25) role = "WARDEN OF CORRUPTION";

  return role;
}

function getFlavorText(role) {
  const t = {
    "CIVIC TENDER": `You keep the fountains clean and the licenses current.`,
    "PLEASURE CURATOR": `Your hands sculpt the city’s indulgences.`,
    "VICE MERCHANT": `You are a dealer in every delight outlawed by gentler worlds.`,
    "WARDEN OF CORRUPTION": `You operate in alleys where light fears to tread.`,
    "FLAMEWRIGHT": `You keep the fires lit.`,
    "HIGH HEDONIST": `Crowds chant your name.`,
    "CONSUL OF SINS": `You whisper commands and the city rearranges itself.`
  };
  return t[role];
}

function getEndingText() {
  return `THE GATES OF SODOM ARE OPEN.<br>YOUR HOMECOMING AWAITS YOU.`;
}