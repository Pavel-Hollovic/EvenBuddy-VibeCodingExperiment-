import { useCallback, useEffect, useMemo, useState } from 'react';
import ProfileSetup from './components/ProfileSetup.jsx';
import FilterBar from './components/FilterBar.jsx';
import EventForm from './components/EventForm.jsx';
import EventList from './components/EventList.jsx';
import EventMap from './components/EventMap.jsx';
import EventDetailsModal from './components/EventDetailsModal.jsx';
import {
  registerProfile as apiRegisterProfile,
  login as apiLogin,
  fetchCategories,
  fetchEvents,
  createEvent as apiCreateEvent,
  joinEvent as apiJoinEvent
} from './api.js';

const LOCAL_STORAGE_KEY = 'eventBuddyProfile';
const EMPTY_DATE_RANGE = { start: '', end: '' };

const TIME_FILTERS = [
  { value: 'tonight', label: 'Tonight' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'This Weekend' }
];

function toLocalInputValue(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  ].join('T');
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 0, 0);
  return copy;
}

function getDateRangeForPreset(preset, reference = new Date()) {
  const now = new Date(reference);
  now.setSeconds(0, 0);

  if (preset === 'tonight') {
    const eveningStart = new Date(now);
    eveningStart.setHours(18, 0, 0, 0);
    const startDate = now < eveningStart ? eveningStart : new Date(now);
    const endDate = endOfDay(now);
    if (startDate > endDate) {
      const tomorrowEvening = new Date(now);
      tomorrowEvening.setDate(now.getDate() + 1);
      tomorrowEvening.setHours(18, 0, 0, 0);
      const tomorrowEnd = endOfDay(tomorrowEvening);
      return {
        start: toLocalInputValue(tomorrowEvening),
        end: toLocalInputValue(tomorrowEnd)
      };
    }

    return {
      start: toLocalInputValue(startDate),
      end: toLocalInputValue(endDate)
    };
  }

  if (preset === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const startDate = startOfDay(tomorrow);
    const endDate = endOfDay(tomorrow);
    return {
      start: toLocalInputValue(startDate),
      end: toLocalInputValue(endDate)
    };
  }

  if (preset === 'weekend') {
    const day = now.getDay();
    const saturday = new Date(now);

    if (day === 6) {
      saturday.setHours(0, 0, 0, 0);
    } else if (day === 0) {
      saturday.setDate(now.getDate() - 1);
      saturday.setHours(0, 0, 0, 0);
    } else {
      const daysUntilSaturday = 6 - day;
      saturday.setDate(now.getDate() + daysUntilSaturday);
      saturday.setHours(0, 0, 0, 0);
    }

    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);

    return {
      start: toLocalInputValue(startOfDay(saturday)),
      end: toLocalInputValue(endOfDay(sunday))
    };
  }

  return { ...EMPTY_DATE_RANGE };
}

function loadStoredProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed.email !== 'string') {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to load profile from storage', error);
    return null;
  }
}

function storeProfile(profile) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn('Failed to persist profile', error);
  }
}

function clearProfile() {
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear profile', error);
  }
}

function toIsoOrEmpty(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString();
}

export default function App() {
  const [profile, setProfile] = useState(() => loadStoredProfile());
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [dateRange, setDateRange] = useState(EMPTY_DATE_RANGE);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [joiningIds, setJoiningIds] = useState(new Set());
  const [newEventLocation, setNewEventLocation] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailsEventId, setDetailsEventId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { categories: fetchedCategories } = await fetchCategories();
        if (!cancelled) {
          setCategories(fetchedCategories);
        }
      } catch (error) {
        console.error('Failed to load categories', error);
        if (!cancelled) {
          setErrorMessage('Unable to load categories right now.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshEvents = useCallback(async () => {
    setLoadingEvents(true);
    setErrorMessage('');
    try {
      const { events: fetchedEvents } = await fetchEvents({
        categories: Array.from(selectedCategories),
        start: toIsoOrEmpty(dateRange.start),
        end: toIsoOrEmpty(dateRange.end)
      });
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('Failed to load events', error);
      setErrorMessage('Unable to load events. Please try again.');
    } finally {
      setLoadingEvents(false);
    }
  }, [selectedCategories, dateRange]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  useEffect(() => {
    if (profile) {
      storeProfile(profile);
    } else {
      clearProfile();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedEventId && !events.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
    if (detailsEventId && !events.some((event) => event.id === detailsEventId)) {
      setDetailsEventId(null);
    }
  }, [events, selectedEventId, detailsEventId]);

  const handleAuth = useCallback(async ({ mode, name, email, password }) => {
    setCreatingProfile(true);
    setErrorMessage('');
    try {
      const profile =
        mode === 'register'
          ? await apiRegisterProfile({ name, email, password })
          : await apiLogin({ email, password });
      setProfile(profile);
    } catch (error) {
      console.error('Authentication failed', error);
      const message = error?.message || '';
      if (message === 'email_already_registered') {
        setErrorMessage('An account with that email already exists. Try signing in instead.');
      } else if (message === 'invalid_credentials') {
        setErrorMessage('We could not sign you in. Check your email and password.');
      } else if (message === 'validation_error') {
        setErrorMessage('Please double-check the information you entered.');
      } else {
        setErrorMessage('We could not process your request. Please try again.');
      }
    } finally {
      setCreatingProfile(false);
    }
  }, []);

  const handleToggleCategory = (category) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSelectTimeFilter = useCallback((filterValue) => {
    setSelectedTimeFilter((prev) => {
      const next = prev === filterValue ? null : filterValue;
      const range = next ? getDateRangeForPreset(next) : { ...EMPTY_DATE_RANGE };
      setDateRange(range);
      return next;
    });
  }, []);

  const handleChangeDateRange = useCallback((nextRange) => {
    setSelectedTimeFilter(null);
    setDateRange(nextRange);
  }, []);

  const handleCreateEvent = useCallback(
    async ({ name, category, dateTime, location }) => {
      if (!profile) {
        setErrorMessage('Create your profile before hosting an event.');
        return false;
      }
      setCreatingEvent(true);
      setErrorMessage('');
      let success = false;
      try {
        const payload = {
          name,
          category,
          dateTime: toIsoOrEmpty(dateTime),
          location,
          creatorUserId: profile.id
        };
        await apiCreateEvent(payload);
        setNewEventLocation(null);
        await refreshEvents();
        success = true;
      } catch (error) {
        console.error('Failed to create event', error);
        setErrorMessage('We could not save your event. Please check the details and try again.');
      } finally {
        setCreatingEvent(false);
      }
      return success;
    },
    [profile, refreshEvents]
  );

  const handleJoinEvent = useCallback(
    async (eventId) => {
      if (!profile) {
        setErrorMessage('Create your profile before joining events.');
        return;
      }
      setJoiningIds((prev) => {
        const next = new Set(prev);
        next.add(eventId);
        return next;
      });
      try {
        await apiJoinEvent(eventId, profile.id);
        await refreshEvents();
      } catch (error) {
        console.error('Failed to join event', error);
        setErrorMessage('Joining failed. Please try again.');
      } finally {
        setJoiningIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }
    },
    [profile, refreshEvents]
  );

  const handleMapClick = (location) => {
    setNewEventLocation(location);
    setSelectedEventId(null);
    setDetailsEventId(null);
  };

  const heroCopy = useMemo(() => {
    if (profile) {
      return `Welcome back, ${profile.name.split(' ')[0]}!`;
    }
    return 'Discover events nearby and meet people who love what you love.';
  }, [profile]);

  const handleSignOut = useCallback(() => {
    setProfile(null);
    setEvents([]);
    setSelectedCategories(new Set());
    setDateRange({ ...EMPTY_DATE_RANGE });
    setSelectedTimeFilter(null);
    setNewEventLocation(null);
    setSelectedEventId(null);
    setDetailsEventId(null);
    setJoiningIds(new Set());
    setErrorMessage('');
    setCreatingEvent(false);
    setCreatingProfile(false);
    setLoadingEvents(false);
  }, []);

  const detailsEvent = useMemo(
    () => events.find((event) => event.id === detailsEventId) || null,
    [events, detailsEventId]
  );

  const handleShowEventDetails = useCallback(
    (eventId) => {
      setSelectedEventId(eventId);
      setDetailsEventId(eventId);
    },
    []
  );

  const handleCloseEventDetails = useCallback(() => {
    setDetailsEventId(null);
  }, []);

  return (
    <div className="app">
      <header>
        <div className="branding">
          <h1>Event Buddy</h1>
          <span className="tagline">Explore. Connect. Show up.</span>
        </div>
        <div className="header-actions">
          <p className="hero-copy">{heroCopy}</p>
          {profile && (
            <button type="button" className="sign-out-button" onClick={handleSignOut}>
              Sign out
            </button>
          )}
        </div>
      </header>

      {errorMessage && <div className="alert">{errorMessage}</div>}

      {!profile ? (
        <ProfileSetup onSubmit={handleAuth} loading={creatingProfile} />
      ) : (
        <div className="dashboard">
          <aside>
            <div className="card profile-summary">
              <h3>Your profile</h3>
              <p className="profile-name">{profile.name}</p>
              <p className="muted profile-email">{profile.email}</p>
              <p className="muted">Your name helps friends recognize you. Email keeps your events in sync.</p>
            </div>
            <FilterBar
              categories={categories}
              selectedCategories={selectedCategories}
              onToggleCategory={handleToggleCategory}
              dateRange={dateRange}
              onChangeDateRange={handleChangeDateRange}
              timeFilters={TIME_FILTERS}
              onSelectTimeFilter={handleSelectTimeFilter}
              selectedTimeFilter={selectedTimeFilter}
            />
            <EventForm
              categories={categories.length ? categories : ['Sport', 'Culture', 'Party']}
              onCreate={handleCreateEvent}
              creating={creatingEvent}
              selectedLocation={newEventLocation}
            />
          </aside>
          <main>
            {loadingEvents && <div className="loading">Loading events…</div>}
            <EventMap
              events={events}
              onMapClick={handleMapClick}
              newEventLocation={newEventLocation}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
              onJoin={handleJoinEvent}
              currentUserId={profile.id}
              joiningIds={joiningIds}
            />
            <EventList
              events={events}
              onJoin={handleJoinEvent}
              currentUserId={profile.id}
              joiningIds={joiningIds}
              onSelectEvent={setSelectedEventId}
              onShowDetails={handleShowEventDetails}
            />
          </main>
        </div>
      )}
      {detailsEvent && (
        <EventDetailsModal
          event={detailsEvent}
          onClose={handleCloseEventDetails}
          currentUserId={profile.id}
          currentUserName={profile.name}
        />
      )}
    </div>
  );
}
