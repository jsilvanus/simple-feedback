import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Box, Typography, Container, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { withBasePath } from '../api';

export default function QRFirstEntryScreen({ locationSlug, locationName, onContinue }) {
  const { t } = useTranslation();
  const [error, setError] = useState(null);

  const feedbackUrl = `${window.location.origin}${withBasePath(`/${locationSlug}`)}`;

  const handleContinue = () => {
    try {
      onContinue('kiosk');
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Box sx={{ textAlign: 'center', w: '100%' }}>
        {/* Location name / welcome */}
        {locationName && (
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 500 }}>
            {locationName}
          </Typography>
        )}

        {/* QR Code */}
        <Box sx={{ my: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 2, display: 'flex', justifyContent: 'center' }}>
          <QRCodeSVG
            value={feedbackUrl}
            size={300}
            level="H"
            marginSize={4}
            style={{ cursor: 'pointer' }}
          />
        </Box>

        {/* Intro text */}
        <Typography variant="body1" sx={{ mb: 4, color: '#666', fontSize: '1.1rem' }}>
          {t('qrFirst.scanPrompt', 'Scan to give feedback on your phone or...')}
        </Typography>

        {/* Continue button */}
        <Button
          variant="contained"
          size="large"
          onClick={handleContinue}
          fullWidth
          sx={{
            mb: 2,
            py: 2,
            fontSize: '1.1rem',
            fontWeight: 500,
            borderRadius: 1,
            textTransform: 'none',
          }}
        >
          {t('qrFirst.continueOnDevice', 'Continue on this device')}
        </Button>
      </Box>
    </Container>
  );
}
