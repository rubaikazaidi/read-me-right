

## Problem Analysis

The `QRCodeScanner` component has strict barcode validation that rejects barcodes not matching ISBN-13/10/EAN patterns (lines 186-201). Some book barcodes may use different numeric formats, causing them to be rejected with an "Invalid Barcode" toast before they ever reach the `ScanIssueBookDialog` where the "Add This Book to Library" button would appear.

Additionally, the format detection logic defaults unknown formats to QR code (line 142: `!format` → treats as QR), which then fails UUID validation and shows "Invalid QR Code" instead of trying it as a barcode.

## Plan

### 1. Relax barcode validation in `QRCodeScanner.tsx`

**Current behavior:** Only passes through barcodes matching strict ISBN-13/10/EAN regex patterns. Anything else shows "Invalid Barcode" error.

**New behavior:** Accept any numeric barcode (even if not a standard ISBN) and pass it through as type `"isbn"`. The downstream `ScanIssueBookDialog` already handles the "not found" case with an "Add This Book" button.

Changes in `handleCodeScanned`:
- In the barcode branch: accept any numeric string of 8+ digits instead of only ISBN/EAN patterns
- In the unknown format branch: try barcode detection before defaulting to QR code
- Remove the strict ISBN-only validation that blocks non-standard barcodes

### 2. No changes needed in `ScanIssueBookDialog`

The dialog already correctly:
- Shows "Book not found" with the ISBN when no database match exists
- Displays an "Add This Book to Library" button (when `onAddBook` prop is provided)
- Both `LibrarianDashboard` and `Index.tsx` already pass `onAddBook={handleAddBookFromScan}`

### Technical Details

In `src/components/QRCodeScanner.tsx`, the barcode validation block (lines 181-202) will be updated to:
- Accept any barcode with 8+ digits as a potential book identifier
- Keep ISBN format detection for display purposes but not as a gate
- Fix the fallback logic for unknown formats to prefer barcode interpretation for numeric strings

