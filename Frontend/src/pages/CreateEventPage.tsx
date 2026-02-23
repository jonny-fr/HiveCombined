import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvent } from '../api/events';
import Navbar from '../components/Navbar';

const CreateEventPage: React.FC = () => {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [dresscode, setDresscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const event = await createEvent({
        title,
        location,
        starts_at: startsAt,
        ends_at: endsAt || undefined,
        dresscode: dresscode || undefined,
      });
      navigate(`/events/${event.id}`);
    } catch (err) {
      setError('Failed to create event. Please try again.');
      console.error('Error creating event:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <h1>Create New Event</h1>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="location">Location *</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="startsAt">Starts At *</label>
            <input
              type="datetime-local"
              id="startsAt"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="endsAt">Ends At</label>
            <input
              type="datetime-local"
              id="endsAt"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="dresscode">Dresscode</label>
            <input
              type="text"
              id="dresscode"
              value={dresscode}
              onChange={(e) => setDresscode(e.target.value)}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </>
  );
};

export default CreateEventPage;
