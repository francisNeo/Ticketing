import axios from 'axios';
import { getErrorMessage } from '../utils/errors';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eventhub_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('eventhub_refresh');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`, { refreshToken });
          localStorage.setItem('eventhub_token', data.accessToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    // Normalise the error so every catch block gets a clean `.message`
    err.message = getErrorMessage(err);
    return Promise.reject(err);
  }
);

export default api;

export const eventsApi = {
  list: (params) => api.get('/events', { params }),
  get: (slugOrToken) => api.get(`/events/${slugOrToken}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  publish: (id) => api.post(`/events/${id}/publish`),
  cancel: (id) => api.delete(`/events/${id}`),
  registrations: (id) => api.get(`/events/${id}/registrations`),
  export: (id) => api.get(`/events/${id}/export`, { responseType: 'blob' }),
  myEvents: () => api.get('/organiser/events'),
};

export const ticketTypesApi = {
  create: (eventId, data) => api.post(`/ticket-types/events/${eventId}/ticket-types`, data),
  update: (id, data) => api.put(`/ticket-types/${id}`, data),
  remove: (id) => api.delete(`/ticket-types/${id}`),
};


export const otpApi = {
  autoVerify: (data) => api.post('/otp/auto-verify', data),
  send: (data) => api.post('/otp/send', data),
  verify: (data) => api.post('/otp/verify', data),
};

export const registrationsApi = {
  create: (data) => api.post('/registrations', data),
  get: (id) => api.get(`/registrations/${id}`),
  checkin: (id) => api.post(`/registrations/${id}/checkin`),
  templateUrl: (eventId) => `/api/v1/registrations/events/${eventId}/registration-template`,
  bulkRegister: (eventId, formData) => api.post(
    `/registrations/events/${eventId}/bulk-register`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
};

export const paymentsApi = {
  createStripeIntent: (registrationId) => api.post('/payments/stripe/create-intent', { registrationId }),
  mpesaStkPush: (data) => api.post('/payments/mpesa/stk-push', data),
  pollStatus: (registrationId) => api.get(`/payments/${registrationId}/status`),
};

export const bundlesApi = {
  list: () => api.get('/bundles'),
  balance: () => api.get('/organiser/bundle-balance'),
  purchases: () => api.get('/organiser/bundle-purchases'),
  purchaseStripe: (id) => api.post(`/bundles/${id}/purchase/stripe`),
  purchaseMpesa: (id, phone) => api.post(`/bundles/${id}/purchase/mpesa`, { phone }),
};

export const churchConfigApi = {
  getActive: () => api.get('/church-config'),
  getAll: () => api.get('/church-config/all'),
  create: (data) => api.post('/church-config', data),
  update: (id, data) => api.put(`/church-config/${id}`, data),
  delete: (id) => api.delete(`/church-config/${id}`),
};

export const notificationsApi = {
  list: (eventId) => api.get(`/notifications/events/${eventId}/notifications`),
  preview: (eventId, data) => api.post(`/notifications/events/${eventId}/notifications/preview`, data),
  send: (eventId, data) => api.post(`/notifications/events/${eventId}/notifications/send`, data),
};
