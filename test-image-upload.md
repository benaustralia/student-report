# Image Upload Testing Guide

## 🧪 **Testing Image Upload and Storage**

### **Current Implementation Status:**
✅ Firebase Storage configured  
✅ Image upload function implemented  
✅ File validation (type & size)  
✅ Image preview functionality  
✅ Auto-save with image upload  
✅ Storage security rules configured  

### **Test Scenarios:**

#### **1. Basic Image Upload Test**
1. **Navigate to**: http://localhost:5173
2. **Sign in** with your Google account
3. **Expand a teacher card** → **Expand a class** → **Expand a student card**
4. **Click the image upload area** (dashed border box)
5. **Select an image file** (PNG, JPG, etc.)
6. **Verify**:
   - Image preview appears immediately
   - File validation works (try non-image files)
   - Size validation works (try files > 5MB)

#### **2. Image Storage Test**
1. **Upload an image** as above
2. **Add some report text**
3. **Wait for auto-save** (2 seconds) or manually save
4. **Check Firebase Console**:
   - Go to Firebase Console → Storage
   - Look for: `images/students/{studentId}/{timestamp}_{filename}`
   - Verify image is stored correctly

#### **3. Image Retrieval Test**
1. **Refresh the page**
2. **Expand the same student card**
3. **Verify**:
   - Previously uploaded image loads
   - Image URL is stored in Firestore
   - Image displays correctly

#### **4. Error Handling Test**
1. **Try uploading non-image files** (should show error)
2. **Try uploading large files** > 5MB (should show error)
3. **Try uploading without network** (should show error)
4. **Verify error messages are user-friendly**

#### **5. Image Cleanup Test**
1. **Upload an image** to a student report
2. **Replace the image** with a different one
3. **Check Firebase Storage**:
   - Old image should be deleted
   - Only new image should remain
4. **Remove image entirely** using the "Remove" button
5. **Verify**:
   - Image is deleted from storage
   - Report shows no image

#### **6. Security Test**
1. **Check storage rules** in Firebase Console
2. **Verify**:
   - Only authenticated users can upload
   - Users can only access their own images
   - Images are stored in user-specific folders

### **Test Images to Use:**
- **Small image**: < 1MB (PNG, JPG)
- **Medium image**: 2-3MB (PNG, JPG)
- **Large image**: > 5MB (should fail)
- **Non-image file**: .txt, .pdf (should fail)

### **Expected Behavior:**
- ✅ **File Validation**: Only image files accepted
- ✅ **Size Validation**: Max 5MB limit
- ✅ **Preview**: Immediate image preview
- ✅ **Auto-save**: Saves automatically after 2 seconds
- ✅ **Storage**: Images stored in Firebase Storage
- ✅ **Retrieval**: Images load on page refresh
- ✅ **Image Cleanup**: Old images deleted when replaced
- ✅ **Remove Button**: Users can remove images entirely
- ✅ **Security**: Proper access controls

### **Debugging Tips:**
1. **Check browser console** for errors
2. **Check Firebase Console** for storage activity
3. **Check Network tab** for upload progress
4. **Verify authentication** status

### **Common Issues:**
- **Authentication errors**: Make sure user is signed in
- **Storage errors**: Check Firebase project configuration
- **File validation**: Ensure file is actually an image
- **Network errors**: Check internet connection

### **Test Results:**
- [ ] Basic upload works
- [ ] File validation works
- [ ] Size validation works
- [ ] Image preview works
- [ ] Auto-save works
- [ ] Storage works
- [ ] Retrieval works
- [ ] Image cleanup works (replacement)
- [ ] Remove button works
- [ ] Security rules work
- [ ] Error handling works

---

## 🚀 **Ready to Test!**

The development server is running at: **http://localhost:5173**

Start with the basic upload test and work through each scenario systematically.
