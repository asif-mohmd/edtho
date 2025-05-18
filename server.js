require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const logger = require("./config/logger");
const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: "Too many requests from this IP, please try again later",
});

// Middleware
app.use(compression());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "edtho_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Handle database connection
db.connect((err) => {
  if (err) {
    logger.error("Error connecting to MySQL:", err);
    return;
  }
  logger.info("Connected to MySQL database");

  // Create tables if they don't exist
  const createNotesTable = `
    CREATE TABLE IF NOT EXISTS notes (
      id VARCHAR(255) PRIMARY KEY,
      content TEXT,
      password VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  db.query(createNotesTable, (err) => {
    if (err) {
      logger.error("Error creating notes table:", err);
    } else {
      logger.info("Notes table ready");
    }
  });
});

// Generate a random ID for notes
function generateRandomId(length = 8) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

// Validate input
function validateNoteContent(content) {
  // Ensure content is a string and not too large
  if (typeof content !== "string") {
    return false;
  }

  // Limit content size to 1MB to prevent DoS attacks
  if (Buffer.byteLength(content, "utf8") > 1024 * 1024) {
    return false;
  }

  return true;
}

function validateId(id) {
  // Ensure ID is alphanumeric and reasonable length
  return /^[a-zA-Z0-9_-]{1,255}$/.test(id);
}

// API Routes
// Create a new note
app.post("/api/notes", async (req, res) => {
  const { content, customPath } = req.body;

  // Validate input
  if (!validateNoteContent(content)) {
    return res.status(400).json({ error: "Invalid content" });
  }

  if (customPath && !validateId(customPath)) {
    return res.status(400).json({ error: "Invalid custom path" });
  }

  const id = customPath || generateRandomId();

  // Check if custom path already exists
  if (customPath) {
    db.query(
      "SELECT id FROM notes WHERE id = ?",
      [customPath],
      (err, results) => {
        if (err) {
          console.error("Error checking custom path:", err);
          return res.status(500).json({ error: "Server error" });
        }

        if (results.length > 0) {
          return res.status(400).json({ error: "Custom URL already taken" });
        }

        insertNote();
      }
    );
  } else {
    insertNote();
  }

  function insertNote() {
    db.query(
      "INSERT INTO notes (id, content) VALUES (?, ?)",
      [id, content],
      (err) => {
        if (err) {
          console.error("Error saving note:", err);
          return res.status(500).json({ error: "Failed to save note" });
        }

        res.status(201).json({ id, success: true });
      }
    );
  }
});

// Get a note
app.get("/api/notes/:id", (req, res) => {
  const { id } = req.params;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  db.query("SELECT * FROM notes WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error("Error fetching note:", err);
      return res.status(500).json({ error: "Failed to fetch note" });
    }

    if (results.length === 0) {
      // Treat this as a custom URL
      return res.status(200).json({
        id,
        isCustomUrl: true,
        exists: false,
        content: null,
        passwordProtected: false,
      });
    }

    const note = results[0];

    // Check if note is password protected
    if (note.password) {
      return res.json({
        id: note.id,
        passwordProtected: true,
        unlocked: false,
        content: null,
        exists: true,
      });
    }

    res.json({
      id: note.id,
      content: note.content,
      passwordProtected: false,
      exists: true,
    });
  });
});

// Update a note
app.put("/api/notes/:id", (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  if (!validateNoteContent(content)) {
    return res.status(400).json({ error: "Invalid content" });
  }

  db.query(
    "UPDATE notes SET content = ? WHERE id = ?",
    [content, id],
    (err, result) => {
      if (err) {
        console.error("Error updating note:", err);
        return res.status(500).json({ error: "Failed to update note" });
      }

      if (result.affectedRows === 0) {
        db.query(
          "Insert INTO notes (id, content) VALUES (?, ?)",
          [id, content],
          (err, results) => {
            if (err) {
              console.error("Error creating note:", err);
              return res.status(500).json({ error: "Failed to create note" });
            }
            if (results.affectedRows === 0) {
              return res.status(404).json({ error: "Note not found" });
            }
            return res.json({ success: true });
          }
        );
      } else {
        return res.json({ success: true });
      }
    }
  );
});

// Set note password
app.post("/api/notes/:id/password", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Invalid password" });
  }

  try {
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    db.query(
      "UPDATE notes SET password = ? WHERE id = ?",
      [hashedPassword, id],
      (err, result) => {
        if (err) {
          console.error("Error setting password:", err);
          return res.status(500).json({ error: "Failed to set password" });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: "Note not found" });
        }

        res.json({ success: true });
      }
    );
  } catch (err) {
    console.error("Error hashing password:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Unlock a note
app.post("/api/notes/:id/unlock", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid password" });
  }

  db.query("SELECT * FROM notes WHERE id = ?", [id], async (err, results) => {
    if (err) {
      console.error("Error fetching note:", err);
      return res.status(500).json({ error: "Server error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }

    const note = results[0];

    try {
      // Compare password
      const match = await bcrypt.compare(password, note.password);
      if (!match) {
        return res.status(401).json({ error: "Incorrect password" });
      }

      res.json({
        id: note.id,
        content: note.content,
        passwordProtected: true,
        unlocked: true,
      });
    } catch (err) {
      console.error("Error comparing passwords:", err);
      res.status(500).json({ error: "Server error" });
    }
  });
});

// Note stats - admin only route
app.get("/api/stats", (req, res) => {
  // This should have proper authentication in production
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  db.query(
    "SELECT COUNT(*) as total, SUM(password IS NOT NULL) as protected FROM notes",
    (err, results) => {
      if (err) {
        console.error("Error fetching stats:", err);
        return res.status(500).json({ error: "Server error" });
      }

      res.json(results[0]);
    }
  );
});

// Cleanup expired notes (could be run as a cron job)
app.post("/api/maintenance/cleanup", (req, res) => {
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const daysToKeep = 90; // Delete notes older than 90 days

  db.query(
    "DELETE FROM notes WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
    [daysToKeep],
    (err, result) => {
      if (err) {
        console.error("Error cleaning up notes:", err);
        return res.status(500).json({ error: "Server error" });
      }

      res.json({
        success: true,
        deleted: result.affectedRows,
      });
    }
  );
});

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// SSR Route for the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  db.end();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Start server
const server = app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

module.exports = app; // For testing
