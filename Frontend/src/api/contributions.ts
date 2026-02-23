import client from './client';
import type { ContributionItem, CreateContributionData, PaginatedResponse } from '../types';

export const listContributions = async (
  eventId: number,
  params?: { page?: number }
): Promise<PaginatedResponse<ContributionItem>> => {
  const response = await client.get(`/api/events/${eventId}/contributions`, { params });
  return response.data;
};

export const createContribution = async (
  eventId: number,
  data: CreateContributionData
): Promise<ContributionItem> => {
  const response = await client.post(`/api/events/${eventId}/contributions`, data);
  return response.data;
};
