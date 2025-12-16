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

let currentLang = 'en';  // default language
const translations = {
  en: { 
    startApplication: "start application",
    next: "next",
    loading: "loading...",
    welcomeSubtitle: "Join the new SODOM. Now more wicked than before. Sign up to be part of its rebirth.",
    agree: "I agree",
    agreeStep2: "I really agree",
    agreeStep3: "I totally agree",
    finalEnding: "THE GATES OF SODOM ARE OPEN.<br>YOUR HOMECOMING AWAITS YOU.",
    roles: {
      "CIVIC TENDER": "Civic Tender",
      "PLEASURE CURATOR": "Pleasure Curator",
      "DEALER OF VICES": "Dealer of Vices",
      "GUARDIAN OF CORRUPTION": "Guardian of Corruption",
      "HEALER": "Healer",
      "HIGH HEDONIST": "High Hedonist",
      "CONSUL OF SINS": "Consul of Sins"
    },
    flavor: {
      "CIVIC TENDER": "You will keep the fountains clean and the licenses current.",
      "PLEASURE CURATOR": "Your hands will sculpt the city’s indulgences.",
      "DEALER OF VICES": "Here you can deal in every delight outlawed by gentler worlds.",
      "GUARDIAN OF CORRUPTION": "You will operate in alleys where light fears to tread.",
      "HEALER": "You keep their fires lit.",
      "HIGH HEDONIST": "Crowds chant your name, your presence fuels the city.",
      "CONSUL OF SINS": "You whisper commands and the city will rearrange itself."
    }
  },
  de: { 
    startApplication: "Bewerbung starten",
    next: "weiter",
    loading: "lade...",
    welcomeSubtitle: "Tritt dem neuen SODOM bei. Jetzt noch verderbter als zuvor. Melde dich an, um Teil seiner Wiedergeburt zu sein.",
    agree: "Ich stimme zu",
    agreeStep2: "Ich stimme wirklich zu",
    agreeStep3: "Ich stimme vollkommen zu",
    finalEnding: "DIE TORE VON SODOM SIND GEÖFFNET.<br>DEINE HEIMKEHR WIRD ERWARTET.",
    roles: {
      "CIVIC TENDER": "Städtische:r Betreuer:in",
      "PLEASURE CURATOR": "Kurator:in des Vergnügens",
      "DEALER OF VICES": "Händler:in der Laster",
      "GUARDIAN OF CORRUPTION": "Wächter:in der Verderbnis",
      "HEALER": "Heiler:in",
      "HIGH HEDONIST": "Hochgenießer:in",
      "CONSUL OF SINS": "Konsul der Sünden"
    },
    flavor: {
      "CIVIC TENDER": "Du sorgst dafür, dass die Brunnen rein bleiben und die Stadtordnung aufrechterhalten wird.",
      "PLEASURE CURATOR": "Deine Hände formen die geheimen Genüsse der Stadt.",
      "DEALER OF VICES": "Hier handelst du mit allen verbotenen Freuden, die die Welt verbannt hat.",
      "GUARDIAN OF CORRUPTION": "Du agierst in dunklen Gassen, wo das Licht sich nicht wagt.",
      "HEALER": "Du nährst und bewahrst die Feuer derer, die dir vertrauen.",
      "HIGH HEDONIST": "Die Menge ruft deinen Namen, deine Präsenz entfacht die Lust der Stadt.",
      "CONSUL OF SINS": "Du flüsterst Befehle, und die Stadt biegt sich nach deinem Willen."
    }
  }
};

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
    ads       = await aRes.json();
  } catch (err) {
    console.error("Error loading files:", err);
  }

  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("question-screen").classList.add("hidden");
  document.getElementById("welcome-title").textContent = "loading...";

  randomizeBackground();

  getNewUserId().then(id => {
    userId = id;
    document.getElementById("welcome-title").textContent = `applicant ${id}`;
    const idEl = document.getElementById("applicant-id");
    if (idEl) idEl.textContent = id;
  });

  // Start button
  const startBtn = document.getElementById("start-btn");
  startBtn.textContent = translations[currentLang].startApplication;
  startBtn.addEventListener("click", startSurvey);

  // ------------------------------
  // LANGUAGE SWITCH (ADD HERE)
  // ------------------------------
  const languageSelect = document.getElementById("language-switch");

  languageSelect.addEventListener("change", async (e) => {
    currentLang = e.target.value;

    // Update static welcome screen text
    document.getElementById("start-btn").textContent = translations[currentLang].startApplication;
    document.getElementById("next-btn").textContent = translations[currentLang].next;
    document.querySelector("#welcome-screen .subtitle").innerHTML = translations[currentLang].welcomeSubtitle;

    try {
      const qRes = await fetch(currentLang === "de" ? "questions.de.json" : "questions.json");
      questions = await qRes.json();

      const pRes = await fetch(currentLang === "de" ? "popups.de.json" : "popups.json");
      popups = await pRes.json();

      // Optionally refresh question if survey started
      if (document.getElementById("welcome-screen").classList.contains("hidden")) {
          // We are mid-survey, re-render the current question in the new language
          showQuestion();
      }

      // Update button text
      document.getElementById("start-btn").textContent = translations[currentLang].startApplication;
      document.getElementById("next-btn").textContent = translations[currentLang].next;

    } catch (err) {
      console.error("Error loading language files:", err);
    }
  });
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
  nextBtn.textContent = translations[currentLang].next;

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
  const available = [2, 3, 4].filter(t => !usedPopupTypes.has(t));

  // If all have been used or we're forced to repeat, pick from all 4
  if (available.length > 0) {
    type = available[Math.floor(Math.random() * available.length)];
  } else {
    do {
      type = Math.floor(Math.random() * 3) + 2;
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

// -------------------
// HELPER: RESTORE UI
// -------------------
function restoreUIIfNoPopups() {
  if (!document.querySelector(".popup-overlay, .ad-popup-overlay, .intermission")) {
    appWrapper.classList.remove("popups-active");
    document.getElementById("question-screen").style.pointerEvents = "auto";
  }
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

        <div class="scroll-indicator-wrapper">
          <div class="scroll-indicator"></div>
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
  btn.textContent = translations[currentLang].agree;

  // Block main UI while popup is active
  appWrapper.classList.add("popups-active");
  document.getElementById("question-screen").style.pointerEvents = "none";

  // ---------------- TYPE-2 ----------------
  if (type === 2) {
    let step = 0;
    const stepTexts = [
      translations[currentLang].agree,
      translations[currentLang].agreeStep2,
      translations[currentLang].agreeStep3
    ];

    btn.addEventListener("click", () => {
      if (step < 2) {
        step++;
        btn.textContent = stepTexts[step];
        return;
      }
      popup.remove();
      restoreUIIfNoPopups();
      if (popupData.text) answers[popupData.text] = "I agree";
    });
  }

  // ---------------- TYPE-3 ----------------
  if (type === 3) {
    btn.addEventListener("click", () => {
      popup.remove();
      restoreUIIfNoPopups();
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

  // ---------------- TYPE-4 ----------------
  if (type === 4) {
    const scrollBox = popup.querySelector(".scroll-box");
    btn.textContent = translations[currentLang].agree;
    btn.disabled = true;
    const indicator = popup.querySelector(".scroll-indicator");

    scrollBox.addEventListener("scroll", () => {
      const scrollTop = scrollBox.scrollTop;
      const scrollHeight = scrollBox.scrollHeight - scrollBox.clientHeight;
      const pct = (scrollTop / scrollHeight) * 100;
      indicator.style.width = pct + "%";
      if (pct >= 95) btn.disabled = false;
    });

    btn.addEventListener("click", () => {
      popup.remove();
      restoreUIIfNoPopups();
      if (popupData.text) answers[popupData.text] = "I agree";
    });
  }
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
  const ending = getEndingText();

  container.innerHTML = `
    <div class="final-screen">
      <h2 class="final-role">${translations[currentLang].roles[role] || role}</h2>
      <p class="final-flavor">${flavor}</p>
      <p class="final-ending">${translations[currentLang].finalEnding}</p>
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
  return translations[currentLang].flavor[role] || "";
}

function getEndingText() {
  return translations[currentLang].finalEnding;
}

// ------------------------------
// Question Language
// ------------------------------
async function loadQuestions() {
  try {
    const qRes = await fetch(currentLang === 'en' ? 'questions.json' : 'questions.de.json');
    const pRes = await fetch(currentLang === 'en' ? 'popups.json' : 'popups.de.json');

    questions = await qRes.json();
    popups = await pRes.json();
  } catch (err) {
    console.error("Error loading questions/popups:", err);
  }
}


// ------------------------------
// COLLECT ANSWERS & SCORING
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

function addScore(qid, val) {
  const map = scoring[String(qid)];
  if (!map) return;
  const pts = map[val];
  if (typeof pts === "number") wickednessScore += pts;
}

function goNext() {
  currentQuestion++;
  if (currentQuestion < questions.length) showQuestion();
  else finalize();
}