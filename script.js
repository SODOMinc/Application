let questions = [];
let scoring = {};
let currentQuestion = 0;
let userId = null;
let answers = {};
let wickednessScore = 0;
const scriptURL = "https://script.google.com/macros/s/AKfycbxISFj9iLg-KxEAKOeR_oB8uB_SoqQqK-C53cASnC0J8Gtnxv2ughCIkd5ZjDoKOrIXTg/exec";

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
    console.error("Error getting user ID:", err);
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

  container.innerHTML = `<h3>${q.question}</h3>`;

  q.options.forEach((option, idx) => {
  const inputType = q.type === "multiple" ? "checkbox" : "radio";
  const id = `q${q.id}_opt${idx}`;
  container.innerHTML += `
    <label>
      <input id="${id}" type="${inputType}" name="q${q.id}" value="${option}"> ${option}
    </label>
  `;
});

  nextBtn.disabled = true;
  const inputs = Array.from(container.querySelectorAll("input"));

  inputs.forEach((el, idx, arr) => {
    el.addEventListener("change", () => {
      if (q.type === "multiple" && arr.length > 0) {
        const last = arr[arr.length - 1];
        if (el === last && el.checked) {
          arr.slice(0, -1).forEach(cb => (cb.checked = false));
        } else if (el !== last && el.checked) {
          last.checked = false;
        }
      }
      nextBtn.disabled = !arr.some(cb => cb.checked);
    });
  });

  nextBtn.onclick = nextQuestion;
}

function nextQuestion() {
  const q = questions[currentQuestion];
  const selectedEls = Array.from(
    document.querySelectorAll(`input[name="q${q.id}"]:checked`)
  );
  const selectedValues = selectedEls.map(el => el.value);
  answers[q.question] = selectedValues.join(", ");

  const qScoreMap = scoring[String(q.id)];
  if (qScoreMap) {
    selectedValues.forEach(val => {
      const points = qScoreMap[val];
      if (typeof points === "number") wickednessScore += points;
    });
  }

  currentQuestion++;
  if (currentQuestion < questions.length) {
    showQuestion();
  } else {
    finalize();
  }
}

function assignRole(score, answersObj) {
  const flags = {
    admittedKill: (answersObj["Have you ever killed?"] || "").includes("Yes"),
    admittedSteal: (answersObj["Have you ever stolen?"] || "").includes("Yes"),
    highestLoyalty: (answersObj["Agree with the following: I promise to give my whole self to the SODOM community"] || "").includes("I agree"),
    surrenderedBody: (answersObj["My body is in the hands of the city"] || "").includes("I agree"),
    lovesDestruction: (answersObj["Do you suffer from any of the following afflictions?"] || "").match(/I'm not limited by concern for others/i)
  };

  let role = "Civic Tender";
  if (score >= 10 && score < 20) role = "Pleasure Curator";
  if (score >= 20 && score < 30) role = "Vice Merchant";
  if (score >= 30 && score < 45) role = "Warden of Corruption";
  if (score >= 45 && score < 60) role = "Flamewright";
  if (score >= 60 && score < 80) role = "High Hedonist";
  if (score >= 80) role = "Consul of Sins";

  if (flags.admittedKill && score >= 30) role = "Flamewright";
  if (flags.admittedSteal && score >= 20) role = "Vice Merchant";
  if (flags.highestLoyalty && score >= 40) role = "Consul of Sins";
  if (flags.surrenderedBody && score >= 30) role = "High Hedonist";
  if (flags.lovesDestruction && score >= 25) role = "Warden of Corruption";

  return role;
}

function getFlavorText(role) {
  const text = {
    "Civic Tender": `
You keep the fountains clean and the licenses current.

The gates of SODOM are open.
Your homecoming awaits you..
    `,
    "Pleasure Curator": `
Your hands sculpt the city’s indulgences. Feasts, festivals, and ecstatic hollers follow wherever you pass.

The gates of SODOM are open.
Your homecoming awaits you..
    `,
    "Vice Merchant": `
You are a dealer in every delight outlawed by gentler worlds. Your market never sleeps, and neither do its patrons.

The gates of SODOM are open.
Your homecoming awaits you..
    `,
    "Warden of Corruption": `
You operate in alleys where light fears to tread. Justice in SODOM is calibrated on your knuckles.

The gates of SODOM are open.
Your homecoming awaits you..
    `,
    "Flamewright": `
You keep the fires lit, and sometimes you start new ones. The skyline grows crooked because of your playful destruction.

The gates of SODOM are open.
Your homecoming awaits you..
    `,
    "High Hedonist": `
Crowds chant your name. Your whims become festivals. Your appetites are a civic requirement.

The gates of SODOM are open.
Your homecoming awaits you..
    `,
    "Consul of Sins": `
You whisper commands and the city rearranges itself. Pleasure bends into architecture at your decree.

The gates of SODOM are open.
Your homecoming awaits you..
    `
  };
  return text[role] || "";
}

async function finalize() {
  const container = document.getElementById("question-container");
  document.getElementById("next-btn").remove();

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
