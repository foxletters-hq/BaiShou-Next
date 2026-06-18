; 白守 Windows 安装包（Inno Setup）
; 由 scripts/build-inno.mjs 调用 ISCC，传入 AppVersion / OutputBaseFilename / SetupIconPath

#ifndef AppVersion
#define AppVersion "1.0.4"
#endif
#ifndef OutputBaseFilename
#define OutputBaseFilename "BaiShou-v1.0.4-Windows-Setup"
#endif
#ifndef SetupIconPath
#define SetupIconPath "dist\.icon-ico\icon.ico"
#endif

[Setup]
AppId={{B4A8E2F1-6C3D-4A9B-8E7F-1D2C3B4A5968}
AppName=白守
AppVersion={#AppVersion}
AppPublisher=Anson-Trio
AppPublisherURL=https://github.com/Anson-Trio/BaiShou-Next
DefaultDirName={autopf}\BaiShou
DefaultGroupName=白守
DisableDirPage=no
; 勿用 CloseApplications=force：Electron 常不响应 Restart Manager，安装向导会长时间卡住。
CloseApplications=no
OutputDir=dist
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile={#SetupIconPath}
UninstallDisplayIcon={app}\BaiShou.exe

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "zh_cn"; MessagesFile: "inno-languages\ChineseSimplified.isl"
Name: "zh_tw"; MessagesFile: "inno-languages\ChineseTraditional.isl"
Name: "ja"; MessagesFile: "inno-languages\Japanese.isl"

[CustomMessages]
en.AppName=BaiShou
zh_cn.AppName=白守
zh_tw.AppName=白守
ja.AppName=白守

en.CreateDesktopIcon=Create a &desktop shortcut
zh_cn.CreateDesktopIcon=创建桌面快捷方式
zh_tw.CreateDesktopIcon=建立桌面捷徑
ja.CreateDesktopIcon=デスクトップにショートカットを作成する

en.LaunchApp=Launch BaiShou
zh_cn.LaunchApp=启动白守
zh_tw.LaunchApp=啟動白守
ja.LaunchApp=白守を起動する

en.UninstallApp=Uninstall BaiShou
zh_cn.UninstallApp=卸载白守
zh_tw.UninstallApp=移除白守
ja.UninstallApp=白守をアンインストールする

en.AdditionalTasks=Additional tasks:
zh_cn.AdditionalTasks=附加任务:
zh_tw.AdditionalTasks=附加任務:
ja.AdditionalTasks=追加タスク:

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalTasks}:"; Flags: unchecked

[Files]
Source: "dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{cm:AppName}"; Filename: "{app}\BaiShou.exe"
Name: "{group}\{cm:UninstallApp}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{cm:AppName}"; Filename: "{app}\BaiShou.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\BaiShou.exe"; Description: "{cm:LaunchApp}"; Flags: nowait postinstall skipifsilent
