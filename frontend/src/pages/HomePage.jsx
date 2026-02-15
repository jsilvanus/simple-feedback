import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="home-container">
        <h1>Simple Feedback</h1>
        <p className="subtitle">Configurable feedback application for tablets and mobile browsers</p>
        
        <div className="home-actions">
          <div className="action-card">
            <h2>Test Feedback</h2>
            <p>Enter a location slug to test the feedback interface</p>
            <input 
              type="text" 
              placeholder="Enter location slug (e.g., lobby)" 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  navigate(`/${e.target.value}`);
                }
              }}
            />
            <small>Press Enter to navigate</small>
          </div>

          <div className="action-card">
            <h2>Admin Dashboard</h2>
            <p>Manage locations, questions, and view results</p>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/admin')}
            >
              Go to Admin
            </button>
          </div>
        </div>

        <div className="features">
          <h3>Features</h3>
          <ul>
            <li>✓ Multiple locations support</li>
            <li>✓ Configurable questionnaires</li>
            <li>✓ Scale, text, and word cloud questions</li>
            <li>✓ Scheduled questionnaires</li>
            <li>✓ Admin dashboard for management</li>
            <li>✓ Results export and analytics</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
