import * as vscode from 'vscode';

export interface ClipSnippet {
  id: string;
  content: string;
  created: number;
}

const SNIPPETS_KEY = 'clipCache.snippets';

export function loadSnippets(context: vscode.ExtensionContext): ClipSnippet[] {
  return context.globalState.get<ClipSnippet[]>(SNIPPETS_KEY, []);
}

export function saveSnippets(context: vscode.ExtensionContext, snippets: ClipSnippet[]): Thenable<void> {
  return context.globalState.update(SNIPPETS_KEY, snippets);
}

export function addSnippet(context: vscode.ExtensionContext, snippet: ClipSnippet): Thenable<void> {
  const snippets = loadSnippets(context);
  snippets.unshift(snippet); // Add newest first
  return saveSnippets(context, snippets);
}

export function deleteSnippet(context: vscode.ExtensionContext, id: string): Thenable<void> {
  const snippets = loadSnippets(context).filter(s => s.id !== id);
  return saveSnippets(context, snippets);
}

export function loadSnippetsRaw(): ClipSnippet[] {
  const vscode = require('vscode');
  const context = vscode.extensions.getExtension('clip-drop.clip-drop')?.exports?.context;
  if (!context) return [];
  return (context.globalState.get(SNIPPETS_KEY, []) as ClipSnippet[]);
} 