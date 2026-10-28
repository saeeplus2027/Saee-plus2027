/* Saee Plus shared API configuration.
 * This URL must match the Cloudflare Worker deployed from cloudflare/worker.js.
 * After deployment, copy the exact workers.dev URL from Cloudflare here.
 * Do not set SAI_REMOTE=false: that disables cross-device editing.
 */
window.SAI_REMOTE = true;
window.SAI_API_BASE = "https://saee-plus-api.ligagym.workers.dev";
