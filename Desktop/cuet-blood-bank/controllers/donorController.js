const Donor = require('../models/Donor');
const ContactRequest = require('../models/ContactRequest');
const { compatibleDonorGroups } = require('../utils/constants');

const DEFAULT_RADIUS_KM = Number(process.env.DEFAULT_SEARCH_RADIUS_KM || 10);

function hasValidCoordinates(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

exports.dashboard = async (req, res) => {
  const recentContactRequests = await ContactRequest.find({ donor: req.donor._id })
    .sort({ createdAt: -1 })
    .limit(10);
  res.render('dashboard', {
    title: 'My Dashboard',
    donor: req.donor,
    recentContactRequests,
    welcome: req.query.welcome === '1',
  });
};

exports.showEditProfile = (req, res) => {
  res.render('edit-profile', { title: 'Edit Profile', donor: req.donor, bloodGroups: Donor.BLOOD_GROUPS, errors: [] });
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, bloodGroup, department, batch, addressLabel } = req.body;
    req.donor.name = name || req.donor.name;
    req.donor.phone = phone || req.donor.phone;
    req.donor.bloodGroup = bloodGroup || req.donor.bloodGroup;
    req.donor.department = department || '';
    req.donor.batch = batch || '';
    req.donor.addressLabel = addressLabel || '';
    await req.donor.save();
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).render('edit-profile', {
      title: 'Edit Profile',
      donor: req.donor,
      bloodGroups: Donor.BLOOD_GROUPS,
      errors: ['Could not update profile. Please check your inputs.'],
    });
  }
};

// Records that a donor just gave blood "today" (or a chosen date) — resets
// their 90-day eligibility clock automatically via Donor.isEligible().
exports.recordDonation = async (req, res) => {
  const date = req.body.date ? new Date(req.body.date) : new Date();
  req.donor.lastDonationDate = date;
  await req.donor.save();
  res.redirect('/dashboard');
};

exports.toggleAvailability = async (req, res) => {
  req.donor.available = !req.donor.available;
  await req.donor.save();
  res.redirect('/dashboard');
};

// Called from the browser's Geolocation API (navigator.geolocation) whenever
// the donor opts in to share live location. Keeps donor.location current so
// "nearest donor" search and urgent-alert emails stay accurate.
exports.updateLocation = async (req, res) => {
  const { lat, lng } = req.body;
  if (!hasValidCoordinates(lat, lng)) {
    return res.status(400).json({ error: 'A valid latitude and longitude are required.' });
  }
  req.donor.location = { type: 'Point', coordinates: [lng, lat] };
  req.donor.locationUpdatedAt = new Date();
  await req.donor.save();
  res.json({ ok: true, locationUpdatedAt: req.donor.locationUpdatedAt });
};

// Shared query logic used by both the server-rendered search page and the
// JSON API (used for "search near me" AJAX calls from the browser).
async function runDonorSearch({ bloodGroup, lat, lng, radiusKm, onlyAvailable }) {
  const filter = {};
  // A recipient can receive from more than their exact blood group. Surface
  // compatible donors too, while marking direct matches in the UI.
  if (bloodGroup) filter.bloodGroup = { $in: compatibleDonorGroups(bloodGroup) };
  if (onlyAvailable) filter.available = true;

  let results = [];
  const hasCoords = hasValidCoordinates(lat, lng);

  if (hasCoords) {
    const radiusMeters = (Number(radiusKm) || DEFAULT_RADIUS_KM) * 1000;
    results = await Donor.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          distanceField: 'distanceMeters',
          maxDistance: radiusMeters,
          spherical: true,
          query: filter,
        },
      },
      { $limit: 50 },
    ]);
  } else {
    results = await Donor.find(filter).limit(50).lean();
  }

  const now = Date.now();
  const minDays = Number(process.env.DONATION_ELIGIBILITY_DAYS || 90);
  return results.map((d) => ({
    id: d._id,
    name: d.name,
    bloodGroup: d.bloodGroup,
    isDirectMatch: d.bloodGroup === bloodGroup,
    department: d.department,
    batch: d.batch,
    addressLabel: d.addressLabel,
    available: d.available,
    eligible: !d.lastDonationDate
      ? true
      : (now - new Date(d.lastDonationDate).getTime()) / 86400000 >= minDays,
    distanceKm: typeof d.distanceMeters === 'number' ? (d.distanceMeters / 1000).toFixed(1) : null,
  }));
}

// Full-page search (works without JS — plain GET query string form submit).
exports.search = async (req, res) => {
  const { bloodGroup, lat, lng, radiusKm, onlyAvailable } = req.query;
  const results = await runDonorSearch({ bloodGroup, lat, lng, radiusKm, onlyAvailable });
  res.render('search', {
    title: 'Find Blood',
    bloodGroups: Donor.BLOOD_GROUPS,
    results,
    query: { bloodGroup, lat, lng, radiusKm: radiusKm || DEFAULT_RADIUS_KM, onlyAvailable },
  });
};

// JSON API version — used by the "Use my location" button for a faster,
// no-reload search once the browser has GPS coordinates.
exports.searchApi = async (req, res) => {
  const { bloodGroup, lat, lng, radiusKm, onlyAvailable } = req.query;
  const results = await runDonorSearch({ bloodGroup, lat, lng, radiusKm, onlyAvailable });
  res.json({ results });
};

// Reveal a donor's phone/email to a receiver in an urgent case, and log it
// so the donor can see who requested their contact (transparency + abuse trace).
exports.requestContact = async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ error: 'Donor not found.' });

    const { requesterName, requesterPhone, reason } = req.body;
    if (!requesterName || !requesterPhone || !reason) {
      return res.status(400).json({ error: 'Your name, phone number, and a short reason are required.' });
    }

    await ContactRequest.create({
      donor: donor._id,
      requesterName,
      requesterPhone,
      reason: reason || '',
      ip: req.ip,
    });
    donor.contactRequestCount += 1;
    await donor.save();

    res.json({
      ok: true,
      contact: { name: donor.name, phone: donor.phone, email: donor.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch contact details.' });
  }
};
