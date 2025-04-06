// ==== Initialize Back4App ====
Parse.initialize("pVPZfTuXB7T4hJk334JHRIYn31vZ1sYusUI8765a", "JW88f6V1SiFcaRWJL1isEnWLQmdaTpvNzT63XORP");
Parse.serverURL = "https://parseapi.back4app.com/";

// ==== Global State ====
let pyodide = null;
let currentTaskIndex = 0;
let experimentObject = null;
let currentDecision = null; // "trust" or "not_trust"


// ==== Create/Get participant ID ====
let participantId = localStorage.getItem("participantId");
if (!participantId) {
  participantId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  localStorage.setItem("participantId", participantId);
}

// ==== Task List ====
const tasks = [
  {
    "id": 1,
    "type": "warmup",
    "taskType": "data",
    "title": "Warmup 1: Data Architecture Task",
    "description": "You are given three tables: Employees, Departments, and Salaries. Each employee belongs to a department and has a salary record.\n How do you write a query that joins these tables using their foreign keys (department_id and employee_id) to generate a complete report showing employee details, their department name, and their salary?",
    "aiSuggestion": "Join Employees with Departments using department_id, then Salaries using employee_id."
  },
  {
    "id": 2,
    "type": "warmup",
    "taskType": "coding",
    "title": "Warmup 2: Coding Task",
    "description": "Write a Python function that takes two lists as input and returns a single list that combines both lists in order. For example, given list1 = [1, 2, 3] and list2 = [4, 5, 6], the function should return [1, 2, 3, 4, 5, 6].",
    "aiSuggestion": "To merge two lists into one in Python, we can use the `+` operator, which concatenates them element by element. So, we simply return the result of list1 + list2.\ndef concat_lists(list1, list2):\n    return list1 + list2"
  },
  {
    "id": 3,
    "type": "experiment",
    "taskType": "data",
    "title": "Experiment 1: Data Architecture Task",
    "description": "Imagine you’re working with a large Orders table and need to retrieve only the orders placed in the last 30 days. How do you write a SQL query that uses a date filter to compare each order_date with the current system date.",
    "aiSuggestion": "Use a WHERE clause with a date filter like: order_date >= CURRENT_DATE - INTERVAL '30 days'"
  },
  {
    "id": 4,
    "type": "experiment",
    "taskType": "data",
    "title": "Experiment 2: Data Architecture Task",
    "description": "You have two tables: Sales and Regions. Each sale has a region_id, and you need to summarize the total sales amount per region.\n Write a SQL/PySpark query that joins the tables on region_id and then groups the results to calculate the total sales for each region.",
    "aiSuggestion": "In this task, we need to summarize sales totals by region. First, we assume that the Sales table contains a region_id column that matches the Regions table's primary key. We join these two tables on region_id, and then use GROUP BY to aggregate total sales per region.\n \n GROUP BY region_id after joining Sales with Regions"
  },
  {
    "id": 5,
    "type": "experiment",
    "taskType": "coding",
    "title": "Experiment 3: Coding Task",
    "description": "Write a Python function that takes a string as input and returns the reverse of that string. For example, if the input is 'hello', the function should return 'olleh'.",
    "aiSuggestion": "def reverse_string(s):\n    return s[::-1]"
  },
  {
    "id": 6,
    "type": "experiment",
    "taskType": "data",
    "title": "Experiment 4: Data Architecture Task",
    "description": "You are working with a Users table and need to identify email addresses that appear more than once. Write a query that groups users by email and filters for those with a count greater than one.",
    "aiSuggestion": "The goal is to detect duplicate email addresses in the Users table. To do this, we group records by email and then use HAVING to filter only those groups where the email appears more than once.\n \n Use GROUP BY email HAVING COUNT(email) > 1"
  },
  {
    "id": 7,
    "type": "experiment",
    "taskType": "coding",
    "title": "Experiment 5: Coding Task",
    "description": "Create a Python function that accepts a list of integers and returns the maximum value in that list. For instance, given [3, 8, 2, 9], it should return 9. This task assesses your familiarity with Python’s built-in functions or your ability to implement logic to find the highest value manually.",
    "aiSuggestion": "To find the maximum value in a list, we can either loop through the list and track the highest value or use Python’s built-in `max()` function, which is optimized for this purpose. Using the built-in function is efficient and concise. \n \ndef find_max(numbers):\n    return max(numbers)"
  }
];

// ==== Pyodide Loader with stdout/stderr capture ====
async function loadPyodideAndPackages() {
  pyodide = await loadPyodide();
  pyodide.setStdout({
    batched: (s) => {
      const out = document.getElementById("output");
      if (out) out.textContent += s;
    },
  });
  pyodide.setStderr({
    batched: (s) => {
      const out = document.getElementById("output");
      if (out) out.textContent += s;
    },
  });
}

// ==== Typing Effect ====
function typeText(containerId, text, speed = 30) {
  const container = document.getElementById(containerId);
  container.textContent = "";
  let i = 0;
  function type() {
    if (i < text.length) {
      container.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

// ==== Reset Likert Radio Buttons ====
function clearLikertResponses() {
  document.querySelectorAll("#survey-questions input[type='radio']").forEach(input => {
    input.checked = false;
  });
}

// ==== Render Task ====
function renderTask(task) {
  const container = document.getElementById("task-container");
  container.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = task.title;
  container.appendChild(title);

  const desc = document.createElement("p");
  desc.textContent = task.description;
  container.appendChild(desc);

  if (task.taskType === "data") {
    const ai = document.createElement("div");
    ai.className = "balloon";
    ai.id = "ai-text";
    container.appendChild(ai);
    typeText("ai-text", task.aiSuggestion);
  } else {
    const ide = document.createElement("div");
    ide.className = "ide-container";

    const userEditor = document.createElement("div");
    userEditor.className = "editor";
    userEditor.id = "user-editor";
    ide.appendChild(userEditor);

    const aiBox = document.createElement("div");
    aiBox.className = "ai-suggestion-box";
    aiBox.id = "ai-suggestion-box";
    ide.appendChild(aiBox);

    container.appendChild(ide);

    const output = document.createElement("pre");
    output.className = "output";
    output.id = "output";
    container.appendChild(output);

    const runBtn = document.createElement("button");
    runBtn.textContent = "Run Code";
	runBtn.onclick = async () => {
	  const outputEl = document.getElementById("output");
	  outputEl.textContent = ""; // Clear previous output
	  const code = window.editor.getValue();
	  try {
		await pyodide.runPythonAsync(code);
	  } catch (err) {
		outputEl.textContent = err;
	  }
	};

    container.appendChild(runBtn);

    window.editor = ace.edit("user-editor");
    editor.session.setMode("ace/mode/python");
    editor.setValue("");

    typeText("ai-suggestion-box", task.aiSuggestion);
  }

  document.getElementById("trust-section").style.display = "block";
  document.getElementById("not-trust-popup").style.display = "none";
  document.getElementById("survey-questions").style.display = "none";
  clearLikertResponses();
}

// ==== Trust Logic ====
function handleTrust() {
  currentDecision = "trust";
  document.getElementById("survey-questions").style.display = "block";
}

function showNotTrustPopup() {
  currentDecision = "not_trust";
  document.getElementById("not-trust-popup").style.display = "block";
}

function submitNotTrustReason() {
  const reason = document.getElementById("notTrustReason").value.trim();
  if (reason) {
    localStorage.setItem("notTrustReason_" + tasks[currentTaskIndex].id, reason);
    document.getElementById("not-trust-popup").style.display = "none";
    document.getElementById("survey-questions").style.display = "block";
  }
}

// ==== Submit Survey Feedback ====
async function submitSurvey() {
  const task = tasks[currentTaskIndex];
  const taskId = task.id;

  const data = {
    decision: currentDecision || "undecided",  // fallback safety
  };

  // Collect Likert responses
  ["accuracy", "risk", "comfort", "trust"].forEach((key) => {
    const input = document.querySelector(`input[name="${key}"]:checked`);
    if (input) {
      data[key] = input.value;
    }
  });

  // Capture not trust reason if relevant
  const reasonInput = document.getElementById("notTrustReason");
  if (currentDecision === "not_trust" && reasonInput && reasonInput.value.trim()) {
    data.reason = reasonInput.value.trim();
  }

  // Capture user code if it's a coding task
  if (task.taskType === "coding" && window.editor) {
    data.userCode = window.editor.getValue();
  } else {
    data.userCode = "";
  }

  // Prepare Parse object
  if (!experimentObject) {
    const FullExperiment = Parse.Object.extend("FullExperimentData");
    experimentObject = new FullExperiment();
    experimentObject.set("participantId", participantId);
  }

  // Save feedback under dynamic field like task_1_feedback, task_2_feedback...
  experimentObject.set(`task_${taskId}_feedback`, data);
  await experimentObject.save();

  // Reset decision + popup fields
  currentDecision = null;
  if (reasonInput) reasonInput.value = "";
  document.getElementById("not-trust-popup").style.display = "none";

  // Move to next task or post-survey
  currentTaskIndex++;
  if (currentTaskIndex < tasks.length) {
    renderTask(tasks[currentTaskIndex]);
  } else {
    window.location.href = "post_experiment.html";
  }
}



// ==== On Load Handler ====
document.addEventListener("DOMContentLoaded", () => {
  loadPyodideAndPackages();

  const consentForm = document.getElementById("consent-form");
  if (consentForm) {
    consentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!document.getElementById("accept").checked) {
        alert("Please accept the consent.");
        return;
      }
      localStorage.setItem("consent", "true");
      window.location.href = "pre_experiment.html";
    });
  }

  const preSurveyForm = document.getElementById("preSurveyForm");
  if (preSurveyForm) {
    preSurveyForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(preSurveyForm);
      const data = {};
      formData.forEach((val, key) => (data[key] = val));

      const FullExperiment = Parse.Object.extend("FullExperimentData");
      experimentObject = new FullExperiment();
      experimentObject.set("participantId", participantId);
      experimentObject.set("preSurvey", data);
      await experimentObject.save();
      localStorage.setItem("experimentObjectId", experimentObject.id);
      window.location.href = "experiment.html";
    });
  }

  const postSurveyForm = document.getElementById("postSurveyForm");
  if (postSurveyForm) {
    postSurveyForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(postSurveyForm);
      const data = {};
      formData.forEach((val, key) => (data[key] = val));

      const id = localStorage.getItem("experimentObjectId");
      const FullExperiment = Parse.Object.extend("FullExperimentData");
      const query = new Parse.Query(FullExperiment);
      try {
        const obj = await query.get(id);
        obj.set("postSurvey", data);
        await obj.save();

        const popup = document.createElement("div");
        popup.textContent = "✅ Thank you! Your answers have been saved.";
        popup.style = "position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:#fff;padding:20px;border:2px solid #007BFF;border-radius:8px;";
        document.body.appendChild(popup);
      } catch (err) {
        alert("❌ Error saving post-survey. Please contact the researcher.");
      }
    });
  }

  if (document.getElementById("task-container")) {
    const id = localStorage.getItem("experimentObjectId");
    if (id) {
      const FullExperiment = Parse.Object.extend("FullExperimentData");
      const query = new Parse.Query(FullExperiment);
      query.get(id).then(obj => {
        experimentObject = obj;
        renderTask(tasks[currentTaskIndex]);
      });
    }
  }
});
