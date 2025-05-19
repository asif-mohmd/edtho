const mongoose = require('mongoose');

// Note Schema definition
const noteSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  content: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    default: null
  },
  visitCount: {
    type: Number,
    default: 0
  },
  lastVisitedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // This will add createdAt and updatedAt fields automatically
});

// Create indexes for better performance
noteSchema.index({ createdAt: -1 });
noteSchema.index({ lastVisitedAt: -1 });
noteSchema.index({ visitCount: -1 });

// Create and export the Note model
const Note = mongoose.model('Note', noteSchema);

module.exports = Note; 