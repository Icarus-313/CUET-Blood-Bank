const Donor = require('../models/Donor');
const BloodRequest = require('../models/BloodRequest');
const { sendEmail } = require('../utils/sendEmail');
const { compatibleDonorGroups } = require('../utils/constants');

const DEFAULT_RADIUS_KM = Number(process.env.DEFAULT_SEARCH_RADIUS_KM || 10);
const APP_NAME = process.env.APP_NAME || 'CUET Blood Bank';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function hasValidCoordinates(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

exports.showNewRequest = (req, res) => {
  res.render('new-request', { title: 'Request Blood', bloodGroups: Donor.BLOOD_GROUPS, errors: [], old: {} });
};

exports.createRequest = async (req, res) => {
  try {
    const {
      requesterName, requesterEmail, requesterPhone, patientName,
      bloodGroup, unitsNeeded, hospital, reason, urgency,
      lat, lng, addressLabel,
    } = req.body;

    if (!requesterName || !requesterPhone || !bloodGroup) {
      return res.status(400).render('new-request', {
        title: 'Request Blood',
        bloodGroups: Donor.BLOOD_GROUPS,
        errors: ['Name, phone, and blood group are required.'],
        old: req.body,
      });
    }

    const hasCoords = hasValidCoordinates(lat, lng);

    const bloodRequest = await BloodRequest.create({
      requesterName,
      requesterEmail,
      requesterPhone,
      patientName,
      bloodGroup,
      unitsNeeded: Number(unitsNeeded) || 1,
      hospital,
      reason,
      urgency: urgency === 'urgent' ? 'urgent' : 'normal',
      addressLabel,
      location: hasCoords
        ? { type: 'Point', coordinates: [Number(lng), Number(lat)] }
        : undefined,
      createdByDonor: req.donor ? req.donor._id : null,
    });

    let notifiedCount = 0;
    if (bloodRequest.urgency === 'urgent') {
      notifiedCount = await notifyNearbyDonors(bloodRequest, hasCoords);
    }

    res.render('request-created', {
      title: 'Request Submitted',
      bloodRequest,
      notifiedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('new-request', {
      title: 'Request Blood',
      bloodGroups: Donor.BLOOD_GROUPS,
      errors: ['Something went wrong submitting your request.'],
      old: req.body,
    });
  }
};

// Finds eligible, available donors with a compatible blood group near the
// request (or all compatible donors, if no location was supplied) and emails them.
async function notifyNearbyDonors(bloodRequest, hasCoords) {
  const filter = {
    bloodGroup: { $in: compatibleDonorGroups(bloodRequest.bloodGroup) },
    available: true,
  };

  let donors;
  if (hasCoords) {
    donors = await Donor.aggregate([
      {
        $geoNear: {
          near: bloodRequest.location,
          distanceField: 'distanceMeters',
          maxDistance: DEFAULT_RADIUS_KM * 1000 * 3, // widen radius for urgent broadcasts
          spherical: true,
          query: filter,
        },
      },
      { $limit: 100 },
    ]);
  } else {
    donors = await Donor.find(filter).limit(100).lean();
  }

  // Filter to donors who are actually eligible to donate right now.
  const minDays = Number(process.env.DONATION_ELIGIBILITY_DAYS || 90);
  const now = Date.now();
  const eligibleDonors = donors.filter((d) => {
    if (!d.lastDonationDate) return true;
    return (now - new Date(d.lastDonationDate).getTime()) / 86400000 >= minDays;
  });

  const emailPromises = eligibleDonors
    .filter((d) => d.email)
    .map((d) =>
      sendEmail({
        to: d.email,
        subject: `Urgent: ${bloodRequest.bloodGroup} blood needed near you — ${APP_NAME}`,
        html: buildUrgentRequestEmail(d, bloodRequest),
        text: buildUrgentRequestEmailText(d, bloodRequest),
      }).catch((err) => console.error(`Failed to email ${d.email}:`, err.message))
    );

  await Promise.all(emailPromises);

  bloodRequest.notifiedDonors = eligibleDonors.map((d) => d._id);
  bloodRequest.notifiedAt = new Date();
  await bloodRequest.save();

  return eligibleDonors.length;
}

function buildUrgentRequestEmail(donor, r) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto;">
      <h2 style="color:#b91c1c;">Urgent ${r.bloodGroup} blood request</h2>
      <p>Hi ${escapeHtml(donor.name)},</p>
      <p>Someone near you urgently needs <strong>${r.bloodGroup}</strong> blood
      (${r.unitsNeeded} unit${r.unitsNeeded > 1 ? 's' : ''}) and your <strong>${donor.bloodGroup}</strong> group is compatible.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px 4px 0;color:#555;">Hospital</td><td>${escapeHtml(r.hospital || 'Not specified')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;">Location</td><td>${escapeHtml(r.addressLabel || 'Not specified')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;">Contact</td><td>${escapeHtml(r.requesterName)} — ${escapeHtml(r.requesterPhone)}</td></tr>
      </table>
      <p>If you're able to help, please reach out directly using the contact above,
      or visit <a href="${APP_URL}/requests">${APP_URL}/requests</a> to see all open requests.</p>
      <p style="color:#777;font-size:12px;margin-top:24px;">
        You're receiving this because you're registered as a ${r.bloodGroup} donor on ${APP_NAME}.
        You can pause alerts anytime by marking yourself unavailable in your dashboard.
      </p>
    </div>
  `;
}

function buildUrgentRequestEmailText(donor, r) {
  return `Hi ${donor.name},

Someone near you urgently needs ${r.bloodGroup} blood (${r.unitsNeeded} unit(s)) and your ${donor.bloodGroup} group is compatible.

Hospital: ${r.hospital || 'Not specified'}
Location: ${r.addressLabel || 'Not specified'}
Contact: ${r.requesterName} - ${r.requesterPhone}

If you're able to help, please reach out directly, or visit ${APP_URL}/requests to see all open requests.

— ${APP_NAME}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

exports.listRequests = async (req, res) => {
  const requests = await BloodRequest.find({ status: 'open' }).sort({ urgency: -1, createdAt: -1 }).limit(100);
  res.render('requests', { title: 'Open Blood Requests', requests });
};

exports.markFulfilled = async (req, res) => {
  const r = await BloodRequest.findById(req.params.id);
  if (r) {
    r.status = 'fulfilled';
    await r.save();
  }
  res.redirect('/requests');
};
