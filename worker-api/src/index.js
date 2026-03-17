import { handleApiRequest } from '../../src/server/api-handler.js';

export default {
  async fetch(request, env) {
    return handleApiRequest(request, env);
  }
};