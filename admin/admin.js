const scriptURL = "https://script.google.com/macros/s/AKfycbwgK7WbPAHykLjSJac08X1wRpf8dASAvnDPjWdHBqkfqMjz2aLRw_6XcmitlEj0hfj5mw/exec";

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

    if (!data || Object.keys(data).length === 0) {
      resultsEl.textContent = `No data found for applicant ${userId}.`;
    } else {
      resultsEl.textContent = JSON.stringify(data, null, 2);
    }

  } catch (err) {
    console.error(err);
    resultsEl.textContent = "Error fetching data. Check console.";
  }
});
