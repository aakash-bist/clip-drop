import * as vscode from 'vscode';

export class TestWebviewViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'clipDropTest.view'; // MUST match package.json view ID
    public _view?: vscode.WebviewView;

    private _viewReadyPromise: Promise<void>;
    private _resolveViewReady: (() => void) | undefined;

    constructor(private readonly _extensionContext: vscode.ExtensionContext) {
        this._viewReadyPromise = new Promise(resolve => {
            this._resolveViewReady = resolve;
        });
    }

    public get viewReady(): Promise<void> {
        return this._viewReadyPromise;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('[TestWebviewViewProvider] resolveWebviewView method entered.');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionContext.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        if (this._resolveViewReady) {
            this._resolveViewReady();
            this._resolveViewReady = undefined;
        }

        webviewView.webview.onDidReceiveMessage(message => {
            console.log('[Webview] Received message:', message.type);
            if (message.type === 'hello') {
                vscode.window.showInformationMessage('Hello from Webview!');
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Test View</title>
                <style>
                    body { background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: sans-serif; padding: 20px; }
                    h1 { color: var(--vscode-editor-foreground); }
                    button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
                    button:hover { background-color: var(--vscode-button-hoverBackground); }
                </style>
            </head>
            <body>
                <h1>Hello from Test Webview!</h1>
                <p>This is a minimal test to check if the webview renders.</p>
                <button id="testButton">Send Message to Extension</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('testButton').addEventListener('click', () => {
                        vscode.postMessage({ type: 'hello' });
                    });
                </script>
            </body>
            </html>
        `;
    }
}