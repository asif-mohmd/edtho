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
  const modal = document.getElementById("settingsModal");
  const customUrlBtn = document.getElementById("customUrlBtn");
  const passwordBtn = document.getElementById("passwordBtn");
  const closeBtn = document.querySelector(".close");
  const modalTitle = document.getElementById("modalTitle");
  const urlSettings = document.getElementById("urlSettings");
  const passwordSettings = document.getElementById("passwordSettings");
  const updateSlugBtn = document.getElementById("updateSlugBtn");
  const updatePasswordBtn = document.getElementById("updatePasswordBtn");
  const newNoteBtn = document.getElementById("newNote");
  const saveNoteBtn = document.getElementById("saveNote");

  let currentNoteId = null;

  // Modal functions
  function showModal(title, section) {
    modalTitle.textContent = title;
    urlSettings.classList.remove("active");
    passwordSettings.classList.remove("active");
    section.classList.add("active");
    modal.style.display = "block";
    setTimeout(() => {
      modal.classList.add("show");
    }, 10);
  }

  function hideModal() {
    modal.classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
    }, 300);
  }

  // Modal event listeners
  customUrlBtn.addEventListener("click", () => {
    showModal("Set Custom URL", urlSettings);
  });

  passwordBtn.addEventListener("click", () => {
    showModal("Set Password", passwordSettings);
  });

  closeBtn.addEventListener("click", hideModal);

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      hideModal();
    }
  });

  // Handle custom URL update
  updateSlugBtn.addEventListener("click", async () => {
    const newSlug = customPathInput.value.trim();

    if (!newSlug) {
      showStatus("Please enter a custom URL", "error");
      return;
    }

    try {
      const response = await fetch(`/api/notes/${currentNoteId}/slug`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newSlug }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update URL");
      }

      window.history.pushState({}, "", `/${newSlug}`);
      currentNoteId = newSlug;
      showStatus("URL updated successfully", "success");
      hideModal();
      customPathInput.value = "";
    } catch (error) {
      showStatus(error.message, "error");
    }
  });

  // Password validation and UI
  function validatePassword(password) {
    const minLength = 4;
    const hasNumber = /\d/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= minLength;

    const strength = {
      score: 0,
      message: "",
    };

    if (isLongEnough) strength.score++;
    if (hasNumber) strength.score++;
    if (hasUpper) strength.score++;
    if (hasLower) strength.score++;
    if (hasSpecial) strength.score++;

    switch (strength.score) {
      case 0:
      case 1:
        strength.message = "Very Weak";
        break;
      case 2:
        strength.message = "Weak";
        break;
      case 3:
        strength.message = "Medium";
        break;
      case 4:
        strength.message = "Strong";
        break;
      case 5:
        strength.message = "Very Strong";
        break;
    }

    return {
      valid: strength.score >= 3,
      strength: strength.message.toLowerCase(),
      message: `Password is ${strength.message}`,
    };
  }

  function updatePasswordStrength(password) {
    const strengthBar = document.querySelector(".password-strength-bar");
    const strengthText = document.querySelector(".password-strength-text");
    const validation = validatePassword(password);

    strengthBar.className = "password-strength-bar";
    if (password) {
      strengthBar.classList.add(validation.strength);
    }

    strengthText.textContent = validation.message;
    return validation.valid;
  }

  // Update password handler
  // Update the password-related code in the event listener section:
  updatePasswordBtn.addEventListener("click", async () => {
    const passwordInput = document.getElementById("notePassword");
    const password = passwordInput.value.trim();
    const errorMessage = document.querySelector(".error-message");

    try {
      // Basic client-side validation
      if (!password) {
        throw new Error("Please enter a password");
      }

      if (password.length < 4) {
        throw new Error("Password must be at least 4 characters long");
      }

      const response = await fetch(`/api/notes/${currentNoteId}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set password");
      }

      showStatus("Password set successfully", "success");
      hideModal();
      passwordInput.value = "";
      errorMessage.classList.remove("show");
    } catch (error) {
      errorMessage.textContent = error.message;
      errorMessage.classList.add("show");
      showStatus(error.message, "error");
    }
  });

  // Add password strength indicator to the modal
  const strengthIndicator = document.createElement("div");
  strengthIndicator.className = "password-strength";
  strengthIndicator.innerHTML = `
    <div class="password-strength-bar"></div>
    <div class="password-strength-text"></div>
    <div class="error-message"></div>
  `;
  passwordSettings.insertBefore(strengthIndicator, passwordSettings.firstChild);

  // Add password input event listener
  const passwordInput = document.getElementById("notePassword");
  passwordInput.addEventListener("input", (e) => {
    updatePasswordStrength(e.target.value);
  });

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
      const data = { content };

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

  // Update the loadNote function
  async function loadNote(id) {
    try {
      const response = await fetch(`/api/notes/${id}`);
      const data = await response.json();

      console.log("Load note response:", data);
      if (!response.ok) {
        throw new Error(data.error || "Failed to load note");
      }

      if (!data.exists) {
        throw new Error("Note not found");
      }

      currentNoteId = id;

      // If note is password protected and not unlocked
      if (data.passwordProtected && !data.unlocked) {
        console.log("Showing password prompt modal");
        showPasswordPromptModal(id);
        return;
      }

      // Note is either not password protected or already unlocked
      noteContent.value = data.content || "";
      showStatus("Note loaded successfully", "success");
      updateLineCount();
    } catch (error) {
      showStatus(error.message, "error");
      if (error.message === "Note not found") {
        window.location.href = "/";
      }
    }
  }

  // Update password prompt modal
  function showPasswordPromptModal(noteId) {
    const modal = document.createElement("div");
    modal.id = "passwordPromptModal";
    modal.className = "modal";

    modal.innerHTML = `
    <div class="modal-content">
      <h3>This note is password protected</h3>
      <div class="password-prompt-container">
        <input 
          type="password" 
          id="promptPasswordInput" 
          placeholder="Enter password"
          class="password-input"
        />
        <div class="error-message"></div>
        <div class="modal-actions">
          <button class="btn success" id="submitPassword">Unlock</button>
          <button class="btn primary" id="cancelPassword">New note</button>
        </div>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    modal.style.display = "flex";
    requestAnimationFrame(() => {
      modal.classList.add("show");
    });

    // Show modal with animation
    setTimeout(() => modal.classList.add("show"), 10);

    const submitBtn = document.getElementById("submitPassword");
    const cancelBtn = document.getElementById("cancelPassword");
    const passwordInput = document.getElementById("promptPasswordInput");
    const errorMessage = modal.querySelector(".error-message");

    // Auto-focus password input
    passwordInput.focus();

    submitBtn.addEventListener("click", async () => {
      const password = passwordInput.value.trim();

      if (!password) {
        errorMessage.textContent = "Please enter a password";
        errorMessage.classList.add("show");
        passwordInput.classList.add("error");
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Checking...";

        const response = await fetch(`/api/notes/${noteId}/unlock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Invalid password");
        }

        // Successfully unlocked
        noteContent.value = data.content;
        showStatus("Note unlocked successfully", "success");
        closePasswordPromptModal();
        updateLineCount();
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.add("show");
        passwordInput.classList.add("error");
        passwordInput.value = "";
        passwordInput.focus();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Unlock";
      }
    });

    cancelBtn.addEventListener("click", () => {
      closePasswordPromptModal();
      window.location.href = "/";
    });

    // Handle Enter key
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        submitBtn.click();
      }
    });

    // Clear error state on input
    passwordInput.addEventListener("input", () => {
      errorMessage.classList.remove("show");
      passwordInput.classList.remove("error");
    });
  }

  function closePasswordPromptModal() {
    const modal = document.getElementById("passwordPromptModal");
    if (modal) {
      modal.remove();
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
