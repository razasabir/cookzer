// Public Bunny Stream video library ID. Safe to commit — it only says
// which library to play videos from, it's not a credential. Uploads are
// gated by a server-side signed TUS token minted in
// api/create-video-upload.js, which holds the real (secret) Bunny API
// key as a Vercel environment variable, never exposed here.
//
// Fill this in after creating a Bunny Stream video library
// (bunny.net dashboard -> Stream -> add library -> the numeric Library ID
// shown on its overview page).
const BUNNY_LIBRARY_ID = '752707';
