import React, { useState, useEffect, useCallback } from 'react';
import { listCustomFields, createCustomField } from '../api/customFields';
import type { CustomFieldDefinition, CustomFieldType, CreateCustomFieldData } from '../types';
import Pagination from './Pagination';
import { DEFAULT_PAGE_SIZE } from '../constants';

interface CustomFieldListProps {
  eventId: number;
  isOwner: boolean;
}

const CustomFieldList: React.FC<CustomFieldListProps> = ({ eventId, isOwner }) => {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');
  const [position, setPosition] = useState('');

  const fetchFields = useCallback(async () => {
    try {
      const response = await listCustomFields(eventId, { page: currentPage });
      setFields(response.results);
      setTotalCount(response.count);
    } catch (err) {
      setError('Failed to load custom fields');
      console.error('Error fetching custom fields:', err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, currentPage]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data: CreateCustomFieldData = {
        key,
        label,
        field_type: fieldType,
        required,
      };
      
      if (position) {
        data.position = Number(position);
      }
      
      if (fieldType === 'enum' && options) {
        data.options = options.split(',').map(opt => opt.trim()).filter(opt => opt !== '');
      }
      
      await createCustomField(eventId, data);
      
      // Reset form
      setKey('');
      setLabel('');
      setFieldType('text');
      setRequired(false);
      setOptions('');
      setPosition('');
      setShowCreateForm(false);
      setError('');
      
      // Refresh fields
      fetchFields();
    } catch (err) {
      setError('Failed to create custom field');
      console.error('Error creating custom field:', err);
    }
  };

  if (isLoading) return <p className="loading text-center py-8">Loading custom fields...</p>;

  return (
    <div className="custom-field-list">
      <div className="header-row">
        <h2>Custom Fields</h2>
        {isOwner && (
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="button">
            {showCreateForm ? 'Cancel' : 'Create Custom Field'}
          </button>
        )}
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {showCreateForm && (
        <form onSubmit={handleCreateField} className="form-container">
          <div className="form-group">
            <label htmlFor="key">Key (slug) *</label>
            <input
              type="text"
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g., dietary_preference"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="label">Label *</label>
            <input
              type="text"
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Dietary Preference"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="fieldType">Field Type *</label>
            <select
              id="fieldType"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
              required
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="bool">Boolean</option>
              <option value="enum">Enum (select)</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              {' '}Required
            </label>
          </div>
          
          {fieldType === 'enum' && (
            <div className="form-group">
              <label htmlFor="options">Options (comma-separated) *</label>
              <input
                type="text"
                id="options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="e.g., Vegetarian, Vegan, Gluten-free"
                required
              />
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="position">Position</label>
            <input
              type="number"
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Order in the form"
            />
          </div>
          
          <button type="submit">Create Field</button>
        </form>
      )}
      
      {fields.length === 0 ? (
        <p>No custom fields defined.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                <th>Required</th>
                <th>Options</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id}>
                  <td>{field.label}</td>
                  <td>{field.field_type}</td>
                  <td>{field.required ? 'Yes' : 'No'}</td>
                  <td>{field.options ? field.options.join(', ') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default CustomFieldList;
