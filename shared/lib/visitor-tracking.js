/**
 * NON Visitor Tracking — canonical module
 *
 * Replaces 30+ inline implementations scattered across projects.
 * Import this instead of copying it.
 *
 * USAGE (HTML/vanilla):
 *   <script type="module">
 *     import { trackVisit } from 'https://nonarkara.org/_shared/lib/visitor-tracking.js';
 *     trackVisit({ dashboard: 'MY_SITE' });
 *   </script>
 *
 * USAGE (ES module project):
 *   import { trackVisit } from '../../../_shared/lib/visitor-tracking.js';
 *   trackVisit({ dashboard: 'MY_SITE' });
 *
 * USAGE (inline copy for pure-HTML sites — copy the IIFE at the bottom):
 *   Just copy the IIFE block and set the dashboard name.
 *
 * What it does:
 *   1. One ping per session (sessionStorage gate)
 *   2. Collects: hostname, page, referrer, UA, language, screen, timezone
 *   3. Geo-enriches with ipapi.co (country, region, city, IP) — free tier
 *   4. POSTs to Google Apps Script → Google Sheets VISITORS tab
 *   5. Fire-and-forget — never blocks the page
 *
 * Sheet: https://docs.google.com/spreadsheets/d/1DM66spLCh_PKJ0hncFBWVft_H-3UiePONynjTltSvQg
 * Apps Script endpoint: see SHEET_URL below
 */

const SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwzTwBNOseKkvkkjD-LH6B3GWrsFcwS6MTDbn7W5eb3zHxA-swtlHYuwJ3w5PAVXDhU7Q/exec';

const SESSION_KEY = 'non_v';

/**
 * Track a page visit.
 * @param {object} opts
 * @param {string} opts.dashboard  - Short name for the dashboard (e.g. 'SLIC', 'CONFLICT', 'NON')
 * @param {string} [opts.sessionKey] - Override the sessionStorage key (default: 'non_v')
 */
export async function trackVisit({ dashboard = 'UNKNOWN', sessionKey = SESSION_KEY } = {}) {
  // One ping per browser session
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');

  const base = {
    dashboard,
    hostname:  location.hostname,
    page:      location.href,
    referrer:  document.referrer || 'Direct',
    userAgent: navigator.userAgent,
    language:  navigator.language,
    screen:    `${screen.width}x${screen.height}`,
    timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const send = (payload) =>
    fetch(SHEET_URL, {
      method:  'POST',
      mode:    'no-cors',                    // Apps Script needs this
      headers: { 'Content-Type': 'text/plain' },  // not JSON — avoids preflight
      body:    JSON.stringify(payload),
    }).catch(() => {});                      // never throw

  // Try to geo-enrich; fall back to base if ipapi.co is down/rate-limited
  try {
    const geo = await fetch('https://ipapi.co/json/').then(r => r.json());
    base.ip      = geo.ip         ?? '';
    base.country = geo.country_name ?? '';
    base.region  = geo.region     ?? '';
    base.city    = geo.city       ?? '';
  } catch (_) {
    // geo failed — send anyway without geo fields
  }

  send(base);
}

/**
 * Inline IIFE version for pure-HTML sites that can't use ES modules.
 * Copy the block below, set the dashboard name, paste before </body>.
 *
 * ============================================================
 * <!-- NON visitor tracker — fire-and-forget, no cookies -->
 * <script>
 * (function(){
 *   if(sessionStorage.getItem('non_v'))return;
 *   sessionStorage.setItem('non_v','1');
 *   var SH='https://script.google.com/macros/s/AKfycbwzTwBNOseKkvkkjD-LH6B3GWrsFcwS6MTDbn7W5eb3zHxA-swtlHYuwJ3w5PAVXDhU7Q/exec';
 *   var b={dashboard:'CHANGE_ME',hostname:location.hostname,page:location.href,
 *     referrer:document.referrer||'Direct',userAgent:navigator.userAgent,
 *     language:navigator.language,screen:screen.width+'x'+screen.height,
 *     timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
 *   function send(p){fetch(SH,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(p)}).catch(function(){});}
 *   fetch('https://ipapi.co/json/').then(function(r){return r.json();}).then(function(d){
 *     b.ip=d.ip;b.country=d.country_name;b.region=d.region;b.city=d.city;send(b);
 *   }).catch(function(){send(b);});
 * })();
 * </script>
 * ============================================================
 */
