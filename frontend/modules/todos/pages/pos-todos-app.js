// pos-todos-app — Main todos page composing sidebar + task list
// Composes: ui-app-layout, pos-list-sidebar, pos-task-list

import '../../../shared/components/pos-module-layout.js';
import '../components/pos-todo-sidebar.js';
import '../components/pos-task-list.js';
import '../components/pos-task-detail.js';
import '../components/pos-subtask-list.js';
import * as todoApi from '../services/todo-api.js';
import * as attachmentApi from '../services/attachment-api.js';
import todoStore from '../store.js';

const STORAGE_KEY = 'pos-todos-selected';

class PosTodosApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsubscribe = null;
  }

  connectedCallback() {
    this.render();
    this._unsubscribe = todoStore.subscribe(() => this.update());
    this._restoreSelection();
    this.loadLists();
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe();
  }

  _restoreSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        if (saved.view) {
          todoStore.setState({ selectedView: saved.view, selectedListId: null });
        } else if (saved.listId) {
          todoStore.setState({ selectedListId: saved.listId, selectedView: null });
        }
      }
    } catch { /* ignore */ }
  }

  _persistSelection() {
    const state = todoStore.getState();
    if (state.selectedView) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ view: state.selectedView }));
    } else if (state.selectedListId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ listId: state.selectedListId }));
    }
  }

  async loadLists() {
    todoStore.setState({ loading: true });
    try {
      const lists = await todoApi.getLists();
      const state = todoStore.getState();

      // If no selection was restored, default to inbox (first list)
      let selectedListId = state.selectedListId;
      let selectedView = state.selectedView;

      if (!selectedView && !selectedListId) {
        selectedView = 'inbox';
      }

      // Validate persisted list still exists
      if (selectedListId && !lists.find(l => l.id === selectedListId)) {
        selectedListId = null;
        selectedView = 'inbox';
      }

      todoStore.setState({ lists, selectedListId, selectedView, loading: false });
      this._persistSelection();

      // Load all tasks for smart view counts
      await this._loadAllTasks(lists);

      // Load tasks for current view
      this._loadCurrentView();
    } catch (err) {
      todoStore.setState({ error: err.message, loading: false });
    }
  }

  async _loadAllTasks(lists) {
    try {
      const allLists = lists || todoStore.getState().lists;
      const allTaskArrays = await Promise.all(
        allLists.map(l => todoApi.getTasks(l.id).catch(() => []))
      );
      const allTasks = allTaskArrays.flat();
      todoStore.setState({ allTasks });
    } catch (err) {
      console.warn('Failed to load all tasks for smart views:', err);
    }
  }

  async _refreshAll() {
    const lists = await todoApi.getLists();
    await this._loadAllTasks(lists);
    todoStore.setState({ lists });
    this._loadCurrentView();
  }

  async _refreshTaskEdit(taskId) {
    try {
      const task = await todoApi.getTask(taskId);
      const detail = this.shadow.querySelector('pos-task-detail');
      detail?.refreshTask(task);
      if (task.attachment_ids?.length > 0) {
        const metadata = await attachmentApi.batchGetMetadata(task.attachment_ids);
        detail?.setAttachments(metadata);
      } else {
        detail?.setAttachments([]);
      }
    } catch { /* ignore */ }
  }

  async _loadAttachmentsForEdit(taskId) {
    return this._refreshTaskEdit(taskId);
  }

  _loadCurrentView() {
    const state = todoStore.getState();
    if (state.selectedView) {
      this._applySmartView(state.selectedView);
    } else if (state.selectedListId) {
      this.loadTasks(state.selectedListId);
    }
  }

  async loadTasks(listId) {
    try {
      const tasks = await todoApi.getTasks(listId);
      todoStore.setState({ tasks });
    } catch (err) {
      todoStore.setState({ error: err.message });
    }
  }

  _applySmartView(view) {
    const state = todoStore.getState();
    const allTasks = state.allTasks || [];
    const today = new Date().toISOString().slice(0, 10);

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    let filtered;
    switch (view) {
      case 'inbox':
        filtered = allTasks.filter(t => t.status !== 'done');
        break;
      case 'today':
        filtered = allTasks.filter(t => t.due_date === today && t.status !== 'done');
        break;
      case 'tomorrow':
        filtered = allTasks.filter(t => t.due_date === tomorrow && t.status !== 'done');
        break;
      case 'upcoming':
        filtered = allTasks.filter(t => t.due_date && t.due_date > today && t.status !== 'done');
        break;
      case 'completed':
        filtered = allTasks.filter(t => t.status === 'done');
        break;
      default:
        filtered = [];
    }

    // Enrich with list_name for smart views
    const listMap = new Map(state.lists.map(l => [l.id, l.name]));
    filtered = filtered.map(t => ({ ...t, list_name: listMap.get(t.list_id) || '' }));

    todoStore.setState({ tasks: filtered });
  }

  _getSmartCounts() {
    const allTasks = todoStore.getState().allTasks || [];
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return {
      inbox: allTasks.filter(t => t.status !== 'done').length,
      today: allTasks.filter(t => t.due_date === today && t.status !== 'done').length,
      tomorrow: allTasks.filter(t => t.due_date === tomorrow && t.status !== 'done').length,
      upcoming: allTasks.filter(t => t.due_date && t.due_date > today && t.status !== 'done').length,
      completed: allTasks.filter(t => t.status === 'done').length,
    };
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; }

        .main {
          position: relative;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
      </style>

      <pos-module-layout panel-width="220">
        <pos-todo-sidebar slot="panel"></pos-todo-sidebar>
        <div class="main">
          <pos-task-list></pos-task-list>
          <pos-task-detail id="task-detail"></pos-task-detail>
        </div>
      </pos-module-layout>
    `;

    this.bindEvents();
  }

  update() {
    const state = todoStore.getState();
    const sidebar = this.shadow.querySelector('pos-todo-sidebar');
    const taskList = this.shadow.querySelector('pos-task-list');

    if (sidebar) {
      sidebar.lists = state.lists;
      sidebar.selectedId = state.selectedListId;
      sidebar.selectedView = state.selectedView;
      sidebar.smartCounts = this._getSmartCounts();
    }

    if (taskList) {
      taskList.tasks = state.tasks;
      taskList.viewMode = state.selectedView || null;

      if (state.selectedView) {
        const viewLabels = { inbox: 'Inbox', today: 'Today', tomorrow: 'Tomorrow', upcoming: 'Upcoming', completed: 'Completed' };
        taskList.listName = viewLabels[state.selectedView] || '';
      } else {
        const selectedList = state.lists.find(l => l.id === state.selectedListId);
        taskList.listName = selectedList ? selectedList.name : '';
      }
    }
  }

  bindEvents() {
    // Smart view selection
    this.shadow.addEventListener('smart-view-select', (e) => {
      const view = e.detail.view;
      todoStore.setState({ selectedView: view, selectedListId: null, tasks: [] });
      this._persistSelection();
      this._applySmartView(view);
    });

    // List selection
    this.shadow.addEventListener('list-select', (e) => {
      const listId = e.detail.listId;
      todoStore.setState({ selectedListId: listId, selectedView: null, tasks: [] });
      this._persistSelection();
      this.loadTasks(listId);
    });

    // Create new list
    this.shadow.addEventListener('list-create', async (e) => {
      try {
        const newList = await todoApi.createList(e.detail.name);
        const state = todoStore.getState();
        todoStore.setState({
          lists: [...state.lists, newList],
          selectedListId: newList.id,
          selectedView: null,
          tasks: [],
        });
        this._persistSelection();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Rename list
    this.shadow.addEventListener('list-rename', async (e) => {
      const { listId, name } = e.detail;
      try {
        await todoApi.updateList(listId, { name });
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Delete list
    this.shadow.addEventListener('list-delete', async (e) => {
      const { listId } = e.detail;
      try {
        await todoApi.deleteList(listId);
        const state = todoStore.getState();
        // If deleted list was selected, fall back to inbox
        const wasSelected = state.selectedListId === listId;
        await this._refreshAll();
        if (wasSelected) {
          todoStore.setState({ selectedView: 'inbox', selectedListId: null });
          this._persistSelection();
          this._applySmartView('inbox');
        }
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Create new task — list_id may be supplied by grouped add button
    const handleTaskCreate = async (detail) => {
      const state = todoStore.getState();
      const { list_id: hintListId, ...taskData } = detail;

      let listId = hintListId || state.selectedListId;
      if (!listId && state.selectedView === 'inbox' && state.lists.length > 0) {
        listId = state.lists[0].id;
      }
      if (!listId && state.lists.length > 0) {
        listId = state.lists[0].id;
      }
      if (!listId) return;

      try {
        await todoApi.createTask({ list_id: listId, ...taskData });
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    };
    this.shadow.addEventListener('task-create', (e) => handleTaskCreate(e.detail));

    // Toggle task status
    this.shadow.addEventListener('toggle-status', async (e) => {
      const { taskId, done } = e.detail;
      try {
        await todoApi.updateTask(taskId, { status: done ? 'done' : 'todo' });
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Select task — open detail flyout
    this.shadow.addEventListener('select-task', async (e) => {
      const { taskId } = e.detail;
      try {
        const task = await todoApi.getTask(taskId);
        const detail = this.shadow.querySelector('pos-task-detail');
        if (detail) {
          detail.openForTask(task);
          if (task.attachment_ids && task.attachment_ids.length > 0) {
            const metadata = await attachmentApi.batchGetMetadata(task.attachment_ids);
            detail.setAttachments(metadata);
          }
        }
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Task edit (update)
    this.shadow.addEventListener('task-update', async (e) => {
      const { taskId, ...data } = e.detail;
      try {
        await todoApi.updateTask(taskId, data);
        await Promise.all([this._refreshAll(), this._refreshTaskEdit(taskId)]);
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Task reorder (drag & drop)
    this.shadow.addEventListener('task-reorder', async (e) => {
      const { orderedIds, listId } = e.detail;
      if (!listId || !orderedIds?.length) return;
      try {
        await todoApi.reorderTasks(listId, orderedIds);
      } catch (err) {
        todoStore.setState({ error: err.message });
        await this._refreshAll(); // revert on failure
      }
    });

    // Subtask add
    this.shadow.addEventListener('subtask-add', async (e) => {
      const { taskId, title } = e.detail;
      try {
        await todoApi.addSubtask(taskId, title);
        await Promise.all([this._refreshTaskEdit(taskId), this._refreshAll()]);
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Subtask toggle
    this.shadow.addEventListener('subtask-toggle', async (e) => {
      const { subtaskId, completed } = e.detail;
      try {
        await todoApi.updateSubtask(subtaskId, { is_completed: completed });
        // Refresh the task being edited to update subtask list + counts
        if (e.detail.taskId) await this._refreshTaskEdit(e.detail.taskId);
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Subtask delete
    this.shadow.addEventListener('subtask-delete', async (e) => {
      const { subtaskId, taskId } = e.detail;
      try {
        await todoApi.deleteSubtask(subtaskId);
        if (taskId) await this._refreshTaskEdit(taskId);
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Subtask update (title edit)
    this.shadow.addEventListener('subtask-update', async (e) => {
      const { subtaskId, taskId, title } = e.detail;
      try {
        await todoApi.updateSubtask(subtaskId, { title });
        if (taskId) await this._refreshTaskEdit(taskId);
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Subtask reorder
    this.shadow.addEventListener('subtask-reorder', async (e) => {
      const { taskId, orderedIds } = e.detail;
      try {
        // Update positions via individual PATCH calls
        for (let i = 0; i < orderedIds.length; i++) {
          await todoApi.updateSubtask(orderedIds[i], { position: i });
        }
        if (taskId) await this._refreshTaskEdit(taskId);
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Task delete
    this.shadow.addEventListener('task-delete', async (e) => {
      const { taskId } = e.detail;
      try {
        await todoApi.deleteTask(taskId);
        const detail = this.shadow.querySelector('pos-task-detail');
        detail?.close();
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Comment add
    this.shadow.addEventListener('comment-add', async (e) => {
      const { taskId, content } = e.detail;
      try {
        await todoApi.addComment(taskId, content);
        await this._refreshTaskEdit(taskId);
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Comment update
    this.shadow.addEventListener('comment-update', async (e) => {
      const { commentId, content } = e.detail;
      try {
        await todoApi.updateComment(commentId, content);
        // Find the task that's open in the flyout
        const detail = this.shadow.querySelector('pos-task-detail');
        if (detail?._task) await this._refreshTaskEdit(detail._task.id);
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Comment delete
    this.shadow.addEventListener('comment-delete', async (e) => {
      const { taskId, commentId } = e.detail;
      try {
        await todoApi.deleteComment(commentId);
        await this._refreshTaskEdit(taskId);
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Duplicate task
    this.shadow.addEventListener('task-duplicate', async (e) => {
      const { taskId } = e.detail;
      try {
        const newTask = await todoApi.duplicateTask(taskId);
        await this._refreshAll();
        // Open the new task in the flyout
        const detail = this.shadow.querySelector('pos-task-detail');
        if (detail) {
          detail.openForTask(newTask);
        }
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Attachment upload
    this.shadow.addEventListener('attachment-upload', async (e) => {
      const { file, taskId } = e.detail;
      try {
        const attachment = await attachmentApi.uploadFile(file);
        if (taskId) {
          // Edit mode: append attachment ID to task and update
          const task = await todoApi.getTask(taskId);
          const ids = [...(task.attachment_ids || []), attachment.id];
          await todoApi.updateTask(taskId, { attachment_ids: ids });
          await this._loadAttachmentsForEdit(taskId);
          await this._refreshAll();
        } else {
          // Create mode: add to form's pending attachments
          const taskList = this.shadow.querySelector('pos-task-list');
          const form = taskList?.shadow?.querySelector('pos-task-form[mode="create"]');
          if (form) form.addPendingAttachment(attachment);
        }
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });

    // Attachment remove (removes from task, does not delete file)
    this.shadow.addEventListener('attachment-remove', async (e) => {
      const { attachmentId, taskId } = e.detail;
      if (!taskId) return;
      try {
        const task = await todoApi.getTask(taskId);
        const ids = (task.attachment_ids || []).filter(id => id !== attachmentId);
        await todoApi.updateTask(taskId, { attachment_ids: ids });
        await this._loadAttachmentsForEdit(taskId);
        await this._refreshAll();
      } catch (err) {
        todoStore.setState({ error: err.message });
      }
    });
  }
}

customElements.define('pos-todos-app', PosTodosApp);
