import client from './client';
import type { Event, CreateEventData, UpdateEventData, PaginatedResponse, Participation } from '../types';

const normalizeParticipantsResponse = (payload: unknown): PaginatedResponse<Participation> => {
  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: undefined,
      previous: undefined,
      results: payload as Participation[],
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      count: 0,
      next: undefined,
      previous: undefined,
      results: [],
    };
  }

  const data = payload as {
    count?: unknown;
    next?: unknown;
    previous?: unknown;
    results?: unknown;
  };

  const results = Array.isArray(data.results) ? (data.results as Participation[]) : [];
  const count = typeof data.count === 'number' ? data.count : results.length;

  return {
    count,
    next: typeof data.next === 'string' ? data.next : undefined,
    previous: typeof data.previous === 'string' ? data.previous : undefined,
    results,
  };
};

export const listEvents = async (params?: {
  search?: string;
  location?: string;
  starts_at?: string;
  page?: number;
}): Promise<PaginatedResponse<Event>> => {
  const response = await client.get('/api/events', { params });
  return response.data;
};

export const createEvent = async (data: CreateEventData): Promise<Event> => {
  const response = await client.post('/api/events', data);
  return response.data;
};

export const getEvent = async (id: number): Promise<Event> => {
  const response = await client.get(`/api/events/${id}`);
  return response.data;
};

export const updateEvent = async (id: number, data: UpdateEventData): Promise<Event> => {
  const response = await client.patch(`/api/events/${id}`, data);
  return response.data;
};

export const getParticipants = async (
  id: number,
  params?: { rsvp_status?: string; page?: number }
): Promise<PaginatedResponse<Participation>> => {
  const response = await client.get(`/api/events/${id}/participants`, { params });
  return normalizeParticipantsResponse(response.data);
};
