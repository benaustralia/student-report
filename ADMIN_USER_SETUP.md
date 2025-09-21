# Admin User Setup Guide

## Overview
This guide explains how to pre-create admin users without requiring them to sign in with Google Auth first.

## How It Works

### 1. Pre-Creation Phase (No Sign-in Required)
- Admin users are created in Firestore with random document IDs
- They have a `needsUidUpdate: true` flag
- Users can be created via:
  - JSON import in AdminPanel
  - Migration script
  - Direct database entry
  - Custom script

### 2. Automatic Update Phase (When User Signs In)
- When a pre-created admin user signs in with Google Auth
- The system automatically:
  - Finds their pre-created document by email
  - Creates a new document with their Firebase Auth UID as the document ID
  - Deletes the old document with random ID
  - Removes the `needsUidUpdate` flag

## Methods to Create Admin Users

### Method 1: JSON Import (AdminPanel)
```javascript
// In AdminPanel.tsx, use the existing import functionality
// The system will automatically handle pre-creation
```

### Method 2: Migration Script
```javascript
import { preCreateAdminUser } from './src/services/firebaseService';

// Pre-create admin users
await preCreateAdminUser('newadmin@gmail.com', 'John', 'Doe');
```

### Method 3: Custom Script
```bash
# Use the create-admin-users.js script
node create-admin-users.js
```

### Method 4: Direct Database Entry
```javascript
// In Firebase Console or programmatically
{
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "User", 
  isAdmin: true,
  needsUidUpdate: true,
  createdAt: new Date(),
  updatedAt: new Date()
}
```

## Firestore Rules

The rules support both approaches:
- **UID-based**: `isAdmin()` function checks `adminUsers/{request.auth.uid}`
- **Email-based**: `isAdminByEmail()` function checks hardcoded emails as fallback

## API Functions

### Pre-Create Admin User
```javascript
import { preCreateAdminUser } from './src/services/firebaseService';

await preCreateAdminUser('user@example.com', 'First', 'Last');
```

### Check Admin Status
```javascript
import { isUserAdmin, isUserAdminByUid } from './src/services/firebaseService';

// Check by email
const isAdmin = await isUserAdmin('user@example.com');

// Check by UID (when user is signed in)
const isAdminByUid = await isUserAdminByUid(user.uid);
```

### Update Pre-Created User (Automatic)
```javascript
import { updatePreCreatedAdminUser } from './src/services/firebaseService';

// This runs automatically when user signs in
await updatePreCreatedAdminUser(user.email, user.uid);
```

## Complete Workflow

1. **Admin creates user account**:
   ```javascript
   await preCreateAdminUser('newuser@gmail.com', 'New', 'User');
   ```

2. **User signs in with Google Auth**:
   - System automatically detects pre-created account
   - Updates document ID to match Firebase Auth UID
   - User now has full admin access

3. **Admin access is granted**:
   - Firestore rules allow access
   - Application recognizes admin status
   - User can access admin features

## Benefits

✅ **No sign-in required for creation**  
✅ **Automatic UID mapping when user signs in**  
✅ **Backward compatible with existing system**  
✅ **Supports both UID-based and email-based admin checks**  
✅ **Handles edge cases and errors gracefully**

## Example Usage

```javascript
// Pre-create multiple admin users
const adminUsers = [
  { email: 'admin1@company.com', firstName: 'Admin', lastName: 'One' },
  { email: 'admin2@company.com', firstName: 'Admin', lastName: 'Two' }
];

for (const user of adminUsers) {
  await preCreateAdminUser(user.email, user.firstName, user.lastName);
  console.log(`Pre-created admin: ${user.email}`);
}

console.log('All admin users pre-created! They will be activated when they sign in.');
```
