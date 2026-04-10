const { app, globalShortcut } = require('electron');
app.whenReady().then(() => {
    let results = {};
    try {
        results['Alt+Space'] = globalShortcut.register('Alt+Space', () => {});
        globalShortcut.unregister('Alt+Space');
    } catch(e) { results['Alt+Space'] = e.message; }
    
    try {
        results['Alt+SPACE'] = globalShortcut.register('Alt+SPACE', () => {});
        globalShortcut.unregister('Alt+SPACE');
    } catch(e) { results['Alt+SPACE'] = e.message; }

    try {
        results['Alt+ '] = globalShortcut.register('Alt+ ', () => {});
        globalShortcut.unregister('Alt+ ');
    } catch(e) { results['Alt+ '] = e.message; }

    console.log(JSON.stringify(results));
    app.quit();
});
