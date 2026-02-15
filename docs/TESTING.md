# Testing Guide - Simple Feedback App

This guide helps you test the Simple Feedback application end-to-end.

## Prerequisites

Make sure you have completed the [Setup Guide](SETUP.md) and have:

- PostgreSQL database running with schema initialized
- Backend server running on `http://localhost:3000`
- Frontend dev server running on `http://localhost:5173`

## Test Scenario 1: Create and Test a Simple Feedback Flow

### Step 1: Add Test Data

Connect to your database and add sample data:

```sql
-- Add a location
INSERT INTO locations (slug, name, active) 
VALUES ('test-lobby', 'Test Lobby', true);

-- Add an answer scale with emoji buttons
INSERT INTO answer_scales (name, buttons) 
VALUES ('emoji-satisfaction', '[
  {"label": "😞", "value": 1, "color": "#e74c3c"},
  {"label": "😐", "value": 2, "color": "#f39c12"},
  {"label": "🙂", "value": 3, "color": "#3498db"},
  {"label": "😀", "value": 4, "color": "#2ecc71"}
]');

-- Add a scale question
INSERT INTO questions (text, type) 
VALUES ('How satisfied are you with your experience today?', 'scale');

-- Add a text question
INSERT INTO questions (text, type) 
VALUES ('Please tell us more about your experience:', 'text');

-- Add a questionnaire
INSERT INTO questionnaires (name, description) 
VALUES ('Daily Feedback Survey', 'Help us improve by sharing your thoughts');

-- Link questions to questionnaire (page 1)
INSERT INTO questionnaire_questions (questionnaire_id, question_id, page_number, answer_scale_id, order_index)
VALUES (1, 1, 1, 1, 0);

-- Link text question (page 2)
INSERT INTO questionnaire_questions (questionnaire_id, question_id, page_number, answer_scale_id, order_index)
VALUES (1, 2, 2, NULL, 0);

-- Schedule the questionnaire to be active now
INSERT INTO schedules (location_id, questionnaire_id, start_time, end_time)
VALUES (1, 1, NOW(), NOW() + INTERVAL '1 year');
```

### Step 2: Test the Feedback UI

1. Open your browser and go to `http://localhost:5173`
2. You should see the homepage with options to:
   - Test feedback interface
   - Access admin dashboard
3. Enter `test-lobby` in the location slug field and press Enter
4. You should now see the feedback page with:
   - Location name: "Test Lobby"
   - Questionnaire name: "Daily Feedback Survey"
   - Page indicator showing "Page 1 of 2"
   - Four emoji buttons (😞 😐 🙂 😀)
5. Click one of the emoji buttons - it should highlight
6. Click the "Next" button
7. Page 2 should appear with a text input field
8. Enter some text feedback
9. Click "Submit"
10. You should see a success message "Thank you!"
11. After 3 seconds, the form should automatically reset to page 1

### Step 3: Verify Data in Database

```sql
-- Check feedback sessions
SELECT * FROM feedback_sessions ORDER BY timestamp DESC LIMIT 5;

-- Check feedback answers with details
SELECT 
  fs.id as session_id,
  fs.timestamp,
  l.name as location,
  q.text as question,
  fa.value,
  fa.text_value
FROM feedback_sessions fs
JOIN locations l ON fs.location_id = l.id
JOIN feedback_answers fa ON fs.id = fa.session_id
JOIN questions q ON fa.question_id = q.id
ORDER BY fs.timestamp DESC;
```

## Test Scenario 2: Admin Dashboard

### Step 1: Login to Admin

1. Go to `http://localhost:5173/admin`
2. Enter credentials (default):
   - Username: `admin`
   - Password: `admin123`
3. Click "Login"
4. You should see the admin dashboard

### Step 2: Navigate Admin Sections

1. Click through each navigation tab:
   - Overview
   - Locations
   - Questions
   - Questionnaires
   - Schedules
   - Results
2. Each section shows a placeholder indicating it's under development

### Step 3: Test Admin Logout

1. Click the "Logout" button
2. You should be returned to the login screen

## Test Scenario 3: API Testing with curl

### Test Health Check

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok","timestamp":"..."}`

### Test Get Questionnaire

```bash
curl http://localhost:3000/api/locations/test-lobby/questionnaire
```

Expected: JSON with location and questionnaire data

### Test Submit Feedback

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": 1,
    "questionnaireId": 1,
    "answers": [
      {"questionId": 1, "value": 4, "textValue": null},
      {"questionId": 2, "value": null, "textValue": "Great service!"}
    ]
  }'
```

Expected: `{"success":true,"sessionId":...}`

### Test Admin Login

```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected: `{"success":true,"token":"...","expiresIn":86400}`

### Test Admin Endpoints (with token)

```bash
# Save token from login response
TOKEN="your-token-here"

# Get locations
curl http://localhost:3000/api/admin/locations \
  -H "Authorization: Bearer $TOKEN"

# Get questions
curl http://localhost:3000/api/admin/questions \
  -H "Authorization: Bearer $TOKEN"

# Get results
curl http://localhost:3000/api/admin/results \
  -H "Authorization: Bearer $TOKEN"

# Export CSV
curl http://localhost:3000/api/admin/export \
  -H "Authorization: Bearer $TOKEN" \
  -o feedback-export.csv
```

## Test Scenario 4: Rate Limiting

### Test Feedback Rate Limit (10 per minute)

```bash
# Submit 11 feedback requests rapidly
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/feedback \
    -H "Content-Type: application/json" \
    -d '{"locationId":1,"questionnaireId":1,"answers":[{"questionId":1,"value":4}]}'
  echo ""
done
```

Expected: After 10 requests, you should get:
```json
{"error":"Too many feedback submissions, please slow down."}
```

### Test Login Rate Limit (5 per 15 minutes)

```bash
# Try 6 login attempts
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/admin/login \
    -H "Content-Type: application/json" \
    -d '{"username":"wrong","password":"wrong"}'
  echo ""
done
```

Expected: After 5 attempts, you should get:
```json
{"error":"Too many login attempts, please try again later."}
```

## Test Scenario 5: Error Handling

### Test Invalid Location

```bash
curl http://localhost:3000/api/locations/invalid-slug/questionnaire
```

Expected: 404 error

### Test Missing Authentication

```bash
curl http://localhost:3000/api/admin/locations
```

Expected: 401 error

### Test Invalid Feedback Data

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: 400 error

## Manual UI Testing Checklist

### Feedback Page
- [ ] Page loads without errors
- [ ] Location name displays correctly
- [ ] Questionnaire name and description display
- [ ] Page indicator shows correct page numbers
- [ ] Scale buttons render with correct colors
- [ ] Button selection works and highlights selected button
- [ ] Text input accepts and stores text
- [ ] Navigation between pages works
- [ ] Previous button appears only after page 1
- [ ] Submit button shows "Submitting..." during submission
- [ ] Success screen appears after submission
- [ ] Auto-reset works after 3 seconds
- [ ] Responsive design works on mobile

### Admin Page
- [ ] Login form displays correctly
- [ ] Invalid credentials show error message
- [ ] Valid credentials grant access
- [ ] Dashboard displays after login
- [ ] Navigation tabs work
- [ ] Logout button works
- [ ] Token persists on page refresh (until logout)

### Error States
- [ ] Loading spinner shows while fetching data
- [ ] Error message displays for invalid location
- [ ] Retry button works after error
- [ ] Network errors are handled gracefully

## Performance Testing

### Load Testing (Optional)

Use tools like Apache Bench or Artillery for load testing:

```bash
# Test feedback endpoint with 100 concurrent requests
ab -n 1000 -c 100 -p feedback.json -T application/json \
  http://localhost:3000/api/feedback
```

## Browser Compatibility

Test in multiple browsers:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Known Limitations

1. Word cloud questions are not yet implemented (shows placeholder)
2. Admin CRUD interfaces show placeholders
3. Results visualization is basic (raw data only)
4. Single admin user (hardcoded credentials)

## Reporting Issues

If you find bugs or issues during testing:

1. Note the exact steps to reproduce
2. Include error messages or console logs
3. Specify browser and version
4. Check if the issue persists after clearing cache
5. Document expected vs actual behavior

## Success Criteria

The application passes testing if:

✅ Users can submit feedback through the UI
✅ Multi-page questionnaires work correctly
✅ Admin can login and view dashboard
✅ API endpoints return correct data
✅ Rate limiting prevents abuse
✅ Error handling works properly
✅ UI is responsive and touch-friendly
✅ Data persists correctly in database
