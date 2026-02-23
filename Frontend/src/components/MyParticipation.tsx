import React, { useState, useEffect } from 'react';
import { updateMyParticipation } from '../api/participation';
import { listCustomFields } from '../api/customFields';
import type { ZusageStatus, CustomFieldDefinition } from '../types';
import { SUCCESS_MESSAGE_DURATION_MS } from '../constants';

interface MyParticipationProps {
  eventId: number;
}

const MyParticipation: React.FC<MyParticipationProps> = ({ eventId }) => {
  const [rsvpStatus, setRsvpStatus] = useState<ZusageStatus>('pending');
  const [plusOneCount, setPlusOneCount] = useState('');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [dresscodeVisible, setDresscodeVisible] = useState(false);
  const [contributions, setContributions] = useState<Array<{ item_name: string; quantity?: number; notes?: string }>>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldAnswers, setCustomFieldAnswers] = useState<Record<string, string | number | boolean>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const response = await listCustomFields(eventId);
        setCustomFields(response.results);
      } catch (err) {
        console.error('Error fetching custom fields:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomFields();
  }, [eventId]);

  const addContribution = () => {
    setContributions([...contributions, { item_name: '' }]);
  };

  const removeContribution = (index: number) => {
    setContributions(contributions.filter((_, i) => i !== index));
  };

  const updateContribution = (index: number, field: string, value: string | number | undefined) => {
    const updated = [...contributions];
    updated[index] = { ...updated[index], [field]: value };
    setContributions(updated);
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
        contributions: Array<{ item_name: string; quantity?: number; notes?: string }>;
        custom_field_answers: Record<string, string | number | boolean>;
      }> = {
        rsvp_status: rsvpStatus,
        dresscode_visible: dresscodeVisible,
      };

      if (plusOneCount) {
        data.plus_one_count = Number(plusOneCount);
      }

      if (allergies) {
        data.allergies = allergies;
      }

      if (notes) {
        data.notes = notes;
      }

      if (contributions.length > 0) {
        const validContributions = contributions.filter(c => c.item_name.trim() !== '');
        if (validContributions.length > 0) {
          data.contributions = validContributions.map(c => ({
            item_name: c.item_name,
            quantity: c.quantity ? Number(c.quantity) : undefined,
            notes: c.notes || undefined,
          }));
        }
      }

      if (Object.keys(customFieldAnswers).length > 0) {
        data.custom_field_answers = customFieldAnswers;
      }

      await updateMyParticipation(eventId, data);
      setSuccess('Ihre Zusage wurde erfolgreich aktualisiert!');
      
      setTimeout(() => setSuccess(''), SUCCESS_MESSAGE_DURATION_MS);
    } catch (err) {
      setError('Fehler beim Aktualisieren der Zusage');
      console.error('Error updating participation:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderCustomFieldInput = (field: CustomFieldDefinition) => {
    const value = customFieldAnswers[field.key];

    switch (field.field_type) {
      case 'text':
        return (
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setCustomFieldAnswers({ ...customFieldAnswers, [field.key]: e.target.value })}
            required={field.required}
            className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={typeof value === 'number' ? value : (typeof value === 'string' ? value : '')}
            onChange={(e) => setCustomFieldAnswers({ ...customFieldAnswers, [field.key]: Number(e.target.value) })}
            required={field.required}
            className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        );
      case 'bool':
        return (
          <input
            type="checkbox"
            checked={typeof value === 'boolean' ? value : false}
            onChange={(e) => setCustomFieldAnswers({ ...customFieldAnswers, [field.key]: e.target.checked })}
            className="w-5 h-5 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer"
          />
        );
      case 'enum':
        return (
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setCustomFieldAnswers({ ...customFieldAnswers, [field.key]: e.target.value })}
            required={field.required}
            className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="my-participation">
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <form onSubmit={handleSubmit}>
        {/* Section 1: Teilnahmestatus */}
        <div className="mb-6 pb-6 border-b border-[#2d2d44]">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Teilnahmestatus</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="form-group">
              <label htmlFor="rsvpStatus" className="text-base">Status *</label>
              <select
                id="rsvpStatus"
                value={rsvpStatus}
                onChange={(e) => setRsvpStatus(e.target.value as ZusageStatus)}
                required
                className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="pending">Ausstehend</option>
                <option value="accepted">Zugesagt</option>
                <option value="declined">Abgesagt</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="plusOneCount" className="text-base">Begleitpersonen</label>
              <input
                type="number"
                id="plusOneCount"
                value={plusOneCount}
                onChange={(e) => setPlusOneCount(e.target.value)}
                min="0"
                placeholder="Anzahl der Begleitpersonen"
                className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Persönliche Informationen */}
        <div className="mb-6 pb-6 border-b border-[#2d2d44]">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Persönliche Informationen</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="form-group">
              <label htmlFor="allergies" className="text-base">Allergien & Unverträglichkeiten</label>
              <textarea
                id="allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                rows={4}
                placeholder="Bitte geben Sie hier Allergien oder Unverträglichkeiten an..."
                className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
              />
            </div>
            <div className="form-group">
              <label htmlFor="notes" className="text-base">Weitere Notizen</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Weitere Anmerkungen oder Wünsche..."
                className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={dresscodeVisible}
                onChange={(e) => setDresscodeVisible(e.target.checked)}
                className="w-5 h-5 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer"
              />
              <span className="ml-3 text-gray-300 group-hover:text-gray-100 transition-colors">
                Dresscode sichtbar machen
              </span>
            </label>
          </div>
        </div>

        {/* Section 3: Beiträge */}
        <div className="mb-6 pb-6 border-b border-[#2d2d44]">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Meine Beiträge</h3>
          <div className="space-y-4">
            {contributions.map((contribution, index) => (
              <div 
                key={index} 
                className="bg-[#0f0f1a] border border-[#2d2d44] rounded-lg p-6 hover:border-purple-600/50 transition-all"
              >
                <div className="grid gap-4 md:grid-cols-3 mb-4">
                  <div className="md:col-span-2">
                    <label className="block mb-2 font-medium text-gray-200 text-sm">Artikel *</label>
                    <input
                      type="text"
                      value={contribution.item_name}
                      onChange={(e) => updateContribution(index, 'item_name', e.target.value)}
                      required
                      placeholder="z.B. Salat, Kuchen, Getränke..."
                      className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-medium text-gray-200 text-sm">Anzahl</label>
                    <input
                      type="number"
                      value={contribution.quantity || ''}
                      onChange={(e) => updateContribution(index, 'quantity', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Menge"
                      className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block mb-2 font-medium text-gray-200 text-sm">Notizen</label>
                  <input
                    type="text"
                    value={contribution.notes || ''}
                    onChange={(e) => updateContribution(index, 'notes', e.target.value)}
                    placeholder="Zusätzliche Informationen..."
                    className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => removeContribution(index)} 
                  className="bg-red-950/30 border border-red-900/50 text-red-400 px-4 py-2 rounded-lg hover:bg-red-900/30 transition-all"
                >
                  Entfernen
                </button>
              </div>
            ))}
            <button 
              type="button" 
              onClick={addContribution} 
              className="w-full bg-[#0f0f1a] border-2 border-dashed border-[#2d2d44] text-gray-400 px-6 py-4 rounded-lg hover:border-purple-600/50 hover:text-purple-400 transition-all"
            >
              + Beitrag hinzufügen
            </button>
          </div>
        </div>

        {/* Section 4: Custom Fields */}
        {customFields.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Weitere Angaben</h3>
            <div className="grid gap-6 md:grid-cols-2">
              {customFields.map((field) => (
                <div key={field.id} className="form-group">
                  <label htmlFor={`field-${field.key}`} className="text-base">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  {renderCustomFieldInput(field)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-6 flex justify-center">
          <button 
            type="submit" 
            disabled={isSaving}
            className="bg-purple-600 text-white border-none px-12 py-4 rounded-lg cursor-pointer font-semibold text-lg transition-all hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-600/50 active:scale-95 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Speichern...' : 'Zusage aktualisieren'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MyParticipation;
