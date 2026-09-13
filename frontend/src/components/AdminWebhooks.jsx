import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import Pagination from './Pagination';
import './AdminCrud.css';

const PAGE_SIZE = 20;
const EVENT_TYPES = ['feedback.submitted', 'feedback.text_submitted'];
const PAYLOAD_MODES = ['minimal', 'standard'];

export function WebhookForm({ entity, onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(
    entity
      ? {
          name: entity.name,
          url: entity.url,
          eventType: entity.event_type || 'feedback.submitted',
          payloadMode: entity.payload_mode || 'minimal',
          customHeaders: entity.custom_headers ? JSON.stringify(entity.custom_headers, null, 2) : '{}',
          retryCount: entity.retry_count || 3,
          timeoutSeconds: entity.timeout_seconds || 10,
          active: entity.active !== false,
        }
      : {
          name: '',
          url: '',
          eventType: 'feedback.submitted',
          payloadMode: 'minimal',
          customHeaders: '{}',
          retryCount: 3,
          timeoutSeconds: 10,
          active: true,
        }
  );
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate URL
    try {
      new URL(formData.url);
    } catch {
      setError('Invalid URL');
      return;
    }

    // Validate custom headers JSON
    let customHeadersObj = null;
    if (formData.customHeaders.trim()) {
      try {
        customHeadersObj = JSON.parse(formData.customHeaders);
      } catch {
        setError('Invalid JSON in custom headers');
        return;
      }
    }

    try {
      const payload = {
        name: formData.name,
        url: formData.url,
        eventType: formData.eventType,
        payloadMode: formData.payloadMode,
        customHeaders: customHeadersObj,
        retryCount: parseInt(formData.retryCount),
        timeoutSeconds: parseInt(formData.timeoutSeconds),
        active: formData.active,
      };

      if (entity) {
        await api.adminRequest(`/webhooks/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api.adminRequest('/webhooks', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await api.adminRequest(`/webhooks/${entity.id}/test`, {
        method: 'POST',
      });
      setTestResult({
        success: true,
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        durationMs: result.durationMs,
      });
    } catch (err) {
      setTestResult({
        success: false,
        error: err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <h3>{entity ? t('admin.editWebhook') : 'Add New Webhook'}</h3>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Slack Notifications"
            required
          />
        </div>

        <div className="form-group">
          <label>Webhook URL *</label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://example.com/webhook"
            required
          />
        </div>

        <div className="form-group">
          <label>Event Type *</label>
          <select
            value={formData.eventType}
            onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
            required
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === 'feedback.text_submitted' ? `${type} (PII Warning)` : type}
              </option>
            ))}
          </select>
          {formData.eventType === 'feedback.text_submitted' && (
            <small style={{ color: '#ff9800' }}>
              ⚠️ This webhook will receive text answers which may contain PII. Ensure users are informed.
            </small>
          )}
        </div>

        <div className="form-group">
          <label>Payload Mode</label>
          <select
            value={formData.payloadMode}
            onChange={(e) => setFormData({ ...formData, payloadMode: e.target.value })}
          >
            {PAYLOAD_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'minimal' ? 'Minimal (event only)' : 'Standard (full payload)'}
              </option>
            ))}
          </select>
          <small>
            {formData.payloadMode === 'minimal'
              ? 'Sends only event metadata. Receiver must fetch data via API if needed.'
              : 'Sends complete feedback data including all answers.'}
          </small>
        </div>

        <div className="form-group">
          <label>Custom Headers (JSON)</label>
          <textarea
            value={formData.customHeaders}
            onChange={(e) => setFormData({ ...formData, customHeaders: e.target.value })}
            placeholder='{"Authorization": "Bearer token", "X-Custom-Header": "value"}'
            rows="4"
          />
          <small>Optional custom HTTP headers (JSON format)</small>
        </div>

        <div className="form-group">
          <label>Retry Count</label>
          <input
            type="number"
            min="0"
            max="10"
            value={formData.retryCount}
            onChange={(e) => setFormData({ ...formData, retryCount: e.target.value })}
          />
          <small>Number of retry attempts on failure (0 = no retries)</small>
        </div>

        <div className="form-group">
          <label>Timeout (seconds)</label>
          <input
            type="number"
            min="1"
            max="60"
            value={formData.timeoutSeconds}
            onChange={(e) => setFormData({ ...formData, timeoutSeconds: e.target.value })}
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
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          {entity && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? 'Testing...' : 'Test Webhook'}
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            {entity ? 'Update' : 'Create'}
          </button>
        </div>
      </form>

      {testResult && (
        <div style={{ marginTop: '20px', padding: '10px', borderRadius: '4px', backgroundColor: '#f5f5f5' }}>
          <h4>Test Result</h4>
          {testResult.success ? (
            <>
              <p>✅ Status: {testResult.statusCode}</p>
              <p>Duration: {testResult.durationMs}ms</p>
              <p>Response:</p>
              <pre style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
                {testResult.responseBody}
              </pre>
            </>
          ) : (
            <p>❌ Error: {testResult.error}</p>
          )}
        </div>
      )}
    </>
  );
}

function DeliveryLogs({ webhookId, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadLogs();
  }, [webhookId, page]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.adminRequest(`/webhooks/${webhookId}/logs?page=${page}&pageSize=${PAGE_SIZE}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load delivery logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300) return '#4caf50';
    if (statusCode >= 400) return '#f44336';
    return '#ff9800';
  };

  return (
    <div className="form-modal">
      <div className="form-container">
        <h3>Delivery Logs</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {logs.length === 0 ? (
              <p>No delivery logs yet.</p>
            ) : (
              <table className="data-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Duration (ms)</th>
                    <th>Response Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.delivered_at).toLocaleString()}</td>
                      <td style={{ color: getStatusColor(log.status_code), fontWeight: 'bold' }}>
                        {log.status_code}
                      </td>
                      <td>{log.duration_ms}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.response_body?.substring(0, 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
            <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: '10px' }}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminWebhooks() {
  const { t } = useTranslation();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [page, setPage] = useState(0);
  const [showLogs, setShowLogs] = useState(null);

  useEffect(() => {
    loadWebhooks();
  }, [page]);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.adminRequest(`/webhooks?page=${page}&pageSize=${PAGE_SIZE}`);
      setWebhooks(data.webhooks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (webhook) => {
    setEditingEntity(webhook);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }
    try {
      await api.adminRequest(`/webhooks/${id}`, {
        method: 'DELETE',
      });
      loadWebhooks();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntity(null);
    setPage(0); // Reset to first page
    loadWebhooks();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
  };

  if (loading) return <div className="loading">Loading webhooks...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-crud-section">
      <div className="section-header">
        <h2>Webhooks</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Webhook
        </button>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-container">
            <WebhookForm
              entity={editingEntity}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
          </div>
        </div>
      )}

      {showLogs && (
        <DeliveryLogs webhookId={showLogs} onClose={() => setShowLogs(null)} />
      )}

      <div className="data-list">
        {webhooks.length === 0 ? (
          <div className="empty-state">
            <p>No webhooks yet. Add your first webhook to send notifications.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Event Type</th>
                <th>URL</th>
                <th>Payload Mode</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((webhook) => (
                <tr key={webhook.id}>
                  <td>{webhook.name}</td>
                  <td>
                    <code>{webhook.event_type}</code>
                  </td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {webhook.url}
                  </td>
                  <td>
                    <span className="status">{webhook.payload_mode}</span>
                  </td>
                  <td>
                    <span className={`status ${webhook.active ? 'active' : 'inactive'}`}>
                      {webhook.active ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => handleEdit(webhook)} title="Edit">
                      ✏️
                    </button>
                    <button className="btn-icon" onClick={() => setShowLogs(webhook.id)} title="View Logs">
                      📋
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(webhook.id)} title="Delete">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination
          total={webhooks.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </div>
    </div>
  );
}
