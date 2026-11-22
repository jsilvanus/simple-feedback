import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FeedbackPage from './pages/FeedbackPage';
import AdminPage from './pages/AdminPage';
import AdminMapPage from './pages/AdminMapPage';
import { getBasePath } from './api';
import './i18n';

function App() {
  return (
    <BrowserRouter basename={getBasePath() || '/'}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/map" element={<AdminMapPage />} />
        <Route path="/:locationSlug" element={<FeedbackPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
