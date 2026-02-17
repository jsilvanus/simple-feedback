import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

export function LocationGroupForm({ entity, onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(
    entity
      ? { name: entity.name, description: entity.description || '', active: entity.active }
      : { name: '', description: '', active: true }
  );
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (entity) {
        await api.adminRequest(`/location-groups/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await api.adminRequest('/location-groups', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <h3>{entity ? t('admin.editLocationGroup') : t('admin.addNewLocationGroup')}</h3>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="3"
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            />
            Active
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {entity ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </>
  );
}

export default function AdminLocationGroups() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.adminRequest('/location-groups');
      setGroups(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (group) => {
    setEditingEntity(group);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this location group? This will ungroup all associated locations.')) {
      return;
    }
    try {
      await api.adminRequest(`/location-groups/${id}`, {
        method: 'DELETE',
      });
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntity(null);
    loadGroups();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
  };

  if (loading) return <div className="loading">{t('admin.loadingLocationGroups')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>{t('admin.locationGroups')}</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + {t('admin.addLocationGroup')}
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <LocationGroupForm
              entity={editingEntity}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
          </div>
        </div>
      )}

      <div className="data-list">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state">No location groups found</td>
              </tr>
            ) : (
              groups.map((group) => (
                <tr key={group.id}>
                  <td>{group.id}</td>
                  <td>{group.name}</td>
                  <td>{group.description || '-'}</td>
                  <td>
                    <span className={`status ${group.active ? 'active' : 'inactive'}`}>
                      {group.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button className="btn-icon" onClick={() => handleEdit(group)} title="Edit">
                      ✏️
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(group.id)} title="Delete">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
