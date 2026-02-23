import client from './client';
import type { SendInvitesData, InviteResponseData } from '../types';

export const sendInvites = async (eventId: number, data: SendInvitesData): Promise<void> => {
  await client.post(`/api/events/${eventId}/invites`, data);
};

export const respondToInvite = async (token: string, data: InviteResponseData): Promise<void> => {
  await client.post(`/api/invites/${token}/respond`, data);
};
