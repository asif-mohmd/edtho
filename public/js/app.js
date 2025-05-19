const phrases = [
  "എന്തായി കിടീലേ?😒",
  "നീ പൊളിച്ചേ കൂറ്റാ!😘",
  "ഇനി തരണമോ?😋",
  "ഇനി വേണോ?😏",
  "അങ്ങ് കൊടുക്കൂ കുമാരേട്ടാ!😲",
];

const MAX_LINES = 1500;
document.addEventListener("DOMContentLoaded", () => {
  const noteContent = document.getElementById("noteContent");
  const customPath = document.getElementById("customPath");
  const notePassword = document.getElementById("notePassword");
  const newNoteBtn = document.getElementById("newNote");
  const saveNoteBtn = document.getElementById("saveNote");
  const statusDiv = document.getElementById("status");

  const headerText = document.getElementById("headerText");
  const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

  // Add fade effect when setting phrase
  headerText.style.opacity = "0";
  headerText.style.transform = "translateY(-10px)";
  headerText.textContent = randomPhrase;

  // Force reflow to restart animation
  headerText.offsetHeight;
  headerText.style.animation = "fadeInDown 0.5s ease forwards";

  let currentNoteId = null;

  function enforceLineLimit() {
    let lines = noteContent.value.split("\n");
    if (lines.length > MAX_LINES) {
      noteContent.value = lines.slice(0, MAX_LINES).join("\n");
      showStatus(
        `Maximum ${MAX_LINES} lines allowed. Extra lines have been removed.`,
        "error"
      );
    }
  }

  noteContent.addEventListener("input", enforceLineLimit);
  noteContent.addEventListener("paste", function (e) {
    // Wait for paste to complete, then enforce
    setTimeout(enforceLineLimit, 0);
  });

  const updateSlugBtn = document.getElementById("updateSlugBtn");

  updateSlugBtn.addEventListener("click", async () => {
    const newSlug = customPath.value.trim();
    if (!newSlug) {
      showStatus("Please enter a custom URL.", "error");
      return;
    }
    if (!currentNoteId) {
      showStatus("No note loaded to update.", "error");
      return;
    }
    try {
      const response = await fetch(`/api/notes/${currentNoteId}/slug`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSlug }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update URL");
      }
      currentNoteId = newSlug;
      window.history.pushState({}, "", `/${newSlug}`);
      showStatus("Custom URL updated!", "success");
    } catch (error) {
      showStatus(error.message, "error");
    }
  });
  // Check if we're viewing an existing note
  const pathParts = window.location.pathname.split("/");
  if (pathParts.length > 1 && pathParts[1]) {
    currentNoteId = pathParts[1];
    loadNote(currentNoteId);
  } else {
    // No slug: create a new note and redirect to its URL
    autoCreateNote();
  }

  // Event Listeners
  newNoteBtn.addEventListener("click", createNewNote);
  saveNoteBtn.addEventListener("click", saveNote);

  // Functions
  async function createNewNote() {
    // Immediately create a new note with empty content and redirect to its slug
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: "" }),
      });
      const result = await response.json();
      if (response.ok && result.id) {
        window.location.replace(`/${result.id}`);
      } else {
        showStatus(result.error || "Failed to create note", "error");
      }
    } catch (error) {
      showStatus("Failed to create note", "error");
    }
  }

  async function autoCreateNote() {
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: "" }),
      });
      const result = await response.json();
      if (response.ok && result.id) {
        window.location.replace(`/${result.id}`);
      } else {
        showStatus(result.error || "Failed to create note", "error");
      }
    } catch (error) {
      showStatus("Failed to create note", "error");
    }
  }

  async function saveNote() {
    try {
      const content = noteContent.value.trim();
      //   if (!content) {
      //     showStatus("Note cannot be empty", "error");
      //     return;
      //   }

      const data = {
        content,
        customPath: customPath.value.trim(),
      };

      if (notePassword.value) {
        data.password = notePassword.value;
      }

      const url = currentNoteId ? `/api/notes/${currentNoteId}` : "/api/notes";
      const method = currentNoteId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save note");
      }

      if (!currentNoteId) {
        currentNoteId = result.id;
        window.history.pushState({}, "", `/${result.id}`);
      }

      showStatus("Note saved successfully", "success");
    } catch (error) {
      showStatus(error.message, "error");
    }
  }

  async function loadNote(id) {
    try {
      const response = await fetch(`/api/notes/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load note");
      }

      if (data.passwordProtected) {
        const password = prompt(
          "This note is password protected. Please enter the password:"
        );
        if (!password) {
          window.location.href = "/";
          return;
        }

        const unlockResponse = await fetch(`/api/notes/${id}/unlock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        });

        const unlockData = await unlockResponse.json();

        if (!unlockResponse.ok) {
          throw new Error(unlockData.error || "Invalid password");
        }

        noteContent.value = unlockData.content;
      } else {
        noteContent.value = data.content;
      }
      updateLineCount();
      showStatus("Note loaded successfully", "success");
    } catch (error) {
      showStatus(error.message, "error");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    }
  }

  function showStatus(message, type = "") {
    const status = document.getElementById("status");
    status.textContent = message;
    status.className = "status show" + (type ? " " + type : "");
    setTimeout(() => {
      status.className = "status" + (type ? " " + type : "");
    }, 3000);
  }

  // Auto-save functionality
  let autoSaveTimeout;
  noteContent.addEventListener("input", () => {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      if (currentNoteId) {
        saveNote();
      }
    }, 1500);
  });
});

const lineCount = document.getElementById("lineCount");

function updateLineCount() {
  const lines = noteContent.value.split("\n").length;
  lineCount.textContent = `${lines}/${MAX_LINES}`;
}

// Update line count on input and paste
noteContent.addEventListener("input", updateLineCount);
noteContent.addEventListener("paste", function () {
  setTimeout(updateLineCount, 0);
});

// Call once on page load
updateLineCount();
