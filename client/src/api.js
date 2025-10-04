const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function handleResponse(response) {
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorBody = await response.json();
      const message = errorBody.error || errorBody.message || 'Request failed';
      const error = new Error(message);
      error.details = errorBody.details;
      throw error;
    }
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchCategories() {
  const res = await fetch(buildUrl('/api/categories'));
  return handleResponse(res);
}

export async function registerProfile({ name, email, password }) {
  const res = await fetch(buildUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  return handleResponse(res);
}

export async function login({ email, password }) {
  const res = await fetch(buildUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(res);
}

export async function updateProfile(profileId, updates) {
  const res = await fetch(buildUrl(`/api/profiles/${profileId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return handleResponse(res);
}

export async function fetchEvents({ categories = [], start = '', end = '' } = {}) {
  const params = new URLSearchParams();
  if (categories.length) {
    params.append('categories', categories.join(','));
  }
  if (start) {
    params.append('start', start);
  }
  if (end) {
    params.append('end', end);
  }

  const query = params.toString();
  const res = await fetch(buildUrl(`/api/events${query ? `?${query}` : ''}`));
  return handleResponse(res);
}

export async function createEvent(event) {
  const res = await fetch(buildUrl('/api/events'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  return handleResponse(res);
}

export async function joinEvent(eventId, userId) {
  const res = await fetch(buildUrl(`/api/events/${eventId}/join`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  return handleResponse(res);
}

export async function fetchEventMessages(eventId) {
  if (!eventId) {
    throw new Error('eventId is required');
  }
  const res = await fetch(buildUrl(`/api/events/${eventId}/messages`));
  return handleResponse(res);
}

export async function createEventMessage(eventId, { userId, content }) {
  if (!eventId) {
    throw new Error('eventId is required');
  }
  const res = await fetch(buildUrl(`/api/events/${eventId}/messages`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, content })
  });
  return handleResponse(res);
}
