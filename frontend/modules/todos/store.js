// Todo module state store

import { createStore } from '../../shared/services/state-store.js';

const todoStore = createStore({
  lists: [],
  selectedListId: null,
  selectedView: null, // 'inbox', 'today', 'upcoming', 'completed', or null (list mode)
  tasks: [],       // tasks for current list view
  allTasks: [],    // tasks from all lists (for smart views)
  loading: false,
  error: null,
});

export default todoStore;
