/**
 * Where the dashboard's API calls go: the VM's backends, called directly from the browser.
 * Change these two lines to point the dashboard at another server.
 *
 * Note: a page served over https (Firebase Hosting) may only call https addresses; browsers block
 * http calls from it ("mixed content"). Plain http works for a dashboard opened on http://localhost.
 */
// Caddy on the VM serves https for 34-47-209-106.sslip.io and forwards /bolna/* to bolna-app and
// /telephony/* to plivo-app (/opt/caddy/Caddyfile on the VM).
export const BOLNA_API_URL = "https://34-47-209-106.sslip.io/bolna"; // bolna-app: agents, call history, login
export const TELEPHONY_API_URL = "https://34-47-209-106.sslip.io/telephony"; // plivo-app: placing calls
