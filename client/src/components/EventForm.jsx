import { useEffect, useState } from 'react';

export default function EventForm({ categories, onCreate, creating, selectedLocation }) {
  const [form, setForm] = useState({
    name: '',
    category: categories[0] || 'Sport',
    dateTime: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      category: categories.includes(prev.category) ? prev.category : categories[0] || 'Sport'
    }));
  }, [categories]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedLocation) {
      setError('Tap the map to choose where your event happens.');
      return;
    }
    if (!form.name.trim()) {
      setError('Add an event name so others know what to expect.');
      return;
    }
    if (!form.dateTime) {
      setError('Pick a date and time for your event.');
      return;
    }

    setError('');
    const success = await onCreate({
      name: form.name.trim(),
      category: form.category,
      dateTime: form.dateTime,
      location: selectedLocation
    });
    if (success) {
      setForm({ name: '', category: categories[0] || 'Sport', dateTime: '' });
    }
  };

  return (
    <div className="card event-form">
      <h3>Create an Event</h3>
      <p>Click anywhere on the map to drop a pin, then fill in the details below.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Event name
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Pickup soccer at the park"
            disabled={creating}
            required
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(event) => updateField('category', event.target.value)}
            disabled={creating}
          >
            {categories.map((category) => (
              <option value={category} key={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date & time
          <input
            type="datetime-local"
            value={form.dateTime}
            onChange={(event) => updateField('dateTime', event.target.value)}
            disabled={creating}
            required
          />
        </label>
        <div className="location-preview">
          <span className="location-label">Location</span>
          {selectedLocation ? (
            <span>
              {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
            </span>
          ) : (
            <span className="muted">Tap the map to set location</span>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={creating}>
          {creating ? 'Saving…' : 'Save event'}
        </button>
      </form>
    </div>
  );
}
