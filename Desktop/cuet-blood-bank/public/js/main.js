// ---------- Donor dashboard: share live GPS location ----------
(function shareLocationOnDashboard() {
  const btn = document.querySelector('[data-share-location]');
  if (!btn) return;
  const statusEl = document.querySelector('[data-location-status]');

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      statusEl.textContent = 'Your browser does not support location sharing.';
      return;
    }
    btn.disabled = true;
    statusEl.textContent = 'Requesting location…';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch('/api/donors/me/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
          const data = await res.json();
          if (data.ok) {
            statusEl.textContent = 'Location updated just now.';
            statusEl.classList.add('ok');
          } else {
            statusEl.textContent = data.error || 'Could not update location.';
          }
        } catch (err) {
          statusEl.textContent = 'Network error updating location.';
        } finally {
          btn.disabled = false;
        }
      },
      (err) => {
        statusEl.textContent = 'Location permission denied or unavailable.';
        btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
})();

// ---------- Search page: "use my location" button ----------
(function useMyLocationOnSearch() {
  const btn = document.querySelector('[data-use-my-location]');
  if (!btn) return;
  const latInput = document.querySelector('#lat');
  const lngInput = document.querySelector('#lng');
  const statusEl = document.querySelector('[data-search-location-status]');

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      statusEl.textContent = 'Location is not supported in this browser.';
      return;
    }
    statusEl.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latInput.value = pos.coords.latitude;
        lngInput.value = pos.coords.longitude;
        statusEl.textContent = 'Location captured — search updated below.';
        statusEl.classList.add('ok');
        btn.closest('form').submit();
      },
      () => {
        statusEl.textContent = 'Could not get your location. You can still search by blood group.';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
})();

// ---------- New request page: capture patient/receiver location ----------
(function captureRequestLocation() {
  const btn = document.querySelector('[data-capture-request-location]');
  if (!btn) return;
  const latInput = document.querySelector('#req-lat');
  const lngInput = document.querySelector('#req-lng');
  const statusEl = document.querySelector('[data-request-location-status]');

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      statusEl.textContent = 'Location is not supported in this browser.';
      return;
    }
    statusEl.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latInput.value = pos.coords.latitude;
        lngInput.value = pos.coords.longitude;
        statusEl.textContent = 'Location attached to this request.';
        statusEl.classList.add('ok');
      },
      () => {
        statusEl.textContent = 'Could not get location — you can still submit without it.';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
})();

// ---------- Search results: privacy-aware donor contact request ----------
(() => {
  const dialog = document.querySelector('[data-contact-dialog]');
  const form = document.querySelector('[data-contact-form]');
  if (!dialog || !form) return;

  let activeCard;
  const statusEl = document.querySelector('[data-contact-status]');
  const submitButton = document.querySelector('[data-contact-submit]');

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-reveal-contact]');
    if (!trigger) return;
    activeCard = trigger.closest('[data-donor-card]');
    statusEl.textContent = '';
    form.reset();
    dialog.showModal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeCard) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Requesting…';
    statusEl.textContent = '';

    try {
      const formData = new FormData(form);
      const res = await fetch(`/api/donors/${activeCard.dataset.donorId}/request-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Could not fetch contact details.');

      const resultBox = activeCard.querySelector('[data-contact-result]');
      resultBox.hidden = false;
      resultBox.textContent = `${data.contact.name} — ${data.contact.phone} — ${data.contact.email}`;
      activeCard.querySelector('[data-reveal-contact]').remove();
      dialog.close();
    } catch (error) {
      statusEl.textContent = error.message || 'Network error. Please try again.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Request contact details';
    }
  });
})();
