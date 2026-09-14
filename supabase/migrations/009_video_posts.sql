-- Video posts: a post can carry a short video (hosted on Bunny Stream)
-- instead of a photo. Playback is via Bunny's public player embed, keyed
-- by this UID plus the public BUNNY_LIBRARY_ID in bunny-config.js. The
-- upload itself goes straight from the browser to Bunny, signed by the
-- api/create-video-upload.js serverless function so the real Bunny API
-- key never reaches the client. Run after 008.

alter table public.posts
  add column video_uid text;
