import client from './client';
import type { UpdateParticipationData, Participation } from '../types';

export const updateMyParticipation = async (
  eventId: number,
  data: UpdateParticipationData
): Promise<Participation> => {
  const response = await client.patch(`/api/events/${eventId}/me`, data);
  return response.data;
};
