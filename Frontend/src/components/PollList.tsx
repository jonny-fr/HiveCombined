import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { listPolls, vote, createPoll } from '../api/polls';
import type { Poll } from '../types';
import PollResults from './PollResults';
import Pagination from './Pagination';
import { DEFAULT_PAGE_SIZE } from '../constants';
import ErrorBoundary from './ErrorBoundary';

interface PollListProps {
  eventId: number;
  isOwner: boolean;
}

type FeedbackKind = 'success' | 'error';

interface PollFeedback {
  kind: FeedbackKind;
  message: string;
}

const ALREADY_VOTED_MARKERS = [
  'already voted',
  'already cast',
  'already submitted',
  'bereits abgestimmt',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const flattenErrorMessages = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenErrorMessages);
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap(flattenErrorMessages);
  }

  return [];
};

const extractApiMessages = (payload: unknown): string[] => {
  if (!isRecord(payload)) {
    return [];
  }

  if (isRecord(payload.error) && 'detail' in payload.error) {
    return flattenErrorMessages(payload.error.detail);
  }

  if ('detail' in payload) {
    return flattenErrorMessages(payload.detail);
  }

  return flattenErrorMessages(payload);
};

const includesAlreadyVotedMessage = (messages: string[]): boolean =>
  messages.some((message) =>
    ALREADY_VOTED_MARKERS.some((marker) => message.toLowerCase().includes(marker))
  );

const getPollVoteHint = (poll: Poll): boolean | null => {
  const pollRecord = poll as unknown as Record<string, unknown>;
  const hintKeys = ['has_voted', 'has_user_voted', 'user_has_voted', 'already_voted'];

  for (const key of hintKeys) {
    const value = pollRecord[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return null;
};

const PollList: React.FC<PollListProps> = ({ eventId, isOwner }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number[]>>({});
  const [showResults, setShowResults] = useState<Record<number, boolean>>({});
  const [isVotingByPoll, setIsVotingByPoll] = useState<Record<number, boolean>>({});
  const [hasVotedByPoll, setHasVotedByPoll] = useState<Record<number, boolean>>({});
  const [voteFeedbackByPoll, setVoteFeedbackByPoll] = useState<Record<number, PollFeedback>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Create poll form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [allowsMultiple, setAllowsMultiple] = useState(false);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const fetchPolls = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await listPolls(eventId, { page: currentPage });
      setPolls(response.results);
      setTotalCount(response.count);

      const voteHints = response.results.reduce<Record<number, boolean>>((accumulator, poll) => {
        const voteHint = getPollVoteHint(poll);
        if (voteHint !== null) {
          accumulator[poll.id] = voteHint;
        }
        return accumulator;
      }, {});

      if (Object.keys(voteHints).length > 0) {
        setHasVotedByPoll((previous) => ({ ...previous, ...voteHints }));
      }
    } catch (err) {
      setError('Failed to load polls.');
      console.error('Error fetching polls:', err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, currentPage]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handleVote = async (pollId: number) => {
    if (isVotingByPoll[pollId] || hasVotedByPoll[pollId]) {
      return;
    }

    const optionIds = Array.from(new Set(selectedOptions[pollId] || []));
    if (optionIds.length === 0) {
      setVoteFeedbackByPoll((previous) => ({
        ...previous,
        [pollId]: {
          kind: 'error',
          message: 'Please select at least one option before voting.',
        },
      }));
      return;
    }

    setIsVotingByPoll((previous) => ({ ...previous, [pollId]: true }));
    setVoteFeedbackByPoll((previous) => {
      const next = { ...previous };
      delete next[pollId];
      return next;
    });

    try {
      await vote(pollId, { option_ids: optionIds });

      setHasVotedByPoll((previous) => ({ ...previous, [pollId]: true }));
      setSelectedOptions((previous) => ({ ...previous, [pollId]: [] }));
      setShowResults((previous) => ({ ...previous, [pollId]: true }));
      setVoteFeedbackByPoll((previous) => ({
        ...previous,
        [pollId]: { kind: 'success', message: 'Vote recorded.' },
      }));
    } catch (err) {
      const apiMessages = axios.isAxiosError(err) ? extractApiMessages(err.response?.data) : [];
      const alreadyVoted = includesAlreadyVotedMessage(apiMessages);

      if (alreadyVoted) {
        setHasVotedByPoll((previous) => ({ ...previous, [pollId]: true }));
        setShowResults((previous) => ({ ...previous, [pollId]: true }));
      }

      setVoteFeedbackByPoll((previous) => ({
        ...previous,
        [pollId]: {
          kind: 'error',
          message: alreadyVoted
            ? 'You already voted in this poll.'
            : apiMessages[0] ?? 'Failed to record vote. Please try again.',
        },
      }));

      console.error('Error voting:', err);
    } finally {
      setIsVotingByPoll((previous) => ({ ...previous, [pollId]: false }));
    }
  };

  const toggleOption = (pollId: number, optionId: number, allowsMultipleMode: boolean) => {
    if (hasVotedByPoll[pollId] || isVotingByPoll[pollId]) {
      return;
    }

    setSelectedOptions((previous) => {
      const current = previous[pollId] || [];
      let updated: number[];

      if (allowsMultipleMode) {
        updated = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
      } else {
        updated = [optionId];
      }

      return { ...previous, [pollId]: updated };
    });

    setVoteFeedbackByPoll((previous) => {
      const next = { ...previous };
      delete next[pollId];
      return next;
    });
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();

    const nonEmptyOptions = options.filter((opt) => opt.trim() !== '');
    if (nonEmptyOptions.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }

    try {
      await createPoll(eventId, {
        question,
        allows_multiple: allowsMultiple,
        opens_at: opensAt || undefined,
        closes_at: closesAt || undefined,
        options: nonEmptyOptions.map((label, index) => ({ label, position: index })),
      });

      // Reset form
      setQuestion('');
      setAllowsMultiple(false);
      setOpensAt('');
      setClosesAt('');
      setOptions(['', '']);
      setShowCreateForm(false);
      setError('');

      // Refresh polls
      fetchPolls();
    } catch (err) {
      setError('Failed to create poll');
      console.error('Error creating poll:', err);
    }
  };

  const addOption = () => {
    setOptions((previous) => [...previous, '']);
  };

  const removeOption = (index: number) => {
    setOptions((previous) => (previous.length > 2 ? previous.filter((_, i) => i !== index) : previous));
  };

  const updateOption = (index: number, value: string) => {
    setOptions((previous) => {
      const updated = [...previous];
      updated[index] = value;
      return updated;
    });
  };

  if (isLoading) return <p className="loading text-center py-8">Loading polls...</p>;

  return (
    <div className="poll-list">
      <div className="header-row">
        <h2>Polls</h2>
        {isOwner && (
          <button
            onClick={() => setShowCreateForm((previous) => !previous)}
            className="button"
            type="button"
          >
            {showCreateForm ? 'Cancel' : 'Create Poll'}
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {showCreateForm && (
        <form onSubmit={handleCreatePoll} className="form-container">
          <div className="form-group">
            <label htmlFor="question">Question *</label>
            <input
              type="text"
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={allowsMultiple}
                onChange={(e) => setAllowsMultiple(e.target.checked)}
              />
              {' '}Allow multiple choices
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="opensAt">Opens At</label>
            <input
              type="datetime-local"
              id="opensAt"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="closesAt">Closes At</label>
            <input
              type="datetime-local"
              id="closesAt"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Options *</label>
            {options.map((option, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  required
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="secondary"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addOption} className="secondary">
              Add Option
            </button>
          </div>

          <button type="submit">Create Poll</button>
        </form>
      )}

      {polls.length === 0 ? (
        <p>No polls yet.</p>
      ) : (
        <>
          {polls.map((poll) => {
            const selectedForPoll = selectedOptions[poll.id] || [];
            const isVoting = Boolean(isVotingByPoll[poll.id]);
            const hasVoted = Boolean(hasVotedByPoll[poll.id]);
            const feedback = voteFeedbackByPoll[poll.id];

            return (
              <div key={poll.id} className="poll-item">
                <h3>{poll.question}</h3>
                <p>{poll.allows_multiple ? 'Multiple choice' : 'Single choice'}</p>

                {!showResults[poll.id] ? (
                  <>
                    {poll.options.length === 0 ? (
                      <p>No options available for this poll.</p>
                    ) : (
                      <div className="poll-options">
                        {poll.options.map((option) => (
                          <label key={option.id} className="poll-option">
                            <input
                              type={poll.allows_multiple ? 'checkbox' : 'radio'}
                              name={`poll-${poll.id}`}
                              checked={selectedForPoll.includes(option.id)}
                              onChange={() => toggleOption(poll.id, option.id, poll.allows_multiple)}
                              disabled={isVoting || hasVoted}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="button-group">
                      <button
                        onClick={() => handleVote(poll.id)}
                        disabled={selectedForPoll.length === 0 || isVoting || hasVoted}
                        className="button"
                        type="button"
                      >
                        {isVoting ? 'Voting...' : hasVoted ? 'Already voted' : 'Vote'}
                      </button>
                      <button
                        onClick={() =>
                          setShowResults((previous) => ({ ...previous, [poll.id]: true }))
                        }
                        className="button secondary"
                        type="button"
                      >
                        View Results
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <ErrorBoundary fallback={<div className="error">Unable to render poll results.</div>}>
                      <PollResults pollId={poll.id} />
                    </ErrorBoundary>
                    <button
                      onClick={() => setShowResults((previous) => ({ ...previous, [poll.id]: false }))}
                      className="button secondary"
                      type="button"
                    >
                      Hide Results
                    </button>
                  </>
                )}

                {feedback && (
                  <div className={feedback.kind === 'success' ? 'success' : 'error'}>
                    {feedback.message}
                  </div>
                )}
              </div>
            );
          })}
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};

export default PollList;
