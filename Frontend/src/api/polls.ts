import client from './client';
import type {
  Poll,
  CreatePollData,
  VoteData,
  VoteResponse,
  PollResults,
  PollResultOption,
  PaginatedResponse,
} from '../types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const toBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const toString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const isDefinedOption = (
  option: PollResultOption | null
): option is PollResultOption => option !== null;

const normalizeCurrentOption = (value: unknown): PollResultOption | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = toNumber(value.id);
  const label = toString(value.label);
  const voteCount = toNumber(value.vote_count);

  if (id === null || label === null || voteCount === null) {
    return null;
  }

  return {
    id,
    label,
    vote_count: Math.max(0, voteCount),
  };
};

const normalizeLegacyOption = (value: unknown): PollResultOption | null => {
  if (!isRecord(value) || !isRecord(value.option)) {
    return null;
  }

  const option = value.option;
  const id = toNumber(option.id);
  const label = toString(option.label);
  const voteCount = toNumber(value.vote_count);

  if (id === null || label === null || voteCount === null) {
    return null;
  }

  return {
    id,
    label,
    vote_count: Math.max(0, voteCount),
  };
};

const normalizePollResults = (payload: unknown): PollResults => {
  if (!isRecord(payload)) {
    throw new Error('Unexpected poll results format');
  }

  // Current backend format:
  // { poll_id, question, allows_multiple, total_votes, unique_voters, options[] }
  if (Array.isArray(payload.options)) {
    const pollId = toNumber(payload.poll_id);
    const totalVotes = toNumber(payload.total_votes);
    const question = toString(payload.question) ?? 'Poll results';
    const allowsMultiple = toBoolean(payload.allows_multiple) ?? false;
    const uniqueVoters = toNumber(payload.unique_voters);
    const options = payload.options
      .map(normalizeCurrentOption)
      .filter(isDefinedOption);

    if (pollId !== null && totalVotes !== null) {
      return {
        poll_id: pollId,
        question,
        allows_multiple: allowsMultiple,
        total_votes: Math.max(0, totalVotes),
        unique_voters: Math.max(0, uniqueVoters ?? totalVotes),
        options,
      };
    }
  }

  // Legacy frontend format:
  // { poll: {...}, total_votes, results: [{ option: {...}, vote_count }] }
  if (isRecord(payload.poll) && Array.isArray(payload.results)) {
    const pollId = toNumber(payload.poll.id);
    const question = toString(payload.poll.question) ?? 'Poll results';
    const allowsMultiple = toBoolean(payload.poll.allows_multiple) ?? false;
    const totalVotesFromPayload = toNumber(payload.total_votes);
    const options = payload.results.map(normalizeLegacyOption).filter(isDefinedOption);
    const totalVotesFromOptions = options.reduce((sum, option) => sum + option.vote_count, 0);
    const totalVotes = totalVotesFromPayload ?? totalVotesFromOptions;

    if (pollId !== null) {
      return {
        poll_id: pollId,
        question,
        allows_multiple: allowsMultiple,
        total_votes: Math.max(0, totalVotes),
        unique_voters: Math.max(0, totalVotes),
        options,
      };
    }
  }

  throw new Error('Unexpected poll results format');
};

export const listPolls = async (
  eventId: number,
  params?: { page?: number }
): Promise<PaginatedResponse<Poll>> => {
  const response = await client.get(`/api/events/${eventId}/polls`, { params });
  return response.data;
};

export const createPoll = async (eventId: number, data: CreatePollData): Promise<Poll> => {
  const response = await client.post(`/api/events/${eventId}/polls`, data);
  return response.data;
};

export const vote = async (pollId: number, data: VoteData): Promise<VoteResponse> => {
  const response = await client.post(`/api/polls/${pollId}/vote`, data);
  return response.data;
};

export const getPollResults = async (pollId: number): Promise<PollResults> => {
  const response = await client.get(`/api/polls/${pollId}/results`);
  return normalizePollResults(response.data);
};
