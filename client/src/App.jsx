import { useCallback, useEffect, useMemo, useState } from 'react';
import ProfileSetup from './components/ProfileSetup.jsx';
import FilterBar from './components/FilterBar.jsx';
import EventForm from './components/EventForm.jsx';
import EventList from './components/EventList.jsx';
import EventMap from './components/EventMap.jsx';
import {
  createProfile as apiCreateProfile,
  fetchCategories,
  fetchEvents,
  createEvent as apiCreateEvent,
  joinEvent as apiJoinEvent
} from './api.js';

const LOCAL_STORAGE_KEY = 'eventBuddyProfile';
const EMPTY_DATE_RANGE = { start: '', end: '' };

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
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [joiningIds, setJoiningIds] = useState(new Set());
  const [newEventLocation, setNewEventLocation] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

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

  const handleCreateProfile = useCallback(async ({ name, email }) => {
    setCreatingProfile(true);
    setErrorMessage('');
    try {
      const created = await apiCreateProfile({ name, email });
      setProfile(created);
    } catch (error) {
      console.error('Profile creation failed', error);
      setErrorMessage('We could not create your profile. Please try again.');
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
    setNewEventLocation(null);
    setSelectedEventId(null);
    setJoiningIds(new Set());
    setErrorMessage('');
    setCreatingEvent(false);
    setCreatingProfile(false);
    setLoadingEvents(false);
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
        <ProfileSetup onCreateProfile={handleCreateProfile} loading={creatingProfile} />
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
              onChangeDateRange={setDateRange}
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
            />
          </main>
        </div>
      )}
    </div>
  );
}
