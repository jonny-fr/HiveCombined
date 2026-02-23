import React, { useState, useEffect, useRef } from 'react';
import { sendInvites } from '../api/invitations';
import { SUCCESS_MESSAGE_DURATION_MS } from '../constants';

interface InviteFormProps {
  eventId: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const InviteForm: React.FC<InviteFormProps> = ({ eventId }) => {
  const [showForm, setShowForm] = useState(false);
  const [emails, setEmails] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSending, setIsSending] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSending(true);

    try {
      const data: Partial<{ emails: string[]; expires_in_hours: number }> = {};

      if (emails.trim()) {
        const parsed = emails.split(',').map(email => email.trim()).filter(email => email !== '');
        const invalid = parsed.filter(email => !EMAIL_REGEX.test(email));
        if (invalid.length > 0) {
          setError(`Invalid email address(es): ${invalid.join(', ')}`);
          setIsSending(false);
          return;
        }
        data.emails = parsed;
      }
      
      if (expiresInDays) {
        const days = Number(expiresInDays);
        if (!Number.isInteger(days) || days < 1) {
          setError('Expiry must be at least 1 day');
          setIsSending(false);
          return;
        }
        data.expires_in_hours = days * 24;
      }

      if (!data.emails?.length) {
        setError('Please provide at least one valid email');
        setIsSending(false);
        return;
      }

      await sendInvites(eventId, data);
      
      setSuccess('Invitations sent successfully!');
      setEmails('');
      setExpiresInDays('');

      successTimerRef.current = setTimeout(() => {
        setSuccess('');
        setShowForm(false);
      }, SUCCESS_MESSAGE_DURATION_MS);
    } catch (err) {
      setError('Failed to send invitations');
      console.error('Error sending invitations:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="invite-form">
      <div className="header-row">
        <h3>Send Invitations</h3>
        <button onClick={() => setShowForm(!showForm)} className="button">
          {showForm ? 'Cancel' : 'Invite People'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-container">
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <div className="form-group">
            <label htmlFor="emails">Email Addresses (comma-separated)</label>
            <textarea
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="user1@example.com, user2@example.com"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="expiresInDays">Expires in Days</label>
            <input
              type="number"
              id="expiresInDays"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="e.g., 7"
              min="1"
              step="1"
            />
          </div>

          <button type="submit" disabled={isSending}>
            {isSending ? 'Sending...' : 'Send Invitations'}
          </button>
        </form>
      )}
    </div>
  );
};

export default InviteForm;
