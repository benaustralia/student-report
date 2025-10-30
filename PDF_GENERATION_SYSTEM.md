# PDF Generation System - Implementation Summary

## Overview

This document describes the new background PDF generation system that pre-generates and stores PDFs to reduce Netlify function load during bulk downloads.

## Key Features

### 1. Validation Criteria

**PDF generation only occurs if a report has:**
- (a) An image (`artworkUrl`) AND
- (b) Written feedback of any length (`reportText`)

This validation is enforced in:
- `ReportPreview.tsx` - Individual PDF downloads
- `zipService.ts` - ZIP downloads (both `downloadClassAsZIP` and `generateClassZIP`)

### 2. Background PDF Generation

**Location:** `src/services/pdfGenerationService.ts`

When a teacher saves a report (via `StudentCard.tsx`), the system automatically:
1. Validates the report meets PDF criteria
2. Generates the PDF in the background (non-blocking)
3. Uploads the PDF to Firebase Storage at path: `pdfs/{reportId}/report.pdf`
4. Updates the Firestore report document with the `pdfUrl`

**Key Functions:**
- `isReportReadyForPDF(report)` - Validates criteria
- `generateAndStorePDF(...)` - Generates and stores PDF
- `generatePDFInBackground(...)` - Fire-and-forget background generation

### 3. Pre-generated PDF Usage in ZIP Downloads

**Location:** `src/services/zipService.ts`

ZIP downloads now:
1. First attempt to download pre-generated PDFs from Firebase Storage (if `pdfUrl` exists)
2. Fall back to on-demand generation only if:
   - No `pdfUrl` exists, OR
   - PDF download fails

This significantly reduces Netlify function invocations for bulk downloads.

### 4. Regeneration on Update

When a teacher updates a report:
1. If report no longer meets criteria → delete old PDF and clear `pdfUrl`
2. If report meets criteria → delete old PDF (if exists) and regenerate

### 5. Storage Rules

Updated `storage.rules` to allow authenticated users to read/write PDFs at:
- `pdfs/{reportId}/{allPaths=**}`

## Netlify Function Limits

### Hobby Plan Limits (as of 2024)
- **Function Invocations:** 125,000 per month (shared across all functions)
- **Function Execution Time:** 10 seconds per invocation
- **Build Minutes:** 300 hours (6 hours) per month
- **Concurrent Functions:** Limited (not officially stated, but typically 10-20)

### Impact Assessment

**Before (On-demand Generation):**
- Individual download: 1 invocation
- ZIP download (8 reports): 8 invocations
- Teacher-by-teacher download (50 reports): 50 invocations
- All reports download (200 reports): 200 invocations

**After (Pre-generated PDFs):**
- Background generation: 1 invocation per report save (distributed over time)
- ZIP download using stored PDFs: 0-1 invocations (only if download fails)
- On-demand fallback: Only if PDF doesn't exist or download fails

**Monthly Estimation (Example):**
- 200 reports saved/updated per month → 200 invocations (background)
- 50 ZIP downloads × 8 reports = 400 reports → ~0-50 invocations (mostly from storage)
- **Total: ~250 invocations/month** (well within 125,000 limit)

### Recommendations

1. **Monitor Function Usage:** Check Netlify dashboard monthly for function invocation count
2. **Batch Background Generation:** If needed, add queuing for bulk regeneration
3. **Error Handling:** System gracefully falls back to on-demand if storage fails
4. **Storage Costs:** Firebase Storage is typically cheaper than function invocations for PDF storage

## Files Modified

1. `src/types/index.ts` - Added `pdfUrl?: string` to `ReportData`
2. `src/services/pdfGenerationService.ts` - New service for PDF generation/storage
3. `src/components/StudentCard.tsx` - Triggers background PDF generation on save
4. `src/components/ReportPreview.tsx` - Added validation for PDF downloads
5. `src/services/zipService.ts` - Updated to use stored PDFs, added validation
6. `src/components/ClassCard.tsx` - Passes `pdfUrl` to ZIP service
7. `storage.rules` - Added rules for PDF storage access

## Testing Checklist

- [ ] Save report with both image and text → PDF should generate in background
- [ ] Save report with only image → PDF should NOT generate
- [ ] Save report with only text → PDF should NOT generate
- [ ] Update report to add image → PDF should regenerate
- [ ] Update report to remove image → PDF should be deleted
- [ ] Download individual PDF → Should validate criteria first
- [ ] Download ZIP with pre-generated PDFs → Should use stored PDFs
- [ ] Download ZIP without pre-generated PDFs → Should generate on-demand
- [ ] Check Firebase Storage → PDFs should be stored at `pdfs/{reportId}/report.pdf`
- [ ] Check Firestore → Reports should have `pdfUrl` field populated

