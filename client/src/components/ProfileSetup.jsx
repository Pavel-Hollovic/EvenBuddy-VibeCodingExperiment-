import { useState } from 'react';

export default function ProfileSetup({ onCreateProfile, loading }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Please tell us your name to get started.');
      return;
    }
    if (!email.trim()) {
      setError('Add your email so we can save your progress.');
      return;
    }
    setError('');
    await onCreateProfile({ name: name.trim(), email: email.trim() });
  };

  return (
    <div className="card profile-card">
      <h2>Create Your Profile</h2>
      <p>Event Buddy keeps it simple. Add your name and email so we can keep your events in sync.</p>
      <form onSubmit={handleSubmit} className="profile-form">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Adventurer"
          disabled={loading}
          required
        />
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="alex@example.com"
          disabled={loading}
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
