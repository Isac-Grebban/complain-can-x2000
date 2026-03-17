import { handleApiRequest } from '../../src/server/api-handler.js';

export async function onRequest(context) {
  return handleApiRequest(context.request, context.env);
}