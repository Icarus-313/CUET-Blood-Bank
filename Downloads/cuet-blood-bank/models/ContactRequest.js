const mongoose = require('mongoose');

// Every time a receiver reveals a donor's contact details, we log it.
// This gives donors visibility (via their dashboard) into who asked for
// their contact info and why, and lets us rate-limit abuse.
const contactRequestSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', required: true },
    bloodRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    requesterName: { type: String, required: true, trim: true },
    requesterPhone: { type: String, required: true, trim: true },
    reason: { type: String, trim: true, default: '', maxlength: 300 },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

contactRequestSchema.index({ donor: 1, createdAt: -1 });

module.exports = mongoose.model('ContactRequest', contactRequestSchema);
