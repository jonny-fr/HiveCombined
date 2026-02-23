import React, { useState, useEffect, useCallback } from 'react';
import { listContributions, createContribution } from '../api/contributions';
import { getParticipants } from '../api/events';
import { updateMyParticipation } from '../api/participation';
import type { ContributionItem } from '../types';
import { useAuth } from '../context/AuthContext';
import Pagination from './Pagination';
import { DEFAULT_PAGE_SIZE } from '../constants';

interface ContributionListProps {
  eventId: number;
}

const ContributionList: React.FC<ContributionListProps> = ({ eventId }) => {
  const { user } = useAuth();
  const [contributions, setContributions] = useState<ContributionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [myParticipationId, setMyParticipationId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Fetch user's participation ID
  useEffect(() => {
    const fetchMyParticipation = async () => {
      if (!user) return;
      try {
        const response = await getParticipants(eventId, {});
        const participantRows = Array.isArray(response.results) ? response.results : [];
        const myParticipation = participantRows.find((p) => p.user?.id === user.id);
        if (myParticipation) {
          setMyParticipationId(myParticipation.id);
        } else {
          setMyParticipationId(null);
        }
      } catch (err) {
        console.error('Error fetching participation:', err);
      }
    };
    fetchMyParticipation();
  }, [eventId, user]);

  const fetchContributions = useCallback(async () => {
    try {
      const response = await listContributions(eventId, { page: currentPage });
      setContributions(response.results);
      setTotalCount(response.count);
    } catch (err) {
      setError('Failed to load contributions');
      console.error('Error fetching contributions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, currentPage]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createContribution(eventId, {
        item_name: itemName,
        quantity: quantity ? Number(quantity) : undefined,
        notes: notes || undefined,
      });
      setItemName('');
      setQuantity('');
      setNotes('');
      setShowForm(false);
      fetchContributions();
    } catch (err) {
      setError('Failed to add contribution');
      console.error('Error creating contribution:', err);
    }
  };

  const startEdit = (contribution: ContributionItem) => {
    setEditingId(contribution.id);
    setEditItemName(contribution.item_name);
    setEditQuantity(contribution.quantity?.toString() || '');
    setEditNotes(contribution.notes || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditItemName('');
    setEditQuantity('');
    setEditNotes('');
  };

  const handleUpdate = async (contributionId: number) => {
    try {
      // Get current user's contributions
      const myContributions = contributions.filter(c => c.participation === myParticipationId);
      
      // Update the specific contribution
      const updatedContributions = myContributions.map(c => 
        c.id === contributionId 
          ? {
              item_name: editItemName,
              quantity: editQuantity ? Number(editQuantity) : undefined,
              notes: editNotes || undefined,
            }
          : {
              item_name: c.item_name,
              quantity: c.quantity,
              notes: c.notes,
            }
      );

      // Update through participation endpoint
      await updateMyParticipation(eventId, {
        contributions: updatedContributions,
      });

      setEditingId(null);
      setEditItemName('');
      setEditQuantity('');
      setEditNotes('');
      fetchContributions();
    } catch (err) {
      setError('Fehler beim Aktualisieren des Beitrags');
      console.error('Error updating contribution:', err);
    }
  };

  const handleDelete = async (contributionId: number) => {
    if (!window.confirm('Möchten Sie diesen Beitrag wirklich löschen?')) {
      return;
    }
    try {
      // Get current user's contributions excluding the one to delete
      const myContributions = contributions
        .filter(c => c.participation === myParticipationId && c.id !== contributionId)
        .map(c => ({
          item_name: c.item_name,
          quantity: c.quantity,
          notes: c.notes,
        }));

      // Update through participation endpoint
      await updateMyParticipation(eventId, {
        contributions: myContributions,
      });

      fetchContributions();
    } catch (err) {
      setError('Fehler beim Löschen des Beitrags');
      console.error('Error deleting contribution:', err);
    }
  };

  if (isLoading) return <p className="loading text-center py-8">Loading contributions...</p>;

  return (
    <div className="contribution-list">
      {error && <div className="error">{error}</div>}
      
      {/* Add contribution button */}
      <div className="mb-6">
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="bg-purple-600 text-white border-none px-6 py-3 rounded-lg cursor-pointer font-semibold text-sm transition-all hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-600/50 active:scale-95"
        >
          {showForm ? 'Abbrechen' : '+ Beitrag hinzufügen'}
        </button>
      </div>
      
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#0f0f1a] border border-[#2d2d44] rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Neuer Beitrag</h3>
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div className="md:col-span-2">
              <label htmlFor="itemName" className="block mb-2 text-sm text-gray-300">Artikel *</label>
              <input
                type="text"
                id="itemName"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                placeholder="z.B. Salat, Kuchen, Getränke..."
                className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="quantity" className="block mb-2 text-sm text-gray-300">Anzahl</label>
              <input
                type="number"
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Menge"
                className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="notes" className="block mb-2 text-sm text-gray-300">Notizen</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Zusätzliche Informationen..."
              className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
            />
          </div>
          <button 
            type="submit"
            className="bg-purple-600 text-white border-none px-6 py-3 rounded-lg cursor-pointer font-semibold text-sm transition-all hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-600/50 active:scale-95"
          >
            Hinzufügen
          </button>
        </form>
      )}

      {contributions.length === 0 ? (
        <p className="text-gray-400">Noch keine Beiträge.</p>
      ) : (
        <>
          <div className="space-y-4">
            {contributions.map((contribution) => {
              // Check if this contribution belongs to the current user
              const isMyContribution = myParticipationId !== null && contribution.participation === myParticipationId;
              const isEditing = editingId === contribution.id;
              
              return (
                <div 
                  key={contribution.id}
                  className={`bg-[#0f0f1a] border rounded-xl p-6 transition-all ${
                    isMyContribution 
                      ? 'border-purple-500/50 shadow-lg shadow-purple-900/20' 
                      : 'border-[#2d2d44]'
                  }`}
                >
                  {isEditing ? (
                    // Edit mode
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-4">Beitrag bearbeiten</h3>
                      <div className="grid gap-4 md:grid-cols-3 mb-4">
                        <div className="md:col-span-2">
                          <label className="block mb-2 text-sm text-gray-300">Artikel *</label>
                          <input
                            type="text"
                            value={editItemName}
                            onChange={(e) => setEditItemName(e.target.value)}
                            required
                            placeholder="z.B. Salat, Kuchen, Getränke..."
                            className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block mb-2 text-sm text-gray-300">Anzahl</label>
                          <input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            placeholder="Menge"
                            className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block mb-2 text-sm text-gray-300">Notizen</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={3}
                          placeholder="Zusätzliche Informationen..."
                          className="w-full px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg text-gray-100 placeholder-gray-500 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleUpdate(contribution.id)}
                          className="bg-purple-600 text-white border-none px-6 py-2 rounded-lg cursor-pointer font-semibold text-sm transition-all hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-600/50 active:scale-95"
                        >
                          Speichern
                        </button>
                        <button 
                          onClick={cancelEdit}
                          className="bg-[#0f0f1a] border border-[#2d2d44] text-gray-300 px-6 py-2 rounded-lg cursor-pointer font-semibold text-sm transition-all hover:bg-[#1a1a2e] active:scale-95"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-100">{contribution.item_name}</h4>
                          {isMyContribution && (
                            <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
                              Ihr Beitrag
                            </span>
                          )}
                        </div>
                        <div className="grid gap-2 text-sm">
                          {contribution.quantity && (
                            <p className="text-gray-300">
                              <span className="text-gray-400">Anzahl:</span> {contribution.quantity}
                            </p>
                          )}
                          {contribution.notes && (
                            <p className="text-gray-300">
                              <span className="text-gray-400">Notizen:</span> {contribution.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      {isMyContribution && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => startEdit(contribution)}
                            className="bg-[#1a1a2e] border border-[#2d2d44] text-purple-400 px-4 py-2 rounded-lg text-sm hover:bg-[#252538] hover:border-purple-600/50 transition-all"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => handleDelete(contribution.id)}
                            className="bg-red-950/30 border border-red-900/50 text-red-400 px-4 py-2 rounded-lg text-sm hover:bg-red-900/30 transition-all"
                          >
                            Löschen
                          </button>
                        </div>
                      )}
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
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};

export default ContributionList;
