// Public, build-time configuration. These are safe to ship to the browser.

export const COUPLE = import.meta.env.VITE_COUPLE || 'Bricx & Hannah';

const RAW_DATE = import.meta.env.VITE_WEDDING_DATE || '2027-02-06';

export const WEDDING_DATE = new Date(`${RAW_DATE}T00:00:00`);

export const WEDDING_DATE_LABEL = (() => {
  try {
    return WEDDING_DATE.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'February 6, 2027';
  }
})();

export const APP_URL = import.meta.env.VITE_APP_URL || '';
