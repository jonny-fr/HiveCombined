import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, updateEvent } from '../api/events';
import type { Event } from '../types';
import Navbar from '../components/Navbar';

const EditEventPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [event, setEvent] = useState<Event | null>(null);
  
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [dresscode, setDresscode] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        const data = await getEvent(Number(id));
        setEvent(data);
        setTitle(data.title);
        setLocation(data.location);
        setStartsAt(data.starts_at.slice(0, 16)); // Format for datetime-local
        setEndsAt(data.ends_at ? data.ends_at.slice(0, 16) : '');
        setDresscode(data.dresscode || '');
      } catch (err) {
        setError('Failed to load event');
        console.error('Error fetching event:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    setError('');
    setIsSaving(true);

    try {
      await updateEvent(Number(id), {
        title,
        location,
        starts_at: startsAt,
        ends_at: endsAt || undefined,
        dresscode: dresscode || undefined,
      });
      navigate(`/events/${id}`);
    } catch (err) {
      setError('Failed to update event');
      console.error('Error updating event:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="page-container">
          <p className="loading text-center py-12">Loading event...</p>
        </div>
      </>
    );
  }

  if (error && !event) {
    return (
      <>
        <Navbar />
        <div className="page-container">
          <div className="error">{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-container">
        <h1>Edit Event</h1>
        <form onSubmit={handleSubmit} className="form-container">
          {error && <div className="error">{error}</div>}
          
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

          <div className="button-group">
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate(`/events/${id}`)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default EditEventPage;
