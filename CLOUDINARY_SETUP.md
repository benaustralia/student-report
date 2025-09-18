# Cloudinary Setup Guide

This application now uses Cloudinary for image storage instead of Firebase Storage. Follow these steps to set up Cloudinary:

## 1. Create a Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com) and sign up for a free account
2. Once logged in, go to your [Dashboard](https://cloudinary.com/console)

## 2. Get Your Credentials

From your Cloudinary dashboard, you'll need:
- **Cloud Name** (found in the dashboard)

## 3. Create Upload Preset

1. Go to your Cloudinary dashboard
2. Navigate to **Settings** → **Upload**
3. Click **Add upload preset**
4. Set the preset name to `student-reports`
5. Set **Signing Mode** to **Unsigned** (this allows client-side uploads)
6. Configure any other settings you want (folder, quality, format, etc.)
7. Click **Save**

## 4. Set Environment Variables

Create a `.env` file in the root directory with:

```env
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=student-reports
```

**Important:** 
- Replace the placeholder values with your actual credentials
- Never commit the `.env` file to version control
- The `VITE_` prefix is required for Vite to expose these variables to the client

## 5. Security Best Practices

**⚠️ NEVER hardcode API keys in your source code!**

The application uses unsigned uploads with upload presets, which is secure for client-side operations. No API keys are exposed to the browser.

## 6. Test the Setup

1. Start the development server: `npm run dev`
2. Try uploading an image in the student report form
3. Check your Cloudinary dashboard to see the uploaded images

## Features

- **Automatic optimization**: Images are automatically optimized for web delivery
- **Multiple formats**: Automatic format selection (WebP, AVIF, etc.)
- **Responsive images**: Different sizes for different screen sizes
- **Secure URLs**: All images are served over HTTPS
- **Organized storage**: Images are stored in folders by student ID

## Troubleshooting

- **Upload fails**: Check your API credentials and network connection
- **Images not displaying**: Verify the Cloudinary URL format
- **Permission errors**: Ensure your API key has upload permissions

## Migration from Firebase Storage

If you have existing images in Firebase Storage, you'll need to:
1. Download them from Firebase Storage
2. Upload them to Cloudinary
3. Update the database records with new Cloudinary URLs

The application will automatically use Cloudinary for all new image uploads.
