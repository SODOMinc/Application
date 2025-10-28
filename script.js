let questions = [];
let scoring = {};
let currentQuestion = 0;
let userId = null;
let answers = {};
let wickednessScore = 0;
const scriptURL = "https://script.google.com/macros/s/AKfycbxISFj9iLg-KxEAKOeR_oB8uB_SoqQqK-C53cASnC0J8Gtnxv2ughCIkd5ZjDoKOrIXTg/exec";

// NEW: control flag for intermission screen
let awaitingIntermission = false;

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

function showQuestion() {
  const container = document.getElementById("question-container");
  const nextBtn = document.getElementById("next-btn");
  const q = questions[currentQuestion];

  container.innerHTML = `
    <h3 class="question-text">${q.question}</h3>
    <div class="options-wrapper"></div>
  `;

  const optsContainer = container.querySelector(".options-wrapper");
  nextBtn.disabled = true;

  // Single-option auto-advance logic
  if (q.options.length === 1) {
    const onlyOpt = q.options[0];
    nextBtn.textContent = onlyOpt;
    nextBtn.disabled = false;
    nextBtn.onclick = () => {
      answers[q.question] = onlyOpt;
      addScore(q.id, onlyOpt);
      goNext();
    };
    return;
  }

  // Render multiple or single options
  q.options.forEach((option, idx) => {
    const inputType = q.type === "multiple" ? "checkbox" : "radio";
    const id = `q${q.id}_opt${idx}`;
    optsContainer.innerHTML += `
      <label class="option-label">
        <input id="${id}" type="${inputType}" name="q${q.id}" value="${option}">
        ${option}
      </label>
    `;
  });

  nextBtn.textContent = "next";

  const inputs = Array.from(optsContainer.querySelectorAll("input"));

  if (q.type === "multiple") {
    const lastInput = inputs[inputs.length - 1]; // last option acts as "none of the above"

    inputs.forEach((input, index) => {
      input.addEventListener("change", () => {
        if (input === lastInput && lastInput.checked) {
          // Uncheck all other options if last is checked
          inputs.forEach((otherInput, i) => {
            if (i !== inputs.length - 1) otherInput.checked = false;
          });
        } else if (input !== lastInput && input.checked) {
          // Uncheck last option if any other is checked
          lastInput.checked = false;
        }

        nextBtn.disabled = !inputs.some(cb => cb.checked);
      });
    });
  } else {
    // Single-choice radio buttons
    inputs.forEach(el => {
      el.addEventListener("change", () => {
        nextBtn.disabled = !inputs.some(cb => cb.checked);
      });
    });
  }

  nextBtn.onclick = collectSelections;
}

function collectSelections() {
  const q = questions[currentQuestion];
  const selectedEls = Array.from(
    document.querySelectorAll(`input[name="q${q.id}"]:checked`)
  );
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

// ✅ FEATURE #2 — Intermission after Question 15
function goNext() {
  currentQuestion++;

  if (currentQuestion === 15 && !awaitingIntermission) {
    return showIntermission();
  }

  if (currentQuestion < questions.length) showQuestion();
  else finalize();
}

function showIntermission() {
  awaitingIntermission = true;
  const container = document.getElementById("question-container");
  const nextBtn = document.getElementById("next-btn");

  const bg = wickednessScore > 20 ? "bg_sweet.png" : "bg_sour.png";

  // ✅ Smooth fade transition
  document.body.style.opacity = "0";
  setTimeout(() => {
    document.body.style.backgroundImage = `url('${bg}')`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.opacity = "1";
  }, 400);

  container.innerHTML = `
    <h3 class="question-text">show your screen to the supervisor before you proceed</h3>
  `;

  nextBtn.textContent = "next";
  nextBtn.disabled = false;
  nextBtn.onclick = () => {
    awaitingIntermission = false;

    // ✅ Fade back to default background
    document.body.style.opacity = "0";
    setTimeout(() => {
      document.body.style.backgroundImage = ""; 
      document.body.style.opacity = "1";
    }, 400);

    showQuestion(); // Continue with Q16
  };
}

function assignRole(score, answersObj) {
  const flags = {
    admittedKill: (answersObj["Have you ever killed?"] || "").includes("Yes"),
    admittedSteal: (answersObj["Have you ever stolen?"] || "").includes("Yes"),
    highestLoyalty: (answersObj["Agree with the following: I promise to give my whole self to the SODOM community"] || "").includes("I agree"),
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
