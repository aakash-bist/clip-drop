// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { loadSnippets, addSnippet, ClipSnippet, deleteSnippet, saveSnippets } from './snippetStore';

// Session Snippet Types
interface SessionSnippet {
	id: string;
	content: string;
	created: number;
	language: string;
}

// In-memory session snippet store
let sessionSnippets: SessionSnippet[] = [];

function addSessionSnippet(snippet: SessionSnippet) {
	sessionSnippets.unshift(snippet);
	if (sessionSnippets.length > 15) {
		sessionSnippets = sessionSnippets.slice(0, 15);
	}
}

function deleteSessionSnippet(id: string) {
	sessionSnippets = sessionSnippets.filter(s => s.id !== id);
}

function clearAllSessionSnippets() {
	sessionSnippets = [];
}

function filterSessionSnippets(query: string): SessionSnippet[] {
	if (!query) return sessionSnippets;
	const q = query.toLowerCase();
	return sessionSnippets.filter(s =>
		s.content.toLowerCase().includes(q) ||
		s.language.toLowerCase().includes(q)
	);
}

class SessionSnippetTreeItem extends vscode.TreeItem {
	constructor(
		public readonly snippet: SessionSnippet
	) {
		super(snippet.content.slice(0, 40) + (snippet.content.length > 40 ? '...' : ''), vscode.TreeItemCollapsibleState.None);
		this.tooltip = snippet.content;
		this.description = `${new Date(snippet.created).toLocaleTimeString()} [${snippet.language}]`;
		this.contextValue = 'sessionSnippet';
		this.iconPath = new vscode.ThemeIcon('symbol-snippet');
	}
}

class SessionSnippetTreeDataProvider implements vscode.TreeDataProvider<SessionSnippetTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SessionSnippetTreeItem | undefined | void> = new vscode.EventEmitter<SessionSnippetTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<SessionSnippetTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	private filterQuery: string = '';

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async setFilter(query: string) {
		this.filterQuery = query;
		await vscode.commands.executeCommand('setContext', 'sessionSnippetSearchActive', !!query);
		this.refresh();
	}

	getTreeItem(element: SessionSnippetTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): SessionSnippetTreeItem[] {
		const filtered = filterSessionSnippets(this.filterQuery);
		return filtered.map(s => new SessionSnippetTreeItem(s));
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Register the TreeView provider
	const treeDataProvider = new SnippetTreeDataProvider(context);
	vscode.window.registerTreeDataProvider('clip-drop.treeSnippets', treeDataProvider);

	// Register the Session Snippet TreeView provider
	const sessionTreeDataProvider = new SessionSnippetTreeDataProvider();
	vscode.window.registerTreeDataProvider('clip-drop.sessionSnippets', sessionTreeDataProvider);

	// Clipboard polling for session snippets
	let lastClipboard = '';
	const pollClipboard = async () => {
		const clipboard = await vscode.env.clipboard.readText();
		if (clipboard && clipboard.trim() && clipboard !== lastClipboard) {
			lastClipboard = clipboard;
			let language = 'plaintext';
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				language = editor.document.languageId;
			}
			const snippet: SessionSnippet = {
				id: Date.now().toString() + Math.random().toString(36).slice(2),
				content: clipboard.trim(),
				created: Date.now(),
				language
			};
			addSessionSnippet(snippet);
			sessionTreeDataProvider.refresh();
		}
		setTimeout(pollClipboard, 1000);
	};
	pollClipboard();

	vscode.commands.executeCommand('setContext', 'sessionSnippetSearchActive', false);
	vscode.commands.executeCommand('setContext', 'treeSnippetSearchActive', false);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.addTreeSnippet', async () => {
			const clipboard = await vscode.env.clipboard.readText();
			if (clipboard && clipboard.trim()) {
				const snippet: ClipSnippet = {
					id: Date.now().toString() + Math.random().toString(36).slice(2),
					content: clipboard.trim(),
					created: Date.now()
				};
				await addSnippet(context, snippet);
				treeDataProvider.refresh();
			} else {
				vscode.window.showInformationMessage('Clipboard is empty. Copy something first!');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.copyTreeSnippet', async (item: SnippetTreeItem) => {
			if (item && item.snippet && item.snippet.content) {
				await vscode.env.clipboard.writeText(item.snippet.content);
				vscode.window.showInformationMessage('Snippet copied to clipboard.');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.deleteTreeSnippet', async (item: SnippetTreeItem) => {
			if (item && item.snippet && item.snippet.id) {
				await deleteSnippet(context, item.snippet.id);
				treeDataProvider.refresh();
				vscode.window.showInformationMessage('Snippet deleted.');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.clearAllTreeSnippets', async () => {
			await saveSnippets(context, []);
			treeDataProvider.refresh();
			vscode.window.showInformationMessage('All snippets deleted.');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.copySessionSnippet', async (item: SessionSnippetTreeItem) => {
			if (item && item.snippet && item.snippet.content) {
				await vscode.env.clipboard.writeText(item.snippet.content);
				vscode.window.showInformationMessage('Session snippet copied to clipboard.');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.deleteSessionSnippet', async (item: SessionSnippetTreeItem) => {
			if (item && item.snippet && item.snippet.id) {
				deleteSessionSnippet(item.snippet.id);
				sessionTreeDataProvider.refresh();
				vscode.window.showInformationMessage('Session snippet deleted.');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.clearAllSessionSnippets', async () => {
			clearAllSessionSnippets();
			sessionTreeDataProvider.refresh();
			vscode.window.showInformationMessage('All session snippets deleted.');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.filterSessionSnippets', async () => {
			const query = await vscode.window.showInputBox({ prompt: 'Filter session snippets by content or language' });
			await sessionTreeDataProvider.setFilter(query || '');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.clearSessionSnippetSearch', async () => {
			await sessionTreeDataProvider.setFilter('');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.filterTreeSnippets', async () => {
			const query = await vscode.window.showInputBox({ prompt: 'Filter snippets by content' });
			await treeDataProvider.setFilter(query || '');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.clearTreeSnippetSearch', async () => {
			await treeDataProvider.setFilter('');
		})
	);

	// Optional: Register the Add New command for the view/title button
	context.subscriptions.push(
		vscode.commands.registerCommand('clip-drop.addNew', async () => {
			// await vscode.commands.executeCommand('workbench.view.extension.clip-drop');
			// await vscode.commands.executeCommand('workbench.view.extension.clip-drop.snippets');
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }

class SnippetTreeItem extends vscode.TreeItem {
	constructor(
		public readonly snippet: ClipSnippet
	) {
		super(snippet.content.slice(0, 40) + (snippet.content.length > 40 ? '...' : ''), vscode.TreeItemCollapsibleState.None);
		this.tooltip = snippet.content;
		this.description = new Date(snippet.created).toLocaleString();
		this.contextValue = 'snippet';
		this.iconPath = new vscode.ThemeIcon('symbol-snippet');
	}
}

class SnippetTreeDataProvider implements vscode.TreeDataProvider<SnippetTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SnippetTreeItem | undefined | void> = new vscode.EventEmitter<SnippetTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<SnippetTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	private filterQuery: string = '';

	constructor(private context: vscode.ExtensionContext) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async setFilter(query: string) {
		this.filterQuery = query;
		await vscode.commands.executeCommand('setContext', 'treeSnippetSearchActive', !!query);
		this.refresh();
	}

	getTreeItem(element: SnippetTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): SnippetTreeItem[] {
		let snippets = loadSnippets(this.context);
		if (this.filterQuery) {
			const q = this.filterQuery.toLowerCase();
			snippets = snippets.filter(s =>
				s.content.toLowerCase().includes(q)
			);
		}
		return snippets.map(s => new SnippetTreeItem(s));
	}
}
