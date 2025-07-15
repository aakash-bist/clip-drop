// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { loadSnippets, addSnippet, ClipSnippet, deleteSnippet, saveSnippets } from './snippetStore';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Register the TreeView provider
	const treeDataProvider = new SnippetTreeDataProvider(context);
	vscode.window.registerTreeDataProvider('clip-drop.treeSnippets', treeDataProvider);

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

	constructor(private context: vscode.ExtensionContext) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: SnippetTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): SnippetTreeItem[] {
		const snippets = loadSnippets(this.context);
		return snippets.map(s => new SnippetTreeItem(s));
	}
}
