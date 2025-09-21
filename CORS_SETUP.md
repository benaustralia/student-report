# Firebase Storage CORS Configuration

## Problem
Firebase Storage images are blocked by CORS policy when generating PDFs with jsPDF and svg2pdf.

## Solution
Configure CORS on your Firebase Storage bucket to allow requests from your application domains.

## Setup Instructions

### 1. Install Google Cloud SDK
Download and install from: https://cloud.google.com/storage/docs/gsutil_install

### 2. Authenticate and Set Project
```bash
gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]
```

### 3. Apply CORS Configuration
```bash
gsutil cors set cors.json gs://[YOUR_BUCKET_NAME]
```

### 4. Verify Configuration
```bash
gsutil cors get gs://[YOUR_BUCKET_NAME]
```

## Configuration Details

The `cors.json` file includes:
- **localhost:5173**: For Vite development server
- **localhost:3000**: For alternative development ports
- **https://nsastudentreports.netlify.app**: Production domain

## Important Notes

1. **Production Domain**: Already configured for https://nsastudentreports.netlify.app
2. **Bucket Name**: Find your bucket name in Firebase Console → Storage
3. **Project ID**: Find your project ID in Firebase Console → Project Settings

## After Configuration

Once CORS is configured, the simplified image loading code will work without fallbacks:

```typescript
// Simple, clean approach
const img = new Image();
img.crossOrigin = 'anonymous';
img.src = firebaseStorageUrl;

// Convert to data URL using canvas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
```

## Troubleshooting

- Clear browser cache after CORS changes
- Test in incognito mode
- Check browser network tab for CORS errors
- Verify bucket name matches exactly
