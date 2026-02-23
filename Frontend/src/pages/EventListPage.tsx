import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listEvents } from '../api/events';
import type { Event } from '../types';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, DEBOUNCE_DELAY_MS } from '../constants';

const EventListPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (search) params.search = search;
      if (location) params.location = location;
      if (startsAt) params.starts_at = startsAt;

      const response = await listEvents(params);
      setEvents(response.results);
      setTotalCount(response.count);
    } catch (err) {
      setError('Failed to load events');
      console.error('Error fetching events:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, location, startsAt]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEvents();
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [fetchEvents]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setCurrentPage(1);
  };

  const handleStartsAtChange = (value: string) => {
    setStartsAt(value);
    setCurrentPage(1);
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="header-row">
          <h1>My Events</h1>
          <Link to="/events/new" className="button">Create Event</Link>
        </div>
        
        {error && <div className="error">{error}</div>}
        
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-gray-100 placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-dark-hover"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Filter by location..."
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-gray-100 placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-dark-hover"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="date"
              placeholder="Filter by start date..."
              value={startsAt}
              onChange={(e) => handleStartsAtChange(e.target.value)}
              className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-gray-100 placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-dark-hover"
            />
          </div>
        </div>
        
        {isLoading ? (
          <p className="loading text-center py-12">Loading events...</p>
        ) : (
          <>
            <div className="event-list">
              {events.length === 0 ? (
                <p>No events found. {search || location || startsAt ? 'Try adjusting your filters.' : 'Create your first event!'}</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="event-item">
                    <h3>
                      <Link to={`/events/${event.id}`}>{event.title}</Link>
                    </h3>
                    <p><strong>Location:</strong> {event.location}</p>
                    <p><strong>Starts:</strong> {new Date(event.starts_at).toLocaleString()}</p>
                    {event.ends_at && (
                      <p><strong>Ends:</strong> {new Date(event.ends_at).toLocaleString()}</p>
                    )}
                  </div>
                ))
              )}
            </div>
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </>
  );
};

export default EventListPage;
