require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const logger = require("./config/logger");
const connectDB = require("./config/database");
const Note = require("./models/Note");
const app = express();
const port = process.env.PORT || 3000;
const cron = require("node-cron");
const { getClientInfo } = require("./utils/analytics");
const {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
} = require("./utils/cryptoValidator");
const Visit = require("./models/Visit");
// const { cryptoEncrypt, cryptoDecrypt } = require("./utils/cryptoValidator");

// Connect to MongoDB
connectDB();

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
app.use(bodyParser.json({ limit: "5mb" }));
app.use(express.static("public"));

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

// Middleware to track visits
async function trackVisit(req, res, next) {
  const noteId = req.params.id;
  if (!noteId) {
    return next();
  }

  try {
    const clientInfo = getClientInfo(req);
    const action =
      req.method === "GET"
        ? "view"
        : req.method === "PUT"
        ? "edit"
        : req.method === "POST"
        ? "create"
        : "unlock";

    const visit = new Visit({
      noteId,
      ...clientInfo,
      action,
    });

    await visit.save();

    // Update note's visit count and last visited timestamp
    await Note.findOneAndUpdate(
      { id: noteId },
      {
        $inc: { visitCount: 1 },
        lastVisitedAt: new Date(),
      }
    );
  } catch (error) {
    logger.error("Error tracking visit:", error);
  }
  next();
}

// Apply visit tracking middleware to note-related routes
app.use("/api/notes/:id", trackVisit);

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

  try {
    // Check if custom path already exists
    if (customPath) {
      const existingNote = await Note.findOne({ id: customPath });
      if (existingNote) {
        return res.status(400).json({ error: "Custom URL already taken" });
      }
    }
    console.log(content);

    // Create new note
    const note = new Note({
      id,
      content: content || "",
    });

    await note.save();
    res.status(201).json({ id, success: true });
  } catch (error) {
    logger.error("Error creating note:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

// Get a note
app.get("/api/notes/:id", async (req, res) => {
  const { id } = req.params;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  try {
    const note = await Note.findOne({ id });

    if (!note) {
      // Treat this as a custom URL
      return res.status(200).json({
        id,
        isCustomUrl: true,
        exists: false,
        content: null,
        passwordProtected: false,
      });
    }

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
  } catch (error) {
    logger.error("Error fetching note:", error);
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

// Update a note
app.put("/api/notes/:id", async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  if (!validateNoteContent(content)) {
    return res.status(400).json({ error: "Invalid content" });
  }

  try {
    const note = await Note.findOneAndUpdate(
      { id },
      { content: content },
      { new: true, upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    logger.error("Error updating note:", error);
    res.status(500).json({ error: "Failed to update note" });
  }
});

// Update note slug (custom URL)
app.put("/api/notes/:id/slug", async (req, res) => {
  const { id } = req.params;
  const { newSlug } = req.body;

  if (!validateId(id) || !validateId(newSlug)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  try {
    // Check if newSlug already exists
    const existingNote = await Note.findOne({ id: newSlug });
    if (existingNote) {
      return res.status(400).json({ error: "Custom URL already taken" });
    }

    // Update the note's ID (slug)
    const note = await Note.findOneAndUpdate(
      { id },
      { id: newSlug },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    res.json({ success: true, newSlug });
  } catch (error) {
    logger.error("Error updating slug:", error);
    res.status(500).json({ error: "Failed to update slug" });
  }
});

// Set note password
// Update the password setting route
app.post("/api/notes/:id/password", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters long" });
  }

  try {
    const note = await Note.findOne({ id });

    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    const hashedPassword = await hashPassword(password);

    const updatedNote = await Note.findOneAndUpdate(
      { id },
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(500).json({ error: "Failed to update note" });
    }

    res.json({
      success: true,
      message: "Password set successfully",
    });
  } catch (error) {
    logger.error("Error setting password:", error);
    res.status(500).json({ error: "Server error while setting password" });
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

  try {
    const note = await Note.findOne({ id });

    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    const match = await comparePassword(password, note.password);
    if (!match) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    res.json({
      id: note.id,
      content: note.content,
      passwordProtected: true,
      unlocked: true,
    });
  } catch (error) {
    logger.error("Error unlocking note:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Note stats - admin only route
app.get("/api/stats", async (req, res) => {
  // This should have proper authentication in production
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const total = await Note.countDocuments();
    const protected = await Note.countDocuments({ password: { $ne: null } });

    res.json({ total, protected });
  } catch (error) {
    logger.error("Error fetching stats:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Cleanup expired notes (could be run as a cron job)
app.post("/api/maintenance/cleanup", async (req, res) => {
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await Note.deleteMany({
      createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    });

    res.json({
      success: true,
      deleted: result.deletedCount,
    });
  } catch (error) {
    logger.error("Error cleaning up notes:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Add analytics endpoint
app.get("/api/notes/:id/analytics", async (req, res) => {
  const { id } = req.params;
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const note = await Note.findOne({ id });
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    const visits = await Visit.find({ noteId: id })
      .sort({ createdAt: -1 })
      .limit(100);

    const analytics = {
      totalVisits: note.visitCount,
      lastVisited: note.lastVisitedAt,
      recentVisits: visits.map((visit) => ({
        timestamp: visit.createdAt,
        action: visit.action,
        country: visit.country,
        city: visit.city,
        browser: visit.browser,
        os: visit.os,
        device: visit.device,
      })),
    };

    res.json(analytics);
  } catch (error) {
    logger.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Serve static files for all non-API routes
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
  logger.info("SIGTERM received, shutting down gracefully");
  mongoose.connection.close();
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

// Start server
const server = app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

// Run cleanup cron job every day at 4 AM
cron.schedule("0 4 * * *", async () => {
  try {
    const result = await Note.deleteMany({
      $or: [{ content: null }, { content: "" }],
    });
    logger.info(`Cronjob: Deleted ${result.deletedCount} empty notes at 4 AM`);
  } catch (error) {
    logger.error("Cronjob error deleting empty notes:", error);
  }
});

module.exports = app; // For testing
