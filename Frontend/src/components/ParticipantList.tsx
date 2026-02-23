import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getParticipants } from '../api/events';
import { updateMyParticipation } from '../api/participation';
import { listCustomFields } from '../api/customFields';
import type { Participation, ZusageStatus, CustomFieldDefinition } from '../types';
import { useAuth } from '../context/AuthContext';
import Pagination from './Pagination';
import { DEFAULT_PAGE_SIZE, SUCCESS_MESSAGE_DURATION_MS } from '../constants';

interface ParticipantListProps {
  eventId: number;
}

const ParticipantList: React.FC<ParticipantListProps> = ({ eventId }) => {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  
  // Edit state for current user's participation
  const [editRsvpStatus, setEditRsvpStatus] = useState<ZusageStatus>('pending');
  const [editPlusOneCount, setEditPlusOneCount] = useState('');
  const [editAllergies, setEditAllergies] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDresscodeVisible, setEditDresscodeVisible] = useState(false);
  const [editCustomFieldAnswers, setEditCustomFieldAnswers] = useState<Record<string, string | number | boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const fetchParticipants = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page: currentPage };
      setError('');

      const response = await getParticipants(eventId, params);
      const participantRows = Array.isArray(response.results) ? response.results : [];
      setParticipants(participantRows);
      setTotalCount(typeof response.count === 'number' ? response.count : participantRows.length);
      
      // Initialize edit state with current user's participation
      if (user) {
        const myParticipation = participantRows.find((p) => p.user?.id === user.id);
        if (myParticipation) {
          setEditRsvpStatus(myParticipation.rsvp_status);
          setEditPlusOneCount(myParticipation.plus_one_count?.toString() || '');
          setEditAllergies(myParticipation.allergies || '');
          setEditNotes(myParticipation.notes || '');
          setEditDresscodeVisible(myParticipation.dresscode_visible || false);
          
          // Initialize custom field answers
          const answers: Record<string, string | number | boolean> = {};
          const customFieldValues = Array.isArray(myParticipation.custom_field_values)
            ? myParticipation.custom_field_values
            : [];

          customFieldValues.forEach((cfv) => {
            answers[cfv.definition_key] = cfv.value as string | number | boolean;
          });
          setEditCustomFieldAnswers(answers);
        }
      }
    } catch (err) {
      let message = 'Failed to load participants';
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          message = 'Bitte anmelden, um Teilnehmer zu sehen.';
        } else if (status === 403) {
          message = 'Keine Berechtigung fuer die Teilnehmerliste.';
        } else if (status === 404) {
          message = 'Teilnehmer-Endpunkt nicht gefunden (Pfad pruefen).';
        }
        console.error('Error fetching participants', {
          eventId,
          page: currentPage,
          status,
          url: err.config?.url,
          responseData: err.response?.data,
        });
      } else {
        console.error('Error fetching participants:', err);
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, currentPage, user]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const response = await listCustomFields(eventId);
        setCustomFields(response.results);
      } catch (err) {
        console.error('Error fetching custom fields:', err);
      }
    };

    fetchCustomFields();
  }, [eventId]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const toggleExpand = (userId: number) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const data: Partial<{
        rsvp_status: ZusageStatus;
        plus_one_count: number;
        allergies: string;
        notes: string;
        dresscode_visible: boolean;
        custom_field_answers: Record<string, string | number | boolean>;
      }> = {
        rsvp_status: editRsvpStatus,
        dresscode_visible: editDresscodeVisible,
      };

      if (editPlusOneCount) {
        data.plus_one_count = Number(editPlusOneCount);
      }

      if (editAllergies) {
        data.allergies = editAllergies;
      }

      if (editNotes) {
        data.notes = editNotes;
      }

      if (Object.keys(editCustomFieldAnswers).length > 0) {
        data.custom_field_answers = editCustomFieldAnswers;
      }

      await updateMyParticipation(eventId, data);
      setSuccess('Ihre Zusage wurde erfolgreich aktualisiert!');
      
      setTimeout(() => setSuccess(''), SUCCESS_MESSAGE_DURATION_MS);
      
      // Refresh participants list
      await fetchParticipants();
    } catch (err) {
      setError('Fehler beim Aktualisieren der Zusage');
      console.error('Error updating participation:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderEditForm = (onCancel?: () => void) => (
    <form onSubmit={handleSubmit}>
      {/* Teilnahmestatus */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-200 mb-3">Teilnahmestatus</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="edit-status" className="block mb-2 text-sm text-gray-300">Status *</label>
            <select
              id="edit-status"
              value={editRsvpStatus}
              onChange={(e) => setEditRsvpStatus(e.target.value as ZusageStatus)}
              required
              className="w-full px-4 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="pending">Ausstehend</option>
              <option value="accepted">Zugesagt</option>
              <option value="declined">Abgesagt</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-plus-one" className="block mb-2 text-sm text-gray-300">Begleitpersonen</label>
            <input
              type="number"
              id="edit-plus-one"
              value={editPlusOneCount}
              onChange={(e) => setEditPlusOneCount(e.target.value)}
              min="0"
              placeholder="Anzahl"
              className="w-full px-4 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Persönliche Informationen */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-200 mb-3">Persönliche Informationen</h4>
        <div className="grid gap-4 md:grid-cols-2 mb-3">
          <div>
            <label htmlFor="edit-allergies" className="block mb-2 text-sm text-gray-300">Allergien & Unverträglichkeiten</label>
            <textarea
              id="edit-allergies"
              value={editAllergies}
              onChange={(e) => setEditAllergies(e.target.value)}
              rows={3}
              placeholder="z.B. Nussallergie, Laktoseintoleranz..."
              className="w-full px-4 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
            />
          </div>
          <div>
            <label htmlFor="edit-notes" className="block mb-2 text-sm text-gray-300">Weitere Notizen</label>
            <textarea
              id="edit-notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              placeholder="Weitere Anmerkungen..."
              className="w-full px-4 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
            />
          </div>
        </div>
        <label className="flex items-center cursor-pointer group">
          <input
            type="checkbox"
            checked={editDresscodeVisible}
            onChange={(e) => setEditDresscodeVisible(e.target.checked)}
            className="w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer"
          />
          <span className="ml-2 text-sm text-gray-300 group-hover:text-gray-100 transition-colors">
            Dresscode sichtbar machen
          </span>
        </label>
      </div>

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-200 mb-3">Weitere Angaben</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((field) => (
              <div key={field.id}>
                <label htmlFor={`edit-field-${field.key}`} className="block mb-2 text-sm text-gray-300">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </label>
                {renderCustomFieldInput(field)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-purple-600 text-white border-none px-6 py-3 rounded-lg cursor-pointer font-semibold text-sm transition-all hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-600/50 active:scale-95 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Speichern...' : 'Zusage speichern'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-[#0f0f1a] border border-[#2d2d44] text-gray-300 px-6 py-3 rounded-lg cursor-pointer font-semibold text-sm transition-all hover:bg-[#1a1a2e] active:scale-95"
          >
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );

  const renderCustomFieldInput = (field: CustomFieldDefinition) => {
    const value = editCustomFieldAnswers[field.key];

    switch (field.field_type) {
      case 'text':
        return (
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setEditCustomFieldAnswers({ ...editCustomFieldAnswers, [field.key]: e.target.value })}
            required={field.required}
            className="w-full px-4 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={typeof value === 'number' ? value : (typeof value === 'string' ? value : '')}
            onChange={(e) => setEditCustomFieldAnswers({ ...editCustomFieldAnswers, [field.key]: Number(e.target.value) })}
            required={field.required}
            className="w-full px-4 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        );
      case 'bool':
        return (
          <input
            type="checkbox"
            checked={typeof value === 'boolean' ? value : false}
            onChange={(e) => setEditCustomFieldAnswers({ ...editCustomFieldAnswers, [field.key]: e.target.checked })}
            className="w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer"
          />
        );
      case 'enum':
        return (
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setEditCustomFieldAnswers({ ...editCustomFieldAnswers, [field.key]: e.target.value })}
            required={field.required}
            className="w-full px-4 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Auswählen...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      default:
        return null;
    }
  };

  if (isLoading) return <p className="loading text-center py-8">Loading participants...</p>;

  return (
    <div className="participant-list">
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      
      {participants.length === 0 ? (
        <p>Keine Teilnehmer gefunden.</p>
      ) : (
        <>
          <div className="space-y-4">
            {participants.map((participant) => {
              const isCurrentUser = user && participant.user.id === user.id;
              const isExpanded = expandedUserId === participant.user.id;
              
              return (
                <div 
                  key={participant.id}
                  className={`bg-[#0f0f1a] border rounded-xl overflow-hidden transition-all ${
                    isCurrentUser 
                      ? 'border-purple-500/50 shadow-lg shadow-purple-900/20' 
                      : 'border-[#2d2d44]'
                  }`}
                >
                  {/* Participant row */}
                  <div 
                    className={`p-6 cursor-pointer hover:bg-[#1a1a2e] transition-colors ${
                      isCurrentUser ? 'bg-[#1a1a2e]/50' : ''
                    }`}
                    onClick={() => isCurrentUser && toggleExpand(participant.user.id)}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start sm:items-center">
                      <div className="sm:col-span-3">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-100">{participant.user.username}</p>
                          {isCurrentUser && (
                            <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
                              Sie
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{participant.user.email}</p>
                      </div>
                      <div className="sm:col-span-3">
                        <span className={`status ${participant.rsvp_status}`}>
                          {participant.rsvp_status === 'pending' ? 'Ausstehend' : participant.rsvp_status === 'accepted' ? 'Zugesagt' : 'Abgesagt'}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-gray-300">{participant.plus_one_count || 0} Begleitperson(en)</p>
                      </div>
                      <div className="sm:col-span-3">
                        {participant.allergies && (
                          <p className="text-sm text-gray-400 truncate" title={participant.allergies}>
                            {participant.allergies}
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-1 text-right">
                        {isCurrentUser && (
                          <button 
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(participant.user.id);
                            }}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable edit form for current user */}
                  {isCurrentUser && isExpanded && (
                    <div className="border-t border-[#2d2d44] p-6 bg-[#1a1a2e]">
                      <h3 className="text-lg font-semibold text-purple-400 mb-4">Meine Zusage bearbeiten</h3>
                      {renderEditForm(() => toggleExpand(participant.user.id))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {/* RSVP form for current user who is not yet in the participant list */}
      {user && !participants.some((p) => p.user?.id === user.id) && (
        <div className="mt-4 bg-[#0f0f1a] border border-purple-500/50 rounded-xl overflow-hidden shadow-lg shadow-purple-900/20">
          <div className="p-6 bg-[#1a1a2e]/50">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-100">{user.username}</p>
              <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
                Sie
              </span>
            </div>
          </div>
          <div className="border-t border-[#2d2d44] p-6 bg-[#1a1a2e]">
            <h3 className="text-lg font-semibold text-purple-400 mb-4">Meine Zusage bearbeiten</h3>
            {renderEditForm()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantList;
