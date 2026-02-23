import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { respondToInvite } from '../api/invitations';
import Navbar from '../components/Navbar';

const InviteRespondPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResponse = async (status: 'accepted' | 'declined') => {
    if (!token) return;
    
    setIsLoading(true);
    setError('');

    try {
      await respondToInvite(token, { status });
      setSuccess(true);
      setTimeout(() => {
        navigate('/events');
      }, 2000);
    } catch (err) {
      setError('Failed to respond to invite. The link may be invalid or expired.');
      console.error('Error responding to invite:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <Navbar />
        <div className="page-container">
          <div className="success">
            Response recorded successfully! Redirecting to events...
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-container">
        <h1>Event Invitation</h1>
        <p>You have been invited to an event. Would you like to accept or decline?</p>
        {error && <div className="error">{error}</div>}
        <div className="button-group">
          <button
            onClick={() => handleResponse('accepted')}
            disabled={isLoading}
            className="button"
          >
            Accept
          </button>
          <button
            onClick={() => handleResponse('declined')}
            disabled={isLoading}
            className="button secondary"
          >
            Decline
          </button>
        </div>
      </div>
    </>
  );
};

export default InviteRespondPage;
