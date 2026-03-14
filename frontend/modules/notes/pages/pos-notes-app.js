// pos-notes-app — Main notes page: three-panel layout (folder | list | editor)
// Composes: pos-folder-sidebar, pos-note-list, pos-note-editor

import '../components/pos-folder-sidebar.js';
import '../components/pos-note-list.js';
import '../components/pos-note-editor.js';
import * as notesApi from '../services/notes-api.js';
import notesStore from '../store.js';

const STORAGE_KEY = 'pos-notes-selected';
const VIEWMODE_KEY = 'pos-notes-viewmode';

class PosNotesApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsubscribe = null;
  }

  connectedCallback() {
    this.render();
    this._unsubscribe = notesStore.subscribe(() => this.update());
    this._restoreSelection();
    this.loadFolders();
    this._bindEvents();
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe();
  }

  // ─── Persistence ─────────────────────────────────────────

  _restoreSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        if (saved.view) {
          notesStore.setState({ selectedView: saved.view, selectedFolderId: null });
        } else if (saved.folderId) {
          notesStore.setState({ selectedFolderId: saved.folderId, selectedView: null });
        }
      }
    } catch { /* ignore */ }

    try {
      const viewMode = localStorage.getItem(VIEWMODE_KEY);
      if (viewMode === 'grid' || viewMode === 'list') {
        notesStore.setState({ viewMode });
      }
    } catch { /* ignore */ }
  }

  _persistSelection() {
    const state = notesStore.getState();
    if (state.selectedView) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ view: state.selectedView }));
    } else if (state.selectedFolderId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folderId: state.selectedFolderId }));
    }
    localStorage.setItem(VIEWMODE_KEY, state.viewMode);
  }

  // ─── Data Loading ─────────────────────────────────────────

  async loadFolders() {
    notesStore.setState({ loading: true });
    try {
      const folders = await notesApi.getFolders();
      notesStore.setState({ folders, loading: false });
      await this.loadCurrentView();
    } catch (e) {
      notesStore.setState({ loading: false, error: e.message });
    }
  }

  async loadCurrentView() {
    const state = notesStore.getState();
    notesStore.setState({ loading: true });
    try {
      let notes;
      if (state.searchQuery) {
        notes = await notesApi.searchNotes(state.searchQuery);
      } else if (state.selectedFolderId) {
        notes = await notesApi.getNotes({ folder_id: state.selectedFolderId });
      } else if (state.selectedView === 'pinned') {
        notes = await notesApi.getNotes({ is_pinned: true });
      } else if (state.selectedView === 'trash') {
        notes = await notesApi.getNotes({ is_deleted: true });
      } else {
        // 'all' view
        notes = await notesApi.getNotes();
      }
      notesStore.setState({ notes, loading: false });
      this._persistSelection();
    } catch (e) {
      notesStore.setState({ loading: false, error: e.message });
    }
  }

  async loadNote(noteId) {
    try {
      const note = await notesApi.getNote(noteId);
      notesStore.setState({ selectedNote: note, selectedNoteId: noteId });
    } catch (e) {
      console.error('Failed to load note:', e);
    }
  }

  // ─── Event Binding ────────────────────────────────────────

  _bindEvents() {
    // Folder sidebar events
    this.shadow.addEventListener('folder-select', (e) => {
      const { folderId, view } = e.detail;
      if (view) {
        notesStore.setState({ selectedView: view, selectedFolderId: null, selectedNoteId: null, selectedNote: null });
      } else if (folderId) {
        notesStore.setState({ selectedFolderId: folderId, selectedView: null, selectedNoteId: null, selectedNote: null });
      }
      this.loadCurrentView();
    });

    this.shadow.addEventListener('folder-create', async (e) => {
      try {
        await notesApi.createFolder(e.detail.name);
        await this.loadFolders();
      } catch (err) {
        if (err.message?.includes('409')) {
          alert('A folder with that name already exists.');
        }
      }
    });

    this.shadow.addEventListener('folder-delete', async (e) => {
      if (!confirm('Delete this folder? Notes inside will be moved to All Notes.')) return;
      try {
        await notesApi.deleteFolder(e.detail.folderId);
        const state = notesStore.getState();
        if (state.selectedFolderId === e.detail.folderId) {
          notesStore.setState({ selectedFolderId: null, selectedView: 'all' });
        }
        await this.loadFolders();
      } catch (err) {
        console.error('Failed to delete folder:', err);
      }
    });

    this.shadow.addEventListener('folder-rename', async (e) => {
      try {
        await notesApi.updateFolder(e.detail.folderId, { name: e.detail.name });
        await this.loadFolders();
      } catch (err) {
        console.error('Failed to rename folder:', err);
      }
    });

    // Note list events
    this.shadow.addEventListener('note-create', async () => {
      const state = notesStore.getState();
      try {
        const note = await notesApi.createNote({
          title: '',
          folder_id: state.selectedFolderId || null,
        });
        await this.loadCurrentView();
        await this.loadNote(note.id);
      } catch (err) {
        console.error('Failed to create note:', err);
      }
    });

    this.shadow.addEventListener('note-select', async (e) => {
      await this.loadNote(e.detail.noteId);
    });

    this.shadow.addEventListener('search-change', (e) => {
      notesStore.setState({ searchQuery: e.detail.query });
      this.loadCurrentView();
    });

    this.shadow.addEventListener('view-mode-change', (e) => {
      notesStore.setState({ viewMode: e.detail.viewMode });
      this._persistSelection();
    });

    // Editor events
    this.shadow.addEventListener('note-content-change', async (e) => {
      const { selectedNoteId } = notesStore.getState();
      if (!selectedNoteId) return;
      const editor = this.shadow.querySelector('pos-note-editor');
      try {
        await notesApi.updateNote(selectedNoteId, { content: e.detail.content });
        editor?.setSaveStatus('saved');
        // Refresh the note list item (preview may have changed)
        await this.loadCurrentView();
      } catch (err) {
        editor?.setSaveStatus('error');
      }
    });

    this.shadow.addEventListener('note-title-change', async (e) => {
      const { selectedNoteId } = notesStore.getState();
      if (!selectedNoteId) return;
      const editor = this.shadow.querySelector('pos-note-editor');
      try {
        await notesApi.updateNote(selectedNoteId, { title: e.detail.title });
        editor?.setSaveStatus('saved');
        await this.loadCurrentView();
      } catch (err) {
        editor?.setSaveStatus('error');
      }
    });

    // Tag events
    this.shadow.addEventListener('tag-add', async (e) => {
      const { selectedNoteId } = notesStore.getState();
      if (!selectedNoteId) return;
      try {
        const note = await notesApi.addTag(selectedNoteId, e.detail.name);
        notesStore.setState({ selectedNote: note });
      } catch (err) {
        console.error('Failed to add tag:', err);
      }
    });

    this.shadow.addEventListener('tag-remove', async (e) => {
      const { selectedNoteId } = notesStore.getState();
      if (!selectedNoteId) return;
      try {
        await notesApi.removeTag(selectedNoteId, e.detail.tagId);
        await this.loadNote(selectedNoteId);
      } catch (err) {
        console.error('Failed to remove tag:', err);
      }
    });

    // Note actions from editor context menu or keyboard
    this.shadow.addEventListener('note-pin', async (e) => {
      const { noteId, is_pinned } = e.detail;
      try {
        await notesApi.updateNote(noteId, { is_pinned });
        await this.loadCurrentView();
        const { selectedNoteId } = notesStore.getState();
        if (selectedNoteId === noteId) await this.loadNote(noteId);
      } catch (err) {
        console.error('Failed to pin note:', err);
      }
    });

    this.shadow.addEventListener('note-color', async (e) => {
      const { noteId, color } = e.detail;
      try {
        await notesApi.updateNote(noteId, { color });
        await this.loadCurrentView();
      } catch (err) {
        console.error('Failed to set color:', err);
      }
    });

    this.shadow.addEventListener('note-move', async (e) => {
      const { noteId, folderId } = e.detail;
      try {
        await notesApi.updateNote(noteId, { folder_id: folderId });
        await this.loadCurrentView();
      } catch (err) {
        console.error('Failed to move note:', err);
      }
    });

    this.shadow.addEventListener('note-delete', async (e) => {
      const { noteId } = e.detail;
      try {
        await notesApi.deleteNote(noteId);
        const state = notesStore.getState();
        if (state.selectedNoteId === noteId) {
          notesStore.setState({ selectedNoteId: null, selectedNote: null });
        }
        await this.loadCurrentView();
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    });

    this.shadow.addEventListener('note-restore', async (e) => {
      try {
        await notesApi.restoreNote(e.detail.noteId);
        await this.loadCurrentView();
      } catch (err) {
        console.error('Failed to restore note:', err);
      }
    });

    this.shadow.addEventListener('note-permanent-delete', async (e) => {
      if (!confirm('Permanently delete this note? This cannot be undone.')) return;
      try {
        await notesApi.permanentDeleteNote(e.detail.noteId);
        const state = notesStore.getState();
        if (state.selectedNoteId === e.detail.noteId) {
          notesStore.setState({ selectedNoteId: null, selectedNote: null });
        }
        await this.loadCurrentView();
      } catch (err) {
        console.error('Failed to permanently delete note:', err);
      }
    });
  }

  // ─── Rendering ────────────────────────────────────────────

  update() {
    const state = notesStore.getState();

    const sidebar = this.shadow.querySelector('pos-folder-sidebar');
    if (sidebar) {
      sidebar.folders = state.folders;
      sidebar.selectedFolderId = state.selectedFolderId;
      sidebar.selectedView = state.selectedView;
    }

    const noteList = this.shadow.querySelector('pos-note-list');
    if (noteList) {
      noteList.notes = state.notes;
      noteList.selectedNoteId = state.selectedNoteId;
      noteList.viewMode = state.viewMode;
    }

    const editor = this.shadow.querySelector('pos-note-editor');
    if (editor) {
      editor.note = state.selectedNote;
    }
  }

  render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: grid;
          grid-template-columns: 220px 300px 1fr;
          height: 100%;
          overflow: hidden;
          background: var(--pos-color-surface, #fff);
        }

        .panel {
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .panel-sidebar {
          border-right: 1px solid var(--pos-color-border, #e5e5e5);
          background: var(--pos-color-surface-alt, #f8f8f8);
        }

        .panel-list {
          border-right: 1px solid var(--pos-color-border, #e5e5e5);
        }

        .panel-editor {
          background: var(--pos-color-surface, #fff);
        }
      </style>

      <div class="panel panel-sidebar">
        <pos-folder-sidebar></pos-folder-sidebar>
      </div>

      <div class="panel panel-list">
        <pos-note-list></pos-note-list>
      </div>

      <div class="panel panel-editor">
        <pos-note-editor></pos-note-editor>
      </div>
    `;

    // Initialize component state from store
    this.update();
  }
}

customElements.define('pos-notes-app', PosNotesApp);
