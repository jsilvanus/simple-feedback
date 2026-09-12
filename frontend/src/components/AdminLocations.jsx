import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import Pagination from './Pagination';
import './AdminCrud.css';

const PAGE_SIZE = 20;

export function LocationForm({ entity, locationGroups, onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(
    entity
      ? {
          slug: entity.slug,
          name: entity.name,
          active: entity.active,
          groupId: entity.group_id || '',
          password: '',
          passwordRequired: entity.password_required || false,
          qrEntryMode: entity.qr_entry_mode || false,
        }
      : { slug: '', name: '', active: true, groupId: '', password: '', passwordRequired: false, qrEntryMode: false }
  );
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (entity) {
        await api.adminRequest(`/locations/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await api.adminRequest('/locations', {
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
      <h3>{entity ? t('admin.editLocation') : t('admin.addNewLocation')}</h3>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Slug *</label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="e.g., lobby"
            required
            disabled={!!entity}
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

        <div className="form-group">
          <label>Location Group</label>
          <select
            value={formData.groupId}
            onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
          >
            <option value="">No Group</option>
            {(locationGroups || []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <small>Assign this location to a group for group-level scheduling</small>
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

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={formData.passwordRequired}
              onChange={(e) => setFormData({ ...formData, passwordRequired: e.target.checked })}
            />
            Require Password
          </label>
          <small>Enable persistent login for this location</small>
        </div>

        {formData.passwordRequired && (
          <div className="form-group">
            <label>Password {entity && '(leave empty to keep current)'}</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter location password"
              required={!entity}
            />
            <small>Used for kiosk login and URL parameter authentication</small>
          </div>
        )}

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={formData.qrEntryMode}
              onChange={(e) => setFormData({ ...formData, qrEntryMode: e.target.checked })}
            />
            Enable QR-First Entry Mode
          </label>
          <small>Show QR code first, allow users to continue on device or scan on their phone</small>
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

export default function AdminLocations() {
  const { t } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadLocations();
    loadGroups();
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

  const loadGroups = async () => {
    try {
      const data = await api.adminRequest('/location-groups');
      setGroups(data);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  const handleEdit = (location) => {
    setEditingEntity(location);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this location? This will also delete all associated schedules and feedback.')) {
      return;
    }
    try {
      await api.adminRequest(`/locations/${id}`, {
        method: 'DELETE',
      });
      loadLocations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntity(null);
    loadLocations();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
  };

  if (loading) return <div className="loading">{t('admin.loadingLocations')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>{t('admin.locations')}</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + {t('admin.addLocation')}
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <LocationForm
              entity={editingEntity}
              locationGroups={groups}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
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
                <th>Group</th>
                <th>Status</th>
                <th>Password</th>
                <th>QR Mode</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((location) => (
                <tr key={location.id}>
                  <td><code>/{location.slug}</code></td>
                  <td>{location.name}</td>
                  <td>
                    {location.group_name ? (
                      <span className="status">{location.group_name}</span>
                    ) : (
                      <span className="status inactive">No Group</span>
                    )}
                  </td>
                  <td>
                    <span className={`status ${location.active ? 'active' : 'inactive'}`}>
                      {location.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {location.password_required ? (
                      <span className="status active">🔒 Required</span>
                    ) : (
                      <span className="status inactive">🔓 None</span>
                    )}
                  </td>
                  <td>
                    {location.qr_entry_mode ? (
                      <span className="status active">📱 QR First</span>
                    ) : (
                      <span className="status inactive">— Off</span>
                    )}
                  </td>
                  <td>{new Date(location.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-icon" onClick={() => handleEdit(location)} title="Edit">
                      ✏️
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(location.id)} title="Delete">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination
          total={locations.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </div>
    </div>
  );
}
