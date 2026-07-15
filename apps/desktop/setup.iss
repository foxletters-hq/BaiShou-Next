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
AppPublisher=Anson-Trio / foxletters-hq
AppPublisherURL=https://github.com/foxletters-hq/BaiShou-Next
DefaultDirName={autopf}\BaiShou
DefaultGroupName=白守
DisableDirPage=no
; 勿用 CloseApplications=force：Electron 常不响应 Restart Manager，安装向导会长时间卡住。
; 进程占用改由下方 [Code] 检测，并提示用户关闭或代为结束。
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

en.AppRunningPrompt=BaiShou is currently running and must be closed before continuing.%n%n• Yes — close BaiShou automatically and continue%n• No — I will close it myself, then check again%n• Cancel — abort
zh_cn.AppRunningPrompt=检测到白守正在运行，安装/卸载前需要先退出。%n%n• 是 — 由安装程序结束进程并继续%n• 否 — 请你手动退出后，安装程序再检测%n• 取消 — 中止
zh_tw.AppRunningPrompt=偵測到白守正在執行，安裝／移除前需要先結束。%n%n• 是 — 由安裝程式結束行程並繼續%n• 否 — 請你手動結束後，安裝程式再偵測%n• 取消 — 中止
ja.AppRunningPrompt=白守が実行中です。続行前に終了してください。%n%n• はい — インストーラーが自動終了して続行%n• いいえ — 自分で終了してから再確認%n• キャンセル — 中止

en.AppRunningManual=Please fully quit BaiShou (including the tray icon), then click OK.
zh_cn.AppRunningManual=请完全退出白守（含托盘图标）后点击「确定」，安装程序将再次检测。
zh_tw.AppRunningManual=請完全結束白守（含系統匣圖示）後按「確定」，安裝程式將再次偵測。
ja.AppRunningManual=白守を完全に終了（トレイ含む）してから「OK」を押してください。再確認します。

en.AppCloseFailed=Could not close BaiShou automatically. Please quit it manually and try again.
zh_cn.AppCloseFailed=无法自动结束白守进程，请手动退出后重试。
zh_tw.AppCloseFailed=無法自動結束白守行程，請手動結束後重試。
ja.AppCloseFailed=白守を自動終了できませんでした。手動で終了してから再試行してください。

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

[Code]
function IsBaiShouRunning: Boolean;
var
  ResultCode: Integer;
begin
  { tasklist 在无匹配进程时仍可能 exit 0，用 findstr 二次确认 }
  Result :=
    Exec(
      ExpandConstant('{cmd}'),
      '/C tasklist /NH /FI "IMAGENAME eq BaiShou.exe" 2>nul | findstr /I /C:"BaiShou.exe" >nul',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode
    ) and (ResultCode = 0);
end;

function TryCloseBaiShou: Boolean;
var
  ResultCode: Integer;
begin
  Exec(
    ExpandConstant('{cmd}'),
    '/C taskkill /F /IM BaiShou.exe /T >nul 2>nul',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode
  );
  Sleep(1500);
  Result := not IsBaiShouRunning;
end;

function EnsureBaiShouNotRunning: Boolean;
var
  Response: Integer;
begin
  Result := True;
  while IsBaiShouRunning do
  begin
    if WizardSilent then
    begin
      Log('BaiShou.exe is running during silent install/uninstall; attempting taskkill');
      if not TryCloseBaiShou then
      begin
        Log('Failed to close BaiShou.exe in silent mode');
        Result := False;
        Exit;
      end;
    end
    else
    begin
      Response := MsgBox(ExpandConstant('{cm:AppRunningPrompt}'), mbConfirmation, MB_YESNOCANCEL);
      if Response = IDCANCEL then
      begin
        Result := False;
        Exit;
      end;
      if Response = IDYES then
      begin
        if not TryCloseBaiShou then
          MsgBox(ExpandConstant('{cm:AppCloseFailed}'), mbError, MB_OK);
      end
      else
        MsgBox(ExpandConstant('{cm:AppRunningManual}'), mbInformation, MB_OK);
    end;
  end;
end;

function InitializeSetup: Boolean;
begin
  Result := EnsureBaiShouNotRunning;
end;

function InitializeUninstall: Boolean;
begin
  Result := EnsureBaiShouNotRunning;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  NeedsRestart := False;
  Result := '';
  if not EnsureBaiShouNotRunning then
    Result := ExpandConstant('{cm:AppCloseFailed}');
end;
