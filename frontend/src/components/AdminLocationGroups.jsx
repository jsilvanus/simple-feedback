import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminLocationGroups() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true,
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.adminRequest(`/location-groups/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await api.adminRequest('/location-groups', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', description: '', active: true });
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (group) => {
    setEditingId(group.id);
    setFormData({
      name: group.name,
      description: group.description || '',
      active: group.active,
    });
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

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', description: '', active: true });
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
            <h3>{editingId ? t('admin.editLocationGroup') : t('admin.addNewLocationGroup')}</h3>
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
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
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
