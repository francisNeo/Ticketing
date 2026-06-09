/**
 * Extract a clean, human-readable error message from any API error.
 * Works with:
 *   - Axios errors (err.response.data.error or err.response.data.errors[])
 *   - Raw Zod arrays (legacy, before backend fix)
 *   - Network errors (no response)
 *   - Plain Error objects
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;

  // Axios response error
  if (err.response) {
    const data = err.response.data;

    // Our standard shape: { error: "..." }
    if (typeof data?.error === 'string' && data.error.length) return data.error;

    // Array of errors — pick the first
    if (Array.isArray(data?.errors) && data.errors.length) return data.errors[0];

    // Raw Zod array (legacy)
    if (Array.isArray(data) && data[0]?.message) return data[0].message;

    // HTTP status fallbacks
    switch (err.response.status) {
      case 400: return data?.message || 'Invalid input. Please check your details.';
      case 401: return 'Your session has expired. Please log in again.';
      case 403: return 'You do not have permission to do that.';
      case 404: return 'The requested item was not found.';
      case 409: return data?.message || 'This record already exists.';
      case 422: return data?.message || 'Please check your input and try again.';
      case 429: return 'Too many requests. Please wait a moment and try again.';
      case 500: return 'Server error. Please try again in a moment.';
      default:  return data?.message || fallback;
    }
  }

  // Network error (no internet / server down)
  if (err.request) return 'Network error. Please check your internet connection.';

  // Plain JS error
  if (err.message) return err.message;

  return fallback;
}
