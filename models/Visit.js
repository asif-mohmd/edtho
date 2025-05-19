const mongoose = require('mongoose');

// Visit Schema definition
const visitSchema = new mongoose.Schema({
  noteId: {
    type: String,
    required: true,
    ref: 'Note'
  },
  ip: {
    type: String,
    required: true
  },
  country: {
    type: String,
    default: 'Unknown'
  },
  city: {
    type: String,
    default: 'Unknown'
  },
  region: {
    type: String,
    default: 'Unknown'
  },
  userAgent: {
    type: String,
    default: 'Unknown'
  },
  browser: {
    type: String,
    default: 'Unknown'
  },
  os: {
    type: String,
    default: 'Unknown'
  },
  device: {
    type: String,
    default: 'Unknown'
  },
  action: {
    type: String,
    enum: ['view', 'edit', 'create', 'unlock'],
    required: true
  }
}, {
  timestamps: true
});

// Create indexes for better performance
visitSchema.index({ noteId: 1, createdAt: -1 });
visitSchema.index({ ip: 1 });
visitSchema.index({ country: 1 });
visitSchema.index({ createdAt: -1 });

// Create and export the Visit model
const Visit = mongoose.model('Visit', visitSchema);

module.exports = Visit; 