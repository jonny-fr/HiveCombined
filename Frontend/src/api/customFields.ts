import client from './client';
import type { CustomFieldDefinition, CreateCustomFieldData, PaginatedResponse } from '../types';

export const listCustomFields = async (
  eventId: number,
  params?: { page?: number }
): Promise<PaginatedResponse<CustomFieldDefinition>> => {
  const response = await client.get(`/api/events/${eventId}/custom-fields`, { params });
  return response.data;
};

export const createCustomField = async (
  eventId: number,
  data: CreateCustomFieldData
): Promise<CustomFieldDefinition> => {
  const response = await client.post(`/api/events/${eventId}/custom-fields`, data);
  return response.data;
};
