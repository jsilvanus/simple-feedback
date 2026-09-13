import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
} from '@mui/material';
import { adminRequest } from '../api';

export default function AdminNtfySubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [formData, setFormData] = useState({
    questionnaireId: '',
    topic: '',
    triggerType: 'on_submit',
    onChangeThreshold: null,
  });

  useEffect(() => {
    loadSubscriptions();
    loadQuestionnaires();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await adminRequest('/api/admin/ntfy-subscriptions');
      setSubscriptions(data);
    } catch (error) {
      console.error('Failed to load ntfy subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionnaires = async () => {
    try {
      const data = await adminRequest('/api/admin/questionnaires');
      setQuestionnaires(data);
    } catch (error) {
      console.error('Failed to load questionnaires:', error);
    }
  };

  const handleOpen = (subscription = null) => {
    if (subscription) {
      setEditingId(subscription.id);
      setFormData({
        questionnaireId: subscription.questionnaire_id,
        topic: subscription.topic,
        triggerType: subscription.trigger_type,
        onChangeThreshold: subscription.on_change_threshold,
      });
    } else {
      setEditingId(null);
      setFormData({
        questionnaireId: '',
        topic: '',
        triggerType: 'on_submit',
        onChangeThreshold: null,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await adminRequest(`/api/admin/ntfy-subscriptions/${editingId}`, 'PUT', formData);
      } else {
        await adminRequest('/api/admin/ntfy-subscriptions', 'POST', formData);
      }
      loadSubscriptions();
      handleClose();
    } catch (error) {
      console.error('Failed to save ntfy subscription:', error);
      alert('Error: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ntfy subscription?')) return;
    try {
      await adminRequest(`/api/admin/ntfy-subscriptions/${id}`, 'DELETE');
      loadSubscriptions();
    } catch (error) {
      console.error('Failed to delete ntfy subscription:', error);
      alert('Error: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <Box>
      <Box mb={2}>
        <Button variant="contained" color="primary" onClick={() => handleOpen()}>
          Add ntfy Subscription
        </Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
            <TableCell>Questionnaire</TableCell>
            <TableCell>Topic</TableCell>
            <TableCell>Trigger</TableCell>
            <TableCell>Threshold (%)</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {subscriptions.map((subscription) => {
            const questionnaire = questionnaires.find(q => q.id === subscription.questionnaire_id);
            return (
              <TableRow key={subscription.id}>
                <TableCell>{questionnaire?.name || 'Unknown'}</TableCell>
                <TableCell>
                  <Box sx={{ fontSize: '0.85em', fontFamily: 'monospace' }}>
                    ntfy.sh/{subscription.topic}
                  </Box>
                </TableCell>
                <TableCell>{subscription.trigger_type}</TableCell>
                <TableCell>{subscription.on_change_threshold ?? '-'}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleOpen(subscription)}>
                    Edit
                  </Button>
                  <Button size="small" color="error" onClick={() => handleDelete(subscription.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit ntfy Subscription' : 'Add ntfy Subscription'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Questionnaire</InputLabel>
            <Select
              value={formData.questionnaireId}
              onChange={(e) => setFormData({ ...formData, questionnaireId: e.target.value })}
              label="Questionnaire"
            >
              {questionnaires.map((q) => (
                <MenuItem key={q.id} value={q.id}>
                  {q.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            margin="normal"
            label="Topic Name"
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            placeholder="e.g., feedback-office-1"
            helperText="Alphanumeric, dashes, and underscores only"
          />

          <Typography variant="caption" sx={{ display: 'block', mt: 1, mb: 2 }}>
            Subscribe to: https://ntfy.sh/{formData.topic || 'topic-name'}
          </Typography>

          <FormControl fullWidth margin="normal">
            <InputLabel>Trigger Type</InputLabel>
            <Select
              value={formData.triggerType}
              onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
              label="Trigger Type"
            >
              <MenuItem value="on_submit">On Submit</MenuItem>
              <MenuItem value="on_change">On Change</MenuItem>
            </Select>
          </FormControl>

          {formData.triggerType === 'on_change' && (
            <TextField
              fullWidth
              margin="normal"
              type="number"
              label="Change Threshold (%)"
              inputProps={{ min: 0, max: 100, step: 1 }}
              value={formData.onChangeThreshold || ''}
              onChange={(e) => setFormData({ ...formData, onChangeThreshold: e.target.value ? parseFloat(e.target.value) : null })}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
