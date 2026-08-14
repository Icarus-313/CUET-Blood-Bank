const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Donor groups that can safely donate red cells to each recipient group.
// Keeping this in one place makes search and urgent notifications agree.
const COMPATIBLE_DONOR_GROUPS = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': [...BLOOD_GROUPS],
};

function compatibleDonorGroups(recipientGroup) {
  return COMPATIBLE_DONOR_GROUPS[recipientGroup] || [];
}

module.exports = { BLOOD_GROUPS, COMPATIBLE_DONOR_GROUPS, compatibleDonorGroups };
