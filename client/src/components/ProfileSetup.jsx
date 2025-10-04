import { useState } from 'react';

const MODES = {
  register: {
    title: 'Create Your Profile',
    description: 'Event Buddy keeps it simple. Add your details so we can keep your events in sync.',
    button: 'Create account'
  },
  login: {
    title: 'Welcome back',
    description: 'Sign in with your email and password to pick up where you left off.',
    button: 'Sign in'
  }
};

export default function ProfileSetup({ onSubmit, loading }) {
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const toggleMode = () => {
    setMode((prev) => (prev === 'register' ? 'login' : 'register'));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mode === 'register' && !name.trim()) {
      setError('Please tell us your name to get started.');
      return;
    }
    if (!email.trim()) {
      setError('Add your email so we can save your progress.');
      return;
    }
    if (!password.trim()) {
      setError('Enter a password to continue.');
      return;
    }
    if (mode === 'register' && password.trim().length < 8) {
      setError('Choose a password that is at least 8 characters long.');
      return;
    }

    setError('');
    await onSubmit({
      mode,
      name: name.trim(),
      email: email.trim(),
      password: password.trim()
    });
  };

  const copy = MODES[mode];

  return (
    <div className="card profile-card">
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
      <form onSubmit={handleSubmit} className="profile-form">
        {mode === 'register' && (
          <>
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
          </>
        )}
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
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
          disabled={loading}
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? (mode === 'register' ? 'Creating…' : 'Signing in…') : copy.button}
        </button>
      </form>
      <button type="button" className="link-button" onClick={toggleMode} disabled={loading}>
        {mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
    </div>
  );
}
