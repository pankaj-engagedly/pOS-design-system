// Todo API service — wraps all todo endpoints

import { apiFetch } from '../../../shared/services/api-client.js';

// --- Lists ---

export function getLists() {
  return apiFetch('/api/todos/lists');
}

export function createList(name) {
  return apiFetch('/api/todos/lists', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateList(id, data) {
  return apiFetch(`/api/todos/lists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteList(id) {
  return apiFetch(`/api/todos/lists/${id}`, { method: 'DELETE' });
}

export function reorderLists(orderedIds) {
  return apiFetch('/api/todos/lists/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

// --- Tasks ---

export function getTasks(listId) {
  return apiFetch(`/api/todos/lists/${listId}/tasks`);
}

export function createTask(data) {
  return apiFetch('/api/todos/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getTask(id) {
  return apiFetch(`/api/todos/tasks/${id}`);
}

export function updateTask(id, data) {
  return apiFetch(`/api/todos/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteTask(id) {
  return apiFetch(`/api/todos/tasks/${id}`, { method: 'DELETE' });
}

export function reorderTasks(listId, orderedIds) {
  return apiFetch(`/api/todos/tasks/reorder?list_id=${listId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

// --- Subtasks ---

export function addSubtask(taskId, title) {
  return apiFetch(`/api/todos/tasks/${taskId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function updateSubtask(id, data) {
  return apiFetch(`/api/todos/subtasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteSubtask(id) {
  return apiFetch(`/api/todos/subtasks/${id}`, { method: 'DELETE' });
}
