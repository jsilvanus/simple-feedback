# Location Grouping Feature

## Overview

The location grouping feature allows you to organize locations into logical groups and publish questionnaires to entire groups at once. This is useful for managing multiple locations that should receive the same content.

## Key Concepts

### Location Groups
A location group is a collection of related locations. For example:
- All locations in a specific building
- All reception areas across multiple sites
- All customer service kiosks in a region

### Group-Level Schedules
Instead of creating separate schedules for each location, you can create a single schedule that targets a location group. All locations in that group will receive the scheduled questionnaire.

### Schedule Priority
When a location requests its active questionnaire, the system follows this priority:
1. **Location-specific schedules** - Schedules directly assigned to the location
2. **Group-level schedules** - Schedules assigned to the location's group (fallback)

This allows you to set a default questionnaire for a group while still being able to override it for specific locations.

## Usage

### Creating Location Groups

1. Navigate to the Admin Dashboard
2. Click on the "Location Groups" tab
3. Click "+ Add Location Group"
4. Fill in the form:
   - **Name**: A descriptive name for the group (required)
   - **Description**: Optional details about the group's purpose
   - **Active**: Whether the group is active
5. Click "Create"

### Assigning Locations to Groups

1. Navigate to the "Locations" tab
2. Click "Edit" on the location you want to assign
3. Select a group from the "Location Group" dropdown
4. Click "Update"

To remove a location from a group, select "No Group" in the dropdown.

### Creating Group-Level Schedules

1. Navigate to the "Schedules" tab
2. Click "+ Add Schedule"
3. In the "Publish To" section, select "Location Group"
4. Choose the desired location group from the dropdown
5. Configure the rest of the schedule (questionnaires, time, etc.)
6. Click "Create"

### Example Use Cases

#### Use Case 1: Default Questionnaire for All Locations
Create a location group called "All Locations" and assign all your locations to it. Then create a recurring schedule for this group with your standard feedback questionnaire. This provides a fallback questionnaire for all locations.

#### Use Case 2: Regional Management
Create groups like "North Region", "South Region", etc. Assign locations to their respective regions. You can then:
- Deploy region-specific questionnaires
- Override with location-specific schedules when needed
- Easily manage regional campaigns

#### Use Case 3: Location Types
Group locations by type: "Reception Areas", "Service Counters", "Waiting Rooms". Deploy type-specific questionnaires to each group.

## API Reference

### Location Group Endpoints

#### List Location Groups
```
GET /api/admin/location-groups
```
Returns all location groups.

#### Create Location Group
```
POST /api/admin/location-groups
Body: {
  "name": "string",
  "description": "string",
  "active": boolean
}
```

#### Update Location Group
```
PUT /api/admin/location-groups/:id
Body: {
  "name": "string",
  "description": "string",
  "active": boolean
}
```

#### Delete Location Group
```
DELETE /api/admin/location-groups/:id
```
Note: Deleting a group will unassign all locations from the group but won't delete the locations.

### Modified Endpoints

#### Create Schedule with Group
```
POST /api/admin/schedules
Body: {
  "locationGroupId": integer,  // Use this OR locationId, not both
  "questionnaireIds": [integer],
  "scheduleType": "date_based" | "recurring_weekday",
  "startTime": "ISO 8601",
  "endTime": "ISO 8601",
  ...
}
```

#### Assign Location to Group
```
PUT /api/admin/locations/:id
Body: {
  "groupId": integer | null,
  ...
}
```

## Database Schema

### New Tables

#### `location_groups`
- `id` (Primary Key)
- `name` (VARCHAR 255, required)
- `description` (TEXT, nullable)
- `active` (BOOLEAN, default: true)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Modified Tables

#### `locations`
- Added: `group_id` (Foreign Key to location_groups, nullable)

#### `schedules`
- Added: `location_group_id` (Foreign Key to location_groups, nullable)
- Modified: `location_id` is now nullable
- Added: CHECK constraint to ensure either location_id OR location_group_id is set (not both)

## Migration

To apply the location grouping feature to an existing database:

```bash
# Run the migration script
psql -h localhost -U postgres -d simple_feedback -f backend/src/db/migrations/004_add_location_groups.sql
```

Or rebuild the database from the updated schema:
```bash
npm run db:init
```

## Best Practices

1. **Use Descriptive Names**: Give groups clear, descriptive names that make their purpose obvious
2. **Keep Groups Logical**: Group locations that truly share common characteristics
3. **Start with Groups**: If you have many locations, set up groups first before creating schedules
4. **Test Fallback Behavior**: Verify that group-level schedules work as expected before deploying
5. **Document Your Strategy**: Keep track of which groups are used for what purpose

## Troubleshooting

### Location Not Receiving Group Schedule
- Verify the location is assigned to the group
- Check that the group schedule is active and within its time window
- Confirm there isn't a location-specific schedule overriding the group schedule

### Can't Create Schedule for Group
- Ensure you're providing either `locationId` OR `locationGroupId`, not both
- Verify the group exists and is active
- Check that you have valid questionnaire IDs

### Group Delete Fails
- Check if there are active schedules targeting the group
- Verify you have proper authentication

## Future Enhancements

Potential future improvements:
- Nested groups (groups within groups)
- Group-based access control
- Bulk operations on group members
- Group analytics and reporting
