const mongoose = require('mongoose');

// Job Log Schema definition (non-sensitive only)
const jobLogSchema = new mongoose.Schema({
  totalCount:{
    type: Number,
    required: true
  },
  jobName:{
    type: String,
    index: true,
  }
}, {
  timestamps: true
});

// Index for analytics/performance
jobLogSchema.index({ jobName: 1, createdAt: -1 });

// Create and export the Visit model
const JobLog = mongoose.model('JobLog', jobLogSchema);

module.exports = JobLog;
