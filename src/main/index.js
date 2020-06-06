'use strict';

import {app, BrowserWindow, Menu, ipcMain, dialog, shell, systemPreferences, globalShortcut , nativeTheme} from 'electron';

const storage = require('electron-json-storage');
// import EAU from 'electron-asar-hot-updater';

const path = require('path');
const fs = require('fs-extra');
const {download} = require('electron-dl');

import pkg from '../../package';
import * as util from './util';
import * as trayUtil from './trayUtil';
import * as Constants from '../renderer/service/constants';
import * as diffFolder from './util/diffFolder';

let isClose = false;
let mainWindow, aboutWindow;

const DEFAULT_PATH = path.join(app.getPath('downloads'), pkg.name);

app.on('ready', initApp);

app.on('activate', () => {
    console.log(mainWindow);
    if (mainWindow === null) {
        createMainWindow();
    } else {
        mainWindow.show();
    }
});

function initApp() {
    globalShortcut.register('CommandOrControl+Q', () => {
        isClose = true;
        app.quit();
    });
    //win10 ,不设置没有通知显示
    app.setAppUserModelId(pkg.build.appId);

    //注册菜单
    const menu = Menu.buildFromTemplate(getMenuData());
    Menu.setApplicationMenu(menu);

    //创建主窗口
    createMainWindow();
    //托盘处理
    util.isMac() && trayUtil.createTray(mainWindow.id);

    registerIPC();

    //updateAsar();
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        height: 750,
        width: 1000,
        title: pkg.cnname,
        titleBarStyle: 'hidden',
        icon: util.isWin() ? util.getIconPath('logo.ico') : util.getIconPath('logo.png'),
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true
        }
    });

    mainWindow.loadURL(util.mainURL);

    mainWindow.on('close', (event) => {
        if (!isClose) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    /*try {
        mainWindow.webContents.debugger.attach('1.3');
    } catch (err) {
        console.log('Debugger attach failed : ', err);
    }
    console.log("debugger.isAttached():" + mainWindow.webContents.debugger.isAttached());*/

}

/**
 * 注册IPC事件
 */
const registerIPC = function () {

    ipcMain.on('miniWindow', function (event, option) {
        mainWindow.setContentSize(option.width, option.height, true);
    });

    //选择下载目录
    ipcMain.on(Constants.Listener.choiceDownloadFolder, function (event, option) {
        dialog.showOpenDialog(option).then((result)=>{
            if (result.filePaths) event.sender.send(Constants.Listener.choiceDownloadFolder, result.filePaths);
        });
    });

    //下载文件
    ipcMain.on(Constants.Listener.downloadFile, function (event, url, option) {
        option.onProgress = function (num) {
            if (num !== 1) {
                event.sender.send(Constants.Listener.updateDownloadProgress, num);
            }
        };
        if (!option.directory) {
            option.directory = DEFAULT_PATH;
        }
        if (option.folder) {
            option.directory = path.join(option.directory, option.folder);
        }

        download(mainWindow, url, option).then(dl => {
            if (option.count === 1) {
                shell.showItemInFolder(dl.getSavePath());
            }
        }).catch(error => {
            console.error(error);
        }).finally(() => {
            // console.log(file.path, 1);
            event.sender.send(Constants.Listener.updateDownloadProgress, 1);
        });
    });

    //选择文件
    ipcMain.on(Constants.Listener.openFileDialog, function (event, option) {
        dialog.showOpenDialog({
            properties: option.properties
        }).then((result)=>{
            if (result.filePaths) {
                event.sender.send(Constants.Listener.readDirectory, util.wrapperFiles(result.filePaths));
            }
        });
    });

    //选取文件
    ipcMain.on(Constants.Listener.readDirectory, function (event, arg) {
        event.sender.send(Constants.Listener.readDirectory, util.wrapperFiles(arg.files));
    });

    //同步文件夹
    ipcMain.on(Constants.Listener.syncDirectory, function (event, option) {
        dialog.showOpenDialog({
            title: '请选择需要同步的目录(beta)',
            buttonLabel: '同步',
            properties: option.properties
        }).then(async (result)=>{
            console.dir(result.filePaths);
            let results = await diffFolder.diff(result.filePaths[0], option.files, option.type, option.mergeType);
            console.dir(results);

            event.sender.send(Constants.Listener.syncDirectory, results);
        });
    });

    //预览文件
    ipcMain.on(Constants.Listener.preview, function (event, arg) {
        mainWindow.previewFile(arg);
    });

    ipcMain.on(Constants.Listener.setBrand, function (event, arg) {
        trayUtil.setTrayIcon('tray_' + arg.key + '.png');
    });

    ipcMain.on(Constants.Listener.darkMode, function (event, arg) {
        event.sender.send(Constants.Listener.darkMode, nativeTheme.shouldUseDarkColors);
    });

    ipcMain.on(Constants.Listener.showMenuBar, function (event, option) {
        //win1页面会卡死
        mainWindow.setMenuBarVisibility(option);
    });

    //导出URL链接
    ipcMain.on(Constants.Listener.exportUrl, function (event, arg) {
        fs.ensureDirSync(DEFAULT_PATH);
        let filePath = path.join(DEFAULT_PATH, arg.name);
        let content = arg.urls.join('\n');
        fs.writeFileSync(filePath, content);
        shell.showItemInFolder(filePath);
        util.notification({
            message: 'URL 导出完成'
        });
    });
};


/**
 * 检测更新asar(未调用)
 */
function updateAsar() {

    if (!app.getAppPath().toLowerCase().endsWith('asar')) {
        console.log('未使用asar,跳过更新');
        return;
    }

    EAU.init({
        'api': 'http://ou62js7ck.bkt.clouddn.com/test/last-version.json?t=' + new Date().getTime(), // The API EAU will talk to
        'server': false // Where to check. true: server side, false: client side, default: true.
    });

    EAU.check(function (error, last, body) {
        console.log(error, last, body);
        if (error) {
            if (error === 'no_update_available') {
                return false;
            }
            dialog.showErrorBox('info', error);
            return false;
        }

        /*EAU.progress(function (state) {
            console.log(state);
        });

        EAU.download(function (error) {
            if (error) {
                dialog.showErrorBox('info', error);
                return false;
            }
            dialog.showErrorBox('info', 'App updated successfully! Restart it please.');
        });*/
    });
}

/**
 * 注册菜单
 * @returns {[*,*,*,*]}
 */
const getMenuData = function () {
    const template = [
        {
            label: '修改',
            submenu: [
                {role: 'undo', label: '撤销'},
                {role: 'redo', label: '重做'},
                {type: 'separator'},
                {role: 'cut', label: '剪切'},
                {role: 'copy', label: '复制'},
                {role: 'paste', label: '粘贴'},
                {role: 'pasteandmatchstyle', label: '粘贴并匹配样式'},
                {role: 'delete', label: '删除'},
                {role: 'selectall', label: '全选'}
            ]
        },
        {
            label: '设置',
            submenu: [
                {
                    label: '重新加载',
                    click() {
                        if (mainWindow) {
                            mainWindow.loadURL(util.mainURL);
                        }
                    }
                },
                {
                    label: '清除缓存&重新加载',
                    click() {
                        //
                        if (mainWindow) {
                            //console.log(path.join(app.getPath('userData'), 'Cache'));
                            mainWindow.webContents.session.clearCache(function () {
                                mainWindow.loadURL(util.mainURL);
                            });
                        }
                    }
                },
                {
                    label: '设置目录',
                    click() {
                        shell.showItemInFolder(storage.getDefaultDataPath());
                    }
                },
                // {role: 'forcereload'},
                {role: 'toggledevtools', label: '开发者工具'},
                /*{type: 'separator'},
                {role: 'resetzoom'},
                {role: 'zoomin'},
                {role: 'zoomout'},
                {type: 'separator'},
                {role: 'togglefullscreen'}*/
            ]
        },
        {
            label: '窗口',
            submenu: [
                {role: 'minimize'},
                {role: 'close'}
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: 'wiki',
                    click() {
                        shell.openExternal('https://github.com/willnewii/qiniuClient/wiki');
                    }
                },
                {
                    label: '提交异常或需求',
                    click() {
                        shell.openExternal('https://github.com/willnewii/qiniuClient/issues');
                    }
                }
            ]
        }
    ];

    let aboutMenu = {
        label: '关于',
        click() {
            if (aboutWindow) {
                aboutWindow.show();
            } else {
                aboutWindow = new BrowserWindow({
                    width: 300,
                    height: 300,
                    resizable: false,
                    autoHideMenuBar: true,
                    title: '关于',
                    icon: util.isWin() ? util.getIconPath('logo.ico') : util.getIconPath('logo.png'),
                    webPreferences: {
                        webSecurity: false,
                        backgroundThrottling: false,
                        nodeIntegration: true
                    }
                });
                aboutWindow.loadURL(util.mainURL + '#/about');
                aboutWindow.on('closed', () => {
                    aboutWindow = null;
                });
            }
        }
    };

    if (process.platform === 'darwin') {
        template.unshift({
            label: app.name,
            submenu: [
                aboutMenu,
                {type: 'separator'},
                {role: 'services', submenu: []},
                {type: 'separator'},
                {role: 'hide', label: '隐藏'},
                {role: 'hideothers', label: '隐藏其他'},
                {role: 'unhide', label: '显示全部'},
                {type: 'separator'},
                {
                    label: '关闭', click: () => {
                        isClose = true;
                        app.quit();
                    }
                }
            ]
        });

        template[3].submenu = [
            {role: 'close'},
            {role: 'minimize', label: '最小化'},
            {role: 'zoom', label: '缩放'},
            /*{type: 'separator'},
            {role: 'front'}*/
        ];
    } else {
        template[template.length - 1].submenu.unshift(aboutMenu);
    }
    return template;
};

