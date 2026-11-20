/**
 * Where the dashboard's API calls go: the VM's backends, called directly from the browser.
 * Change these two lines to point the dashboard at another server.
 *
 * Note: a page served over https (Firebase Hosting) may only call https addresses; browsers block
 * http calls from it ("mixed content"). Plain http works for a dashboard opened on http://localhost.
 */
export const BOLNA_API_URL = "http://34.47.209.106:5001"; // bolna-app: agents, call history, login
export const TELEPHONY_API_URL = "http://34.47.209.106:8002"; // plivo-app: placing calls
