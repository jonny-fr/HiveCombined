import React, { useState, useEffect } from 'react';
import { getPollResults } from '../api/polls';
import type { PollResults as PollResultsType } from '../types';

interface PollResultsProps {
  pollId: number;
}

const PollResults: React.FC<PollResultsProps> = ({ pollId }) => {
  const [results, setResults] = useState<PollResultsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchResults = async () => {
      setIsLoading(true);
      setError('');

      try {
        const data = await getPollResults(pollId);
        if (isMounted) {
          setResults(data);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load poll results.');
        }
        console.error('Error fetching poll results:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      isMounted = false;
    };
  }, [pollId]);

  if (isLoading) return <p>Loading results...</p>;
  if (error) return <div className="error">{error}</div>;
  if (!results) return <p>No results available.</p>;

  if (results.options.length === 0) {
    return (
      <div className="poll-results">
        <h4>{results.question}</h4>
        <p>No votes yet.</p>
      </div>
    );
  }

  const voteBase = results.unique_voters > 0 ? results.unique_voters : results.total_votes;

  return (
    <div className="poll-results">
      <h4>{results.question}</h4>
      <p>
        {results.total_votes} total votes by {results.unique_voters} voters
      </p>
      {results.options.map((option) => {
        const percentage =
          voteBase > 0 ? Math.min(100, Math.max(0, (option.vote_count / voteBase) * 100)) : 0;

        return (
          <div key={option.id} className="result-item">
            <div className="result-label">{option.label}</div>
            <div className="result-bar">
              <div
                className="result-fill"
                style={{
                  width: `${percentage}%`,
                }}
              ></div>
            </div>
            <div className="result-count">{option.vote_count} votes</div>
          </div>
        );
      })}
    </div>
  );
};

export default PollResults;
