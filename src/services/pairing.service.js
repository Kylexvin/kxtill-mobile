// src/services/pairing.service.js

import { api } from './api';

export async function redeem(token, deviceLabel) {
  const { data } = await api.post('/api/v1/auth/pairing/redeem', {
    token,
    deviceLabel: deviceLabel || null,
  });
  return data;
}

export default { redeem };