import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent } from '../api/events';
import type { Event } from '../types';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import ParticipantList from '../components/ParticipantList';
import ContributionList from '../components/ContributionList';
import PollList from '../components/PollList';
import CustomFieldList from '../components/CustomFieldList';
import InviteForm from '../components/InviteForm';

const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');


  const isOwner = event && user ? event.owner.id === user.id : false;

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        const data = await getEvent(Number(id));
        setEvent(data);
      } catch (err) {
        setError('Failed to load event');
        console.error('Error fetching event:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

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

  if (error || !event) {
    return (
      <>
        <Navbar />
        <div className="page-container">
          <div className="error">{error || 'Event not found'}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-container">
        {/* Header */}
        <div className="header-row mb-6">
          <h1>{event.title}</h1>
          {isOwner && (
            <button onClick={() => navigate(`/events/${event.id}/edit`)}>
              Event bearbeiten
            </button>
          )}
        </div>

        {/* Single large dynamic box containing all event information */}
        <div className="bg-[#1a1a2e] border-2 border-[#2d2d44] rounded-2xl p-4 sm:p-8 shadow-2xl shadow-purple-900/10 space-y-8">
          
          {/* Event Details Section */}
          <div>
            <h2 className="text-2xl font-semibold text-purple-400 mb-6 pb-3 border-b border-[#2d2d44]">
              Event Details
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-[#0f0f1a] border border-[#2d2d44] p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">Ort und Zeit</h3>
                <div className="space-y-3 text-gray-300">
                  <p><strong className="text-gray-200">Ort:</strong> {event.location}</p>
                  <p><strong className="text-gray-200">Beginn:</strong> {new Date(event.starts_at).toLocaleString('de-DE')}</p>
                  {event.ends_at && (
                    <p><strong className="text-gray-200">Ende:</strong> {new Date(event.ends_at).toLocaleString('de-DE')}</p>
                  )}
                </div>
              </div>
              <div className="bg-[#0f0f1a] border border-[#2d2d44] p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">Weitere Informationen</h3>
                <div className="space-y-3 text-gray-300">
                  {event.dresscode && <p><strong className="text-gray-200">Dresscode:</strong> {event.dresscode}</p>}
                  <p><strong className="text-gray-200">Organisiert von:</strong> {event.owner.username}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Participants Section - now includes inline editing for current user */}
          <div>
            <h2 className="text-2xl font-semibold text-purple-400 mb-6 pb-3 border-b border-[#2d2d44]">
              Teilnehmer
            </h2>
            {isOwner && <InviteForm eventId={event.id} />}
            <ParticipantList eventId={event.id} />
          </div>

          {/* Contributions Section */}
          <div>
            <h2 className="text-2xl font-semibold text-purple-400 mb-6 pb-3 border-b border-[#2d2d44]">
              Beiträge
            </h2>
            <ContributionList eventId={event.id} />
          </div>

          {/* Polls Section */}
          <div>
            <h2 className="text-2xl font-semibold text-purple-400 mb-6 pb-3 border-b border-[#2d2d44]">
              Umfragen
            </h2>
            <PollList eventId={event.id} isOwner={isOwner} />
          </div>

          {/* Custom Fields Section */}
          <div>
            <h2 className="text-2xl font-semibold text-purple-400 mb-6 pb-3 border-b border-[#2d2d44]">
              Benutzerdefinierte Felder
            </h2>
            <CustomFieldList eventId={event.id} isOwner={isOwner} />
          </div>
        </div>
      </div>
    </>
  );
};

export default EventDetailPage;
