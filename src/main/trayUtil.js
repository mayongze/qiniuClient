/**
 * Created by zhangweiwei on 2017/4/14.
 */
import {BrowserWindow, Tray, ipcMain, clipboard, Notification} from 'electron';
import * as util from './util';
import * as Constants from '../renderer/service/constants';
import pkg from '../../package';

let icon_brand = 'tray_qiniu.png';
const icon_tray = util.isWin() ? 'win_tray.png' : icon_brand;
const icon_upload = util.isWin() ? 'win_upload.png' : 'upload.png';

let mTray, mTrayWindow;
let mainWindowId = -1;

//托盘部分处理
export const createTray = function (_mainWindowId) {
    mainWindowId = _mainWindowId;
    mTray = new Tray(util.getIconPath(icon_tray));

    mTrayWindow = createTrayWindow();

    mTray.on('click', () => {
        toggleTrayWindow();
    });

    // mTray.on('drop-files', async (event, files) => {
    //     const originIcon = icon_brand;
    //     setTrayIcon(icon_upload);
    //     icon_brand = originIcon
    //     mTrayWindow.webContents.send(Constants.Listener.uploadFile, await util.wrapperFiles(files));
    // });

    ipcMain.on(Constants.Listener.updateTrayTitle, function (event, title) {
        if (title.length === 0) {
            setTrayIcon(icon_brand);
        }
        setTrayTitle(title);
    });

    ipcMain.on(Constants.Listener.showNotifier, function (event, option) {
        // option.icon = util.getIconPath(option.icon || 'icon.png');
        option.icon = option.image;
        option.title = option.title || pkg.cnname;
        option.body = option.message;

        option.silent = true;
        // option.subtitle = 'subtitle';
        // option.body = 'body';
        new Notification(option).show();
    });

    return mTray;
};

const createTrayWindow = () => {
    let trayWindow = new BrowserWindow({
        width: 300,
        height: 300,
        show: false,
        frame: false,
        fullscreenable: false,
        resizable: false,
        transparent: true,
        webPreferences: {
            // Prevents renderer process code from not running when window is
            // hidden
            webSecurity: false,
            backgroundThrottling: false,
            devTools: false,
            nodeIntegration: true
        }
    });

    trayWindow.loadURL(util.mainURL + '#/tray');

    // Hide the window when it loses focus
    trayWindow.on('blur', () => {
        if (!trayWindow.webContents.isDevToolsOpened()) {
            trayWindow.hide();
        }
    });

    return trayWindow;
};

const toggleTrayWindow = () => {
    if (mainWindowId !== -1 && BrowserWindow.fromId(mainWindowId)) {
        let win = BrowserWindow.fromId(mainWindowId);

        if (win.isVisible()) {
            win.minimize();
        } else {
            win.show();
        }
    }
    /*if (mTrayWindow.isVisible()) {
        mTrayWindow.hide();
    } else {
        showTrayWindow();
    }*/
};

const showTrayWindow = () => {
    const position = getTrayWindowPosition();
    mTrayWindow.setPosition(position.x, position.y, false);
    mTrayWindow.show();
    mTrayWindow.focus();
};

const getTrayWindowPosition = () => {
    const trayBounds = mTray.getBounds();
    const windowBounds = mTrayWindow.getBounds();

    let x, y;
    if (util.isMac()) {
        x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
        y = Math.round(trayBounds.y + trayBounds.height + 4);
    } else {
        x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
        y = Math.round(trayBounds.y - (windowBounds.height));
    }

    return {x: x, y: y};
};

export const setTrayTitle = function (title) {
    if (util.isMac()) {
        mTray.setTitle(title);
    }
};

export const setTrayIcon = function (image) {
    icon_brand = image;
    if (util.isMac()) {
        mTray.setImage(util.getIconPath(image));
    }
};

