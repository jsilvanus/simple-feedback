import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminCrud.css';

export default function AdminLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    active: true,
  });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.adminRequest('/locations');
      setLocations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.adminRequest('/locations', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setFormData({ slug: '', name: '', active: true });
      loadLocations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (location) => {
    setEditingId(location.id);
    setFormData({
      slug: location.slug,
      name: location.name,
      active: location.active,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ slug: '', name: '', active: true });
  };

  if (loading) return <div className="loading">Loading locations...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>Locations</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Location
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <h3>{editingId ? 'Edit Location' : 'Add New Location'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Slug *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., lobby"
                  required
                  disabled={editingId}
                />
                <small>URL-friendly identifier (cannot be changed after creation)</small>
              </div>
              
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Lobby"
                  required
                />
              </div>

              <div className="form-group checkbox">
                <label>
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
        {locations.length === 0 ? (
          <div className="empty-state">
            <p>No locations yet. Add your first location to get started.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id}>
                  <td><code>/{location.slug}</code></td>
                  <td>{location.name}</td>
                  <td>
                    <span className={`status ${location.active ? 'active' : 'inactive'}`}>
                      {location.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(location.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-icon" onClick={() => handleEdit(location)} title="Edit">
                      ✏️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
