const mongoose = require('mongoose');
const { BLOOD_GROUPS } = require('../utils/constants');

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const bloodRequestSchema = new mongoose.Schema(
  {
    requesterName: { type: String, required: true, trim: true },
    requesterEmail: { type: String, trim: true, lowercase: true },
    requesterPhone: { type: String, required: true, trim: true },

    patientName: { type: String, trim: true, default: '' },
    bloodGroup: { type: String, required: true, enum: BLOOD_GROUPS },
    unitsNeeded: { type: Number, default: 1, min: 1 },
    hospital: { type: String, trim: true, default: '' },
    reason: { type: String, trim: true, default: '', maxlength: 500 },

    urgency: { type: String, enum: ['normal', 'urgent'], default: 'normal' },

    // Only store a point when the requester intentionally attaches GPS.
    location: { type: pointSchema, default: undefined },
    addressLabel: { type: String, trim: true, default: '' },

    status: { type: String, enum: ['open', 'fulfilled', 'cancelled'], default: 'open' },

    // Donors that were emailed for this request (urgent broadcast)
    notifiedDonors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Donor' }],
    notifiedAt: { type: Date },

    createdByDonor: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', default: null },
  },
  { timestamps: true }
);

bloodRequestSchema.index({ location: '2dsphere' });
bloodRequestSchema.index({ bloodGroup: 1, status: 1 });

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
