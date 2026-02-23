import client, { setAccessToken, setRefreshToken } from './client';
import type { LoginData, RegisterData, AuthTokens, User } from '../types';

export const register = async (data: RegisterData): Promise<User> => {
  const response = await client.post('/api/auth/register', data);
  return response.data;
};

export const login = async (data: LoginData): Promise<AuthTokens> => {
  const response = await client.post('/api/auth/token', data);
  const tokens: AuthTokens = response.data;
  
  // Store tokens
  setAccessToken(tokens.access);
  setRefreshToken(tokens.refresh);
  
  return tokens;
};

export const refreshToken = async (refresh: string): Promise<string> => {
  const response = await client.post('/api/auth/token/refresh', { refresh });
  const newAccessToken = response.data.access;
  setAccessToken(newAccessToken);
  return newAccessToken;
};
