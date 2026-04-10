const { app, globalShortcut } = require('electron');
app.whenReady().then(() => {
    try {
        const res1 = globalShortcut.register('Alt+F', () => {});
        const res2 = globalShortcut.register('Alt+Space', () => {});
        const res3 = globalShortcut.register('CommandOrControl+Q', () => {});
        console.log(JSON.stringify({ 'Alt+F': res1, 'Alt+Space': res2, 'CmdOrCtrl+Q': res3 }));
    } catch(e) {
        console.error('ERROR:', e.message);
    }
    app.quit();
});
