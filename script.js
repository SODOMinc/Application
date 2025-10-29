let questions = [];
let scoring = {};
let currentQuestion = 0;
let userId = null;
let answers = {};
let wickednessScore = 0;
const scriptURL = "https://script.google.com/macros/s/AKfycbxISFj9iLg-KxEAKOeR_oB8uB_SoqQqK-C53cASnC0J8Gtnxv2ughCIkd5ZjDoKOrIXTg/exec";

// popup control (Challenge Mode)
let spawnedCount = 0;
let activePopups = 0;
let spawnTimer = null;
let spawningStopped = false;
const MAX_POPUPS = 15; // slightly higher for more annoyance
let currentDelay = 700; // faster initial spawn
const MIN_DELAY = 200;
const DELAY_DECREASE = 80;

// NEW: control flag for intermission screen
let awaitingIntermission = false;

// main app wrapper
const appWrapper = document.getElementById("app");

function activatePopups() {
  appWrapper.classList.add("popups-active");
}

function deactivatePopups() {
  appWrapper.classList.remove("popups-active");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [qRes, sRes] = await Promise.all([
      fetch("questions.json"),
      fetch("scoring.json")
    ]);
    questions = await qRes.json();
    scoring = await sRes.json();
  } catch (err) {
    console.error("Error loading questions or scoring:", err);
  }

  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("question-screen").classList.add("hidden");
  document.getElementById("welcome-title").textContent = "loading...";

  getNewUserId().then(id => {
    userId = id;
    document.getElementById("welcome-title").textContent = `applicant ${id}`;
  });

  document.getElementById("start-btn").addEventListener("click", startSurvey);
});

async function getNewUserId() {
  try {
    const response = await fetch(scriptURL, {
      method: "POST",
      body: JSON.stringify({ init: true })
    });
    const data = await response.json();
    return data.userId || "#0000";
  } catch (err) {
    console.error("Error getting ID:", err);
    return "#0000";
  }
}

function startSurvey() {
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("question-screen").classList.remove("hidden");
  document.getElementById("applicant-id").textContent = userId;
  showQuestion();
}

let cascadeQuestions = []; // store all "I agree" questions
let cascadeIndex = 0;      // which question in the sequence
let activeCascadePopups = 0;

function showQuestion() {
  const container = document.getElementById("question-container");
  const nextBtn = document.getElementById("next-btn");
  const q = questions[currentQuestion];

  container.innerHTML = `
    <h3 class="question-text">${q.question}</h3>
    <div class="options-wrapper"></div>
  `;

  nextBtn.disabled = true;

  // check for "I agree" questions
  if (q.options.length === 1 && q.options[0] === "I agree") {
    cascadeQuestions = questions.slice(currentQuestion).filter(q => q.options.length === 1 && q.options[0] === "I agree");
    cascadeIndex = 0;
    activeCascadePopups = 0;

    document.body.classList.add("popups-active");
    container.classList.add("hidden-question-text");
    nextBtn.classList.add("hide-next");

    // spawn initial 3–9 popups of the first question (staggered)
  const initialCount = Math.floor(Math.random() * 7) + 3; // 3–9
  for (let i = 0; i < initialCount; i++) {
    const delay = i * 250 + Math.random() * 150; // base 600ms per popup + 0–400ms jitter
    setTimeout(() => {
      spawnCascadePopup(cascadeQuestions[0]);
    }, delay);
  }
    return;
  }

  // normal question rendering for non-I-agree
  q.options.forEach((option, idx) => {
    const inputType = q.type === "multiple" ? "checkbox" : "radio";
    const id = `q${q.id}_opt${idx}`;
    container.querySelector(".options-wrapper").innerHTML += `
      <label class="option-label">
        <input id="${id}" type="${inputType}" name="q${q.id}" value="${option}">
        ${option}
      </label>
    `;
  });

  nextBtn.textContent = "next";
  const inputs = Array.from(container.querySelectorAll("input"));
  inputs.forEach(el => {
    el.addEventListener("change", () => { nextBtn.disabled = !inputs.some(cb => cb.checked); });
  });

  nextBtn.onclick = collectSelections;
}

// Spawn a single cascading popup
function spawnCascadePopup(q) {
  activeCascadePopups++;

  const popup = document.createElement("div");
  popup.classList.add("popup-overlay", "annoying");

  // random style
  const types = ["popup-red", "popup-neon", "popup-tilt", "popup-mini"];
  const chosenType = types[Math.floor(Math.random() * types.length)];
  popup.classList.add(chosenType);
  if (chosenType === "popup-tilt") {
    const angle = Math.random() * 20 - 10;
    popup.style.setProperty("--angle", `${angle}deg`);
  }

  // random position
  const pw = 300, ph = 200;
  const maxX = Math.max(0, window.innerWidth - pw);
  const maxY = Math.max(0, window.innerHeight - ph);
  popup.style.left = `${Math.floor(Math.random() * maxX)}px`;
  popup.style.top = `${Math.floor(Math.random() * maxY)}px`;

  popup.innerHTML = `
    <div class="popup-box small">
      <p class="popup-question">${q.question}</p>
      <button class="agree-mini">I agree</button>
    </div>
  `;

  // random entrance animation
  const tx = Math.random() * 10 - 5;
  const ty = Math.random() * 10 - 5;
  const angle = Math.random() * 10 - 5;
  const scale = 0.9 + Math.random() * 0.5;
  popup.style.transform = `scale(${scale})`;
  popup.animate([
    { transform: `translate(0,0) rotate(0deg) scale(${scale})` },
    { transform: `translate(${tx}px, ${ty}px) rotate(${angle}deg) scale(${scale})` },
    { transform: `translate(0,0) rotate(0deg) scale(${scale})` }
  ], { duration: 400 + Math.random() * 200, iterations: 1 });

  const btn = popup.querySelector(".agree-mini");

  // Decide randomly if this popup is timed or multi-step
  const isTimed = Math.random() < 0.4;      // 40% chance
  const isMultiStep = !isTimed && Math.random() < 0.4; // 40% of remaining

  if (isTimed) {
    // Create a countdown bar
    const bar = document.createElement("div");
    bar.className = "popup-timer-bar";
    popup.querySelector(".popup-box").appendChild(bar);

    const duration = 2000 + Math.random() * 3000; // 2–5s
    btn.disabled = true;

    const startWidth = bar.offsetWidth;

    let start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      bar.style.width = `${(1 - progress) * 100}%`; // countdown effect
      if (progress < 1) requestAnimationFrame(step);
      else enableButton();
    }

    function enableButton() {
      btn.disabled = false;
      btn.onclick = closePopup; // allow closing now
    }

    requestAnimationFrame(step);
  }
 else if (isMultiStep) {
    const labels = ["I agree", "I really agree", "I totally agree"];
    let stepIndex = 0;
    btn.textContent = labels[stepIndex];
    btn.disabled = false;
    btn.onclick = () => {
      stepIndex++;
      if (stepIndex < labels.length) {
        btn.textContent = labels[stepIndex];
      } else {
        closePopup();
      }
    };
  } else {
    btn.disabled = false;
    btn.onclick = closePopup;
  }

  function closePopup() {
    popup.remove();
    answers[q.question] = "I agree";
    addScore(q.id, "I agree");
    activeCascadePopups--;

    // spawn next question popups if any remaining
    if (cascadeIndex < cascadeQuestions.length - 1) {
      cascadeIndex++;
      const nextQ = cascadeQuestions[cascadeIndex];
      const spawnCount = Math.floor(Math.random() * 3) + 1; // 1–3
      for (let i = 0; i < spawnCount; i++) {
        setTimeout(() => spawnCascadePopup(nextQ), i * 150 + Math.random() * 100);
      }
    }

    if (activeCascadePopups === 0 && cascadeIndex >= cascadeQuestions.length - 1) {
      document.body.classList.remove("popups-active");
      const container = document.getElementById("question-container");
      container.classList.remove("hidden-question-text");
      document.getElementById("next-btn").classList.remove("hide-next");
      currentQuestion += cascadeQuestions.length;
      if (currentQuestion < questions.length) showQuestion();
      else finalize();
    }
  }

  document.body.appendChild(popup);
}

function endPopupPhase(q) {
  clearSpawnTimer();
  deactivatePopups();
  const container = document.getElementById("question-container");
  container.classList.remove("hidden-question-text");

  const nextBtn = document.getElementById("next-btn");
  nextBtn.classList.remove("hide-next");

  const dim = document.querySelector(".popup-dim-overlay");
  if (dim) dim.remove();

  answers[q.question] = "I agree";
  addScore(q.id, "I agree");

  setTimeout(() => { goNext(); }, 120);
}

function clearSpawnTimer() {
  if (spawnTimer) {
    clearTimeout(spawnTimer);
    spawnTimer = null;
  }
}

function collectSelections() {
  const q = questions[currentQuestion];
  const selectedEls = Array.from(document.querySelectorAll(`input[name="q${q.id}"]:checked`));
  const selectedValues = selectedEls.map(el => el.value);

  answers[q.question] = selectedValues.join(", ");
  selectedValues.forEach(val => addScore(q.id, val));

  goNext();
}

function addScore(qid, val) {
  const qScoreMap = scoring[String(qid)];
  if (!qScoreMap) return;
  const points = qScoreMap[val];
  if (typeof points === "number") wickednessScore += points;
}

function goNext() {
  currentQuestion++;
  if (currentQuestion === 15 && !awaitingIntermission) return showIntermission();
  if (currentQuestion < questions.length) showQuestion();
  else finalize();
}

function showIntermission() {
  awaitingIntermission = true;
  const container = document.getElementById("question-container");
  const nextBtn = document.getElementById("next-btn");

  const bg = wickednessScore > 20 ? "bg_sweet.png" : "bg_sour.png";

  document.body.style.opacity = "0";
  setTimeout(() => {
    document.body.style.backgroundImage = `url('${bg}')`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.opacity = "1";
  }, 400);

  container.innerHTML = `<h3 class="question-text">show your screen to the supervisor before you proceed</h3>`;

  nextBtn.textContent = "next";
  nextBtn.disabled = false;
  nextBtn.onclick = () => {
    awaitingIntermission = false;
    document.body.style.opacity = "0";
    setTimeout(() => {
      document.body.style.backgroundImage = ""; 
      document.body.style.opacity = "1";
    }, 400);
    showQuestion();
  };
}

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
  const text = {
    "CIVIC TENDER": `
You keep the fountains clean and the licenses current.

THE GATES OF SODOM ARE OPEN.
YOUR HOMECOMING AWAITS YOU.
    `,
    "PLEASURE CURATOR": `
Your hands sculpt the city’s indulgences. Feasts, festivals, and ecstatic hollers follow wherever you pass.

THE GATES OF SODOM ARE OPEN.
YOUR HOMECOMING AWAITS YOU.
    `,
    "VICE MERCHANT": `
You are a dealer in every delight outlawed by gentler worlds. Your market never sleeps, and neither do its patrons.

THE GATES OF SODOM ARE OPEN.
YOUR HOMECOMING AWAITS YOU.
    `,
    "WARDEN OF CORRUPTION": `
You operate in alleys where light fears to tread. Justice in SODOM is calibrated on your knuckles.

THE GATES OF SODOM ARE OPEN.
YOUR HOMECOMING AWAITS YOU.
    `,
    "FLAMEWRIGHT": `
You keep the fires lit, and sometimes you start new ones. The skyline grows crooked because of your playful destruction.

THE GATES OF SODOM ARE OPEN.
YOUR HOMECOMING AWAITS YOU.
    `,
    "HIGH HEDONIST": `
Crowds chant your name. Your whims become festivals. Your appetites are a civic requirement.

THE GATES OF SODOM ARE OPEN.
YOUR HOMECOMING AWAITS YOU.
    `,
    "CONSUL OF SINS": `
You whisper commands and the city rearranges itself. Pleasure bends into architecture at your decree.

THE GATES OF SODOM ARE OPEN.
YOUR HOMECOMING AWAITS YOU.
    `
  };
  return text[role] || "";
}

async function finalize() {
  const container = document.getElementById("question-container");
  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.remove();

  const assignedRole = assignRole(wickednessScore, answers);
  const flavor = getFlavorText(assignedRole);

  container.innerHTML = `
    <div class="final-message">
      <strong>${assignedRole}</strong><br><br>
      ${flavor.replace(/\n/g, "<br>")}
    </div>
  `;

  const payload = { userId, answers, wickednessScore, assignedRole };

  try {
    await fetch(scriptURL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Error submitting answers:", err);
  }
}
