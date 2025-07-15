// dumpEditorView.ts
import * as vscode from 'vscode';
import { loadSnippets, addSnippet, deleteSnippet, saveSnippets, ClipSnippet } from './snippetStore';

export class DumpsWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'clip-drop.snippets';
  public _view?: vscode.WebviewView;
  private mode: 'list' | 'add' | 'edit' = 'list';
  private editSnippet?: ClipSnippet;

  private _viewReadyPromise: Promise<void>;
  private _resolveViewReady: (() => void) | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    this._viewReadyPromise = new Promise(resolve => {
      this._resolveViewReady = resolve;
    });
  }

  public get viewReady(): Promise<void> {
    return this._viewReadyPromise;
  }

  public setMode(newMode: 'list' | 'add' | 'edit') {
    this.mode = newMode;
  }

  public setEditSnippet(snippet: ClipSnippet | undefined) {
    this.editSnippet = snippet;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // THIS IS THE NEW LOG TO CHECK IF IT'S EVER ENTERED
    console.log('[resolveWebviewView] --- METHOD ENTERED ---');

    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    this.render();

    if (this._resolveViewReady) {
      this._resolveViewReady();
      this._resolveViewReady = undefined;
    }

    webviewView.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'switchToAddMode') {
        console.log('[Webview] Received switchToAddMode from extension host.');
        this.setMode('add');
        this.setEditSnippet(undefined);
        this.render();
      } else if (msg.type === 'addNew') {
        vscode.window.showInformationMessage('Add New triggered (internal webview button)');
        this.setMode('add');
        this.setEditSnippet(undefined);
        this.render();
      } else if (msg.type === 'edit') {
        const snippets = loadSnippets(this.context);
        const snippet = snippets.find(s => s.id === msg.id);
        if (snippet) {
          this.setMode('edit');
          this.setEditSnippet(snippet);
          this.render();
        }
      } else if (msg.type === 'save') {
        const content = msg.content?.trim();
        if (!content) return;
        if (this.mode === 'edit' && this.editSnippet) {
          const snippets = loadSnippets(this.context);
          const idx = snippets.findIndex(s => s.id === this.editSnippet!.id);
          if (idx !== -1) {
            snippets[idx] = { ...snippets[idx], content };
            await saveSnippets(this.context, snippets);
          }
        } else {
          const snippet: ClipSnippet = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            content,
            created: Date.now()
          };
          await addSnippet(this.context, snippet);
        }
        this.setMode('list');
        this.setEditSnippet(undefined);
        this.render();
      } else if (msg.type === 'cancel') {
        this.setMode('list');
        this.setEditSnippet(undefined);
        this.render();
      } else if (msg.type === 'copy') {
        const snippets = loadSnippets(this.context);
        const snippet = snippets.find(s => s.id === msg.id);
        if (snippet) {
          await vscode.env.clipboard.writeText(snippet.content);
          vscode.window.showInformationMessage('Snippet copied to clipboard.');
        }
      } else if (msg.type === 'delete') {
        await deleteSnippet(this.context, msg.id);
        this.render();
      } else if (msg.type === 'clearAll') {
        webviewView.webview.postMessage({ type: 'confirmClearAll' });
      } else if (msg.type === 'clearAllConfirmed') {
        await saveSnippets(this.context, []);
        this.render();
      } else if (msg.type === 'pasteClipboard') {
        const clipboard = await vscode.env.clipboard.readText();
        this._view?.webview.postMessage({ type: 'fillClipboard', content: clipboard });
      }
    });
  }

  public render() {
    console.log(`[render] mode=${this.mode} _view=${!!this._view}`);

    if (!this._view) {
        console.log('[render] _view is not resolved yet, cannot render.');
        return;
    }
    if (this.mode === 'list') {
      const snippets = loadSnippets(this.context);
      this._view.webview.html = this.getListHtml(snippets);
    } else {
      this._view.webview.html = this.getEditorHtml(this.mode === 'edit' ? this.editSnippet?.content : '', this.mode);
    }
  }

  private getListHtml(snippets: ClipSnippet[]) {
    return `
      <html>
      <head>
        <style>
          body { margin:0;padding:0;font-family:sans-serif;background:#181818;color:#eee; }
          .header { display:flex;justify-content:space-between;align-items:center;padding:12px 16px 0 16px; }
          h3 { margin:0;font-size:1.2em; }
          .buttons { display:flex;gap:8px; }
          button { border:none;padding:4px 16px;border-radius:6px;cursor:pointer;font-size:0.95em; }
          #addNewBtn { background:#50b4ff;color:#fff; }
          #clearAllBtn { background:transparent;color:#ff5555;border:1px solid #ff5555;padding:4px 12px; }
          ul { list-style:none;padding:0 16px 0 16px;margin:12px 0 0 0; }
          li { background:#222;margin-bottom:10px;padding:12px 10px;border-radius:6px;display:flex;align-items:center;justify-content:space-between; }
          .snippet-content { flex:1;min-width:0; }
          .snippet-text { white-space:pre-wrap;word-break:break-all;font-size:1em; }
          .snippet-date { font-size:0.85em;color:#888;margin-top:4px; }
          .actions { display:flex;flex-direction:column;gap:8px;margin-left:12px; }
          .actions button { background:transparent;border:none;font-size:1.3em;cursor:pointer; }
          .copyBtn { color:#50b4ff; }
          .editBtn { color:#ffd700; }
          .deleteBtn { color:#ff5555; }
          .empty-message { color:#888;padding:12px 10px; }

          /* Modal styles */
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          .modal-content {
            background: #2a2a2a;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 300px;
            color: #eee;
          }
          .modal-buttons {
            margin-top: 20px;
            display: flex;
            justify-content: center;
            gap: 10px;
          }
          .modal-buttons button {
            padding: 8px 15px;
            border-radius: 5px;
            font-size: 0.9em;
            cursor: pointer;
          }
          #confirmYes { background: #ff5555; color: #fff; }
          #confirmNo { background: #444; color: #eee; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>Snippets</h3>
          <div class="buttons">
            <button id="addNewBtn">Add New</button>
            <button id="clearAllBtn">Clear All</button>
          </div>
        </div>
        <ul>
          ${snippets.length === 0 ? '<li class="empty-message">No snippets saved.</li>' :
            snippets.map(s => `
              <li>
                <div class="snippet-content">
                  <div class="snippet-text">${this.escapeHtml(s.content)}</div>
                  <div class="snippet-date">${new Date(s.created).toLocaleString()}</div>
                </div>
                <div class="actions">
                  <button title="Copy" data-id="${s.id}" class="copyBtn">📋</button>
                  <button title="Edit" data-id="${s.id}" class="editBtn">✏️</button>
                  <button title="Delete" data-id="${s.id}" class="deleteBtn">🗑️</button>
                </div>
              </li>
            `).join('')}
        </ul>

        <div id="confirmModal" class="modal-overlay" style="display:none;">
          <div class="modal-content">
            <p>Are you sure you want to clear all snippets?</p>
            <div class="modal-buttons">
              <button id="confirmYes">Yes, Clear All</button>
              <button id="confirmNo">Cancel</button>
            </div>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          document.getElementById('addNewBtn').onclick = () => {
            vscode.postMessage({ type: 'addNew' });
          };
          document.querySelectorAll('.copyBtn').forEach(btn => {
            btn.addEventListener('click', e => {
              vscode.postMessage({ type: 'copy', id: btn.getAttribute('data-id') });
            });
          });
          document.querySelectorAll('.editBtn').forEach(btn => {
            btn.addEventListener('click', e => {
              vscode.postMessage({ type: 'edit', id: btn.getAttribute('data-id') });
            });
          });
          document.querySelectorAll('.deleteBtn').forEach(btn => {
            btn.addEventListener('click', e => {
              vscode.postMessage({ type: 'delete', id: btn.getAttribute('data-id') });
            });
          });

          const confirmModal = document.getElementById('confirmModal');
          document.getElementById('clearAllBtn').onclick = () => {
            confirmModal.style.display = 'flex';
          };
          document.getElementById('confirmYes').onclick = () => {
            vscode.postMessage({ type: 'clearAllConfirmed' });
            confirmModal.style.display = 'none';
          };
          document.getElementById('confirmNo').onclick = () => {
            confirmModal.style.display = 'none';
          };

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'confirmClearAll') {
              confirmModal.style.display = 'flex';
            } else if (message.type === 'fillClipboard') {
              // This is handled by the editor HTML, but keeping it here for completeness
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  private getEditorHtml(content: string | undefined, mode: 'add' | 'edit') {
    const safeContent = content ?? '';
    return `
      <html>
      <head>
        <style>
          body { margin:0;padding:0;font-family:sans-serif;background:#181818;color:#eee; }
          form { padding:16px; }
          textarea { width:100%;height:120px;font-size:1em;background:#222;color:#eee;border:1px solid #444;border-radius:66px;padding:10px;resize:vertical;box-sizing:border-box; }
          .buttons { margin-top:12px;display:flex;gap:8px; }
          button { border:none;padding:8px 18px;border-radius:6px;cursor:pointer; }
          button[type="submit"] { background:#50b4ff;color:#fff; }
          #cancelBtn { background:transparent;color:#aaa;border:1px solid #444; }
          #clipboardBtn { background:transparent;color:#50b4ff;border:1px solid #50b4ff; }
        </style>
      </head>
      <body>
        <form id="dumpForm">
          <textarea id="dumpContent" placeholder="Paste or type your snippet here...">${this.escapeHtml(safeContent)}</textarea>
          <div class="buttons">
            <button type="submit">${mode === 'add' ? 'Save' : 'Update'}</button>
            <button type="button" id="cancelBtn">Cancel</button>
            <button type="button" id="clipboardBtn">Paste from Clipboard</button>
          </div>
        </form>
        <script>
          const vscode = acquireVsCodeApi();
          const textarea = document.getElementById('dumpContent');
          document.getElementById('dumpForm').onsubmit = (e) => {
            e.preventDefault();
            vscode.postMessage({ type: 'save', content: textarea.value });
          };
          document.getElementById('cancelBtn').onclick = () => {
            vscode.postMessage({ type: 'cancel' });
          };
          document.getElementById('clipboardBtn').onclick = () => {
            vscode.postMessage({ type: 'pasteClipboard' });
          };
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'fillClipboard') {
              textarea.value = message.content;
            }
          });
          if ("${mode}" === 'add' && textarea.value === '') {
              vscode.postMessage({ type: 'pasteClipboard' });
          }
        </script>
      </body>
      </html>
    `;
  }

  private escapeHtml(text: string | undefined): string {
    const safe = text ?? '';
    return safe.replace(/[&<>'"]/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[c] ?? c
    ));
  }
}