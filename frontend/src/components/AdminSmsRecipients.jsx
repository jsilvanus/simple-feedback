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
} from '@mui/material';
import { adminRequest } from '../api';

export default function AdminSmsRecipients() {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [formData, setFormData] = useState({
    questionnaireId: '',
    phoneNumber: '',
    triggerType: 'on_submit',
    onChangeThreshold: null,
  });

  useEffect(() => {
    loadRecipients();
    loadQuestionnaires();
  }, []);

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const data = await adminRequest('/sms-recipients');
      setRecipients(data);
    } catch (error) {
      console.error('Failed to load SMS recipients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionnaires = async () => {
    try {
      const data = await adminRequest('/questionnaires');
      setQuestionnaires(data);
    } catch (error) {
      console.error('Failed to load questionnaires:', error);
    }
  };

  const handleOpen = (recipient = null) => {
    if (recipient) {
      setEditingId(recipient.id);
      setFormData({
        questionnaireId: recipient.questionnaire_id,
        phoneNumber: recipient.phone_number,
        triggerType: recipient.trigger_type,
        onChangeThreshold: recipient.on_change_threshold,
      });
    } else {
      setEditingId(null);
      setFormData({
        questionnaireId: '',
        phoneNumber: '',
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
        await adminRequest(`/sms-recipients/${editingId}`, 'PUT', formData);
      } else {
        await adminRequest('/sms-recipients', 'POST', formData);
      }
      loadRecipients();
      handleClose();
    } catch (error) {
      console.error('Failed to save SMS recipient:', error);
      alert('Error: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this SMS recipient?')) return;
    try {
      await adminRequest(`/sms-recipients/${id}`, 'DELETE');
      loadRecipients();
    } catch (error) {
      console.error('Failed to delete SMS recipient:', error);
      alert('Error: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <Box>
      <Box mb={2}>
        <Button variant="contained" color="primary" onClick={() => handleOpen()}>
          Add SMS Recipient
        </Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
            <TableCell>Questionnaire</TableCell>
            <TableCell>Phone Number</TableCell>
            <TableCell>Trigger</TableCell>
            <TableCell>Threshold (%)</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {recipients.map((recipient) => {
            const questionnaire = questionnaires.find(q => q.id === recipient.questionnaire_id);
            return (
              <TableRow key={recipient.id}>
                <TableCell>{questionnaire?.name || 'Unknown'}</TableCell>
                <TableCell>{recipient.phone_number}</TableCell>
                <TableCell>{recipient.trigger_type}</TableCell>
                <TableCell>{recipient.on_change_threshold ?? '-'}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleOpen(recipient)}>
                    Edit
                  </Button>
                  <Button size="small" color="error" onClick={() => handleDelete(recipient.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit SMS Recipient' : 'Add SMS Recipient'}</DialogTitle>
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
            type="tel"
            label="Phone Number (e.g., +358401234567)"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            helperText="Use international format with + prefix"
          />

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
