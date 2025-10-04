import { useEffect, useMemo, useState } from 'react';
import { createEventMessage, fetchEventMessages } from '../api.js';

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return '';
  }
  try {
    return new Date(timestamp).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch (error) {
    console.warn('Failed to format timestamp', error);
    return '';
  }
}

function normalizeMessages(responseMessages) {
  if (!Array.isArray(responseMessages)) {
    return [];
  }
  return responseMessages
    .filter((message) => message && typeof message === 'object')
    .sort((a, b) => {
      const aTime = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const bTime = typeof b.createdAt === 'number' ? b.createdAt : 0;
      return aTime - bTime;
    });
}

export default function EventDiscussion({ event, currentUserId, currentUserName }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [messageDraft, setMessageDraft] = useState('');

  const postingAs = useMemo(() => currentUserName || 'You', [currentUserName]);

  useEffect(() => {
    let ignore = false;
    if (!event?.id) {
      setMessages([]);
      setLoading(false);
      setError('');
      return () => {
        ignore = true;
      };
    }

    setLoading(true);
    setError('');
    setMessageDraft('');

    fetchEventMessages(event.id)
      .then(({ messages: responseMessages }) => {
        if (!ignore) {
          setMessages(normalizeMessages(responseMessages));
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Failed to load messages', err);
          setError('Unable to load messages for this event right now.');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [event?.id]);

  const disabled = !messageDraft.trim() || posting;

  const handleSubmit = async (submittedEvent) => {
    submittedEvent.preventDefault();
    const trimmed = messageDraft.trim();
    if (!trimmed || posting || !event?.id) {
      return;
    }

    setPosting(true);
    setError('');

    try {
      const { message } = await createEventMessage(event.id, {
        userId: currentUserId,
        content: trimmed
      });
      setMessages((prev) => {
        const next = prev.filter((existing) => existing?.id !== message.id);
        next.push(message);
        return normalizeMessages(next);
      });
      setMessageDraft('');
    } catch (err) {
      console.error('Failed to post message', err);
      const message = err?.message;
      if (message === 'message_too_long') {
        setError('Your message is too long. Please keep it under 500 characters.');
      } else if (message === 'message_required') {
        setError('Message cannot be empty.');
      } else if (message === 'event_not_found') {
        setError('This event is no longer available.');
      } else if (message === 'profile_not_found') {
        setError('We could not verify your profile. Please sign in again.');
      } else {
        setError('We could not post your message. Please try again.');
      }
    } finally {
      setPosting(false);
    }
  };

  if (!event?.id) {
    return null;
  }

  return (
    <div className="card event-discussion">
      <div className="event-discussion-header">
        <div>
          <h3>Event chat</h3>
          <p className="muted">Share updates and coordinate with everyone attending.</p>
        </div>
        <span className="muted posting-as">Posting as {postingAs}</span>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <div className="loading">Loading messages…</div>
      ) : messages.length ? (
        <ul className="message-list">
          {messages.map((message) => (
            <li key={message.id} className="message-item">
              <div className="message-meta">
                <strong className="message-author">{message.userName || 'Event buddy'}</strong>
                {message.createdAt && (
                  <span className="message-timestamp">{formatTimestamp(message.createdAt)}</span>
                )}
              </div>
              <p className="message-content">{message.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No messages yet. Be the first to say hello!</p>
      )}

      <form className="message-form" onSubmit={handleSubmit}>
        <label htmlFor="event-message-input">
          Add a message
          <textarea
            id="event-message-input"
            className="message-input"
            rows={3}
            maxLength={500}
            value={messageDraft}
            onChange={(evt) => setMessageDraft(evt.target.value)}
            placeholder="Share plans, ride info, or a quick hello"
          />
        </label>
        <div className="message-form-actions">
          <span className="muted remaining-characters">{500 - messageDraft.length} characters left</span>
          <button type="submit" disabled={disabled}>
            {posting ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>
    </div>
  );
}
