# Shorts storage setup

New uploads try YouTube first, then Backblaze B2, then Vercel Blob. Existing Shorts stay in their current storage and remain visible.

## Vercel Production variables for Backblaze
- B2_APPLICATION_KEY_ID
- B2_APPLICATION_KEY
- B2_BUCKET_ID
- B2_BUCKET_NAME

Keep these values in Vercel Environment Variables; never add them to GitHub or index.html. The bucket must be public for viewers to stream B2 videos. The application key should be limited to this bucket and permit uploading and deleting files.

For direct browser uploads, configure bucket CORS to allow your production website origin, operation b2_upload_file, and headers authorization, x-bz-file-name, x-bz-content-sha1, content-type. If B2 is missing or CORS blocks an upload, the app falls through to Vercel Blob.

YouTube videos are uploaded as Unlisted and played inside the Shorts feed. Deleting a YouTube entry from the app removes its Firebase record; remove the actual video separately in YouTube Studio if desired.