const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { BLOOD_GROUPS } = require('../utils/constants');

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const donorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, required: true, trim: true },
    bloodGroup: { type: String, required: true, enum: BLOOD_GROUPS },
    department: { type: String, trim: true, default: '' },
    batch: { type: String, trim: true, default: '' },
    addressLabel: { type: String, trim: true, default: '', maxlength: 200 }, // human-readable e.g. "Hall 4, CUET"

    // GeoJSON point — [longitude, latitude]. Powers "nearest donor" queries.
    // Absent until the donor explicitly shares it. A made-up [0, 0] point
    // would otherwise pollute proximity searches and imply false precision.
    location: { type: pointSchema, default: undefined },
    locationUpdatedAt: { type: Date },

    lastDonationDate: { type: Date, default: null },
    available: { type: Boolean, default: true }, // donor can pause visibility
    isVerified: { type: Boolean, default: true }, // reserved for future email-verification flow

    contactRequestCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

donorSchema.index({ location: '2dsphere' });
donorSchema.index({ bloodGroup: 1, available: 1 });

donorSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

donorSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// A donor is "eligible" if they've never donated, or enough days have passed
// since their last donation (default 90 days, configurable via .env).
donorSchema.methods.isEligible = function isEligible() {
  if (!this.lastDonationDate) return true;
  const minDays = Number(process.env.DONATION_ELIGIBILITY_DAYS || 90);
  const msSinceDonation = Date.now() - new Date(this.lastDonationDate).getTime();
  const daysSinceDonation = msSinceDonation / (1000 * 60 * 60 * 24);
  return daysSinceDonation >= minDays;
};

donorSchema.methods.nextEligibleDate = function nextEligibleDate() {
  if (!this.lastDonationDate) return null;
  const minDays = Number(process.env.DONATION_ELIGIBILITY_DAYS || 90);
  const d = new Date(this.lastDonationDate);
  d.setDate(d.getDate() + minDays);
  return d;
};

donorSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    bloodGroup: this.bloodGroup,
    department: this.department,
    batch: this.batch,
    addressLabel: this.addressLabel,
    available: this.available,
    eligible: this.isEligible(),
    nextEligibleDate: this.nextEligibleDate(),
    lastDonationDate: this.lastDonationDate,
  };
};

donorSchema.statics.BLOOD_GROUPS = BLOOD_GROUPS;

module.exports = mongoose.model('Donor', donorSchema);
