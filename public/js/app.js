document.addEventListener("DOMContentLoaded", () => {
  const noteContent = document.getElementById("noteContent");
  const customPath = document.getElementById("customPath");
  const notePassword = document.getElementById("notePassword");
  const newNoteBtn = document.getElementById("newNote");
  const saveNoteBtn = document.getElementById("saveNote");
  const statusDiv = document.getElementById("status");

  let currentNoteId = null;

  // Check if we're viewing an existing note
  const pathParts = window.location.pathname.split("/");
  if (pathParts.length > 1 && pathParts[1]) {
    currentNoteId = pathParts[1];
    loadNote(currentNoteId);
  }

  // Event Listeners
  newNoteBtn.addEventListener("click", createNewNote);
  saveNoteBtn.addEventListener("click", saveNote);

  // Functions
  async function createNewNote() {
    currentNoteId = null;
    noteContent.value = "";
    customPath.value = "";
    notePassword.value = "";
    window.history.pushState({}, "", "/");
    showStatus("New note created", "success");
  }

  async function saveNote() {
    try {
      const content = noteContent.value.trim();
      if (!content) {
        showStatus("Note cannot be empty", "error");
        return;
      }

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
