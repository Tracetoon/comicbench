Uploads that time out now retry up to three times with exponential backoff
(1s, 2s, 4s) instead of failing the build on the first timeout.

Where to start: `uploadWithRetry` in `src/upload.ts`.
