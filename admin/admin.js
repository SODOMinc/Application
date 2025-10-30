const scriptURL = "https://script.google.com/macros/s/AKfycbz0juFAT5s8c3GsO-HZD9ctuF7jc7KMZfz63L-h-eWsOqtYdOub8D3UaDY0qxndwWAY8w/exec";

let questions = [];

// Load questions.json first
fetch("questions.json")
  .then(res => res.json())
  .then(data => { questions = data; })
  .catch(err => console.error("Failed to load questions.json:", err));

document.getElementById("fetch-btn").addEventListener("click", async () => {
  const userId = document.getElementById("applicant-id").value.trim();
  const resultsEl = document.getElementById("results");

  if (!userId) {
    resultsEl.textContent = "Please enter an applicant ID.";
    return;
  }

  resultsEl.textContent = "Fetching...";

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      body: JSON.stringify({ fetchApplicant: userId })
    });

    const data = await res.json();

    if (!data || !data.answers) {
      resultsEl.textContent = `No data found for applicant ${userId}.`;
      return;
    }

    // Map Q1, Q2, ... to actual question text
    const mappedAnswers = {};
    for (const key in data.answers) {
      const match = key.match(/^Q(\d+)$/); // match Q1, Q2, ...
      if (match) {
        const qId = parseInt(match[1], 10);
        const questionObj = questions.find(q => q.id === qId);
        if (questionObj) {
          mappedAnswers[questionObj.question] = data.answers[key];
        } else {
          // This is likely a popup, keep key as-is
          mappedAnswers[key] = data.answers[key];
        }
      } else {
        mappedAnswers[key] = data.answers[key];
      }
    }

    // Display nicely
    resultsEl.innerHTML = `<pre>${JSON.stringify({ userId: data.userId, answers: mappedAnswers }, null, 2)}</pre>`;

  } catch (err) {
    console.error(err);
    resultsEl.textContent = "Error fetching data. Check console.";
  }
});