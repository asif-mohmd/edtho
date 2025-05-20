const mongoose = require('mongoose');

// Visit Schema definition (non-sensitive only)
const visitSchema = new mongoose.Schema({
  noteId: {
    type: String,
    required: true,
    ref: 'Note'
  },
  action: {
    type: String,
    enum: ['view', 'edit', 'create', 'unlock'],
    required: true
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  language: {
    type: String,
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Index for analytics/performance
visitSchema.index({ noteId: 1, createdAt: -1 });

// Create and export the Visit model
const Visit = mongoose.model('Visit', visitSchema);

module.exports = Visit;
