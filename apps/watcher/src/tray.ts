// Windows notification-area icon, hosted by a hidden PowerShell child running
// a WinForms NotifyIcon. Menu clicks arrive as lines on the child's stdout;
// balloons and shutdown go out through a command file the script polls. The
// script exits on its own when this process dies.
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type TrayAction = 'update' | 'quit';

const SCRIPT = String.raw`
param($exePath, $cmdFile, $parentPid, $version)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ni = New-Object System.Windows.Forms.NotifyIcon
try { $ni.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath) }
catch { $ni.Icon = [System.Drawing.SystemIcons]::Application }
$ni.Text = "Tarkov Toolkit Companion $version"
$ni.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$title = $menu.Items.Add("Tarkov Toolkit Companion $version")
$title.Enabled = $false
[void]$menu.Items.Add("-")
$update = $menu.Items.Add("Check for updates")
$update.add_Click({ [Console]::Out.WriteLine("update"); [Console]::Out.Flush() })
$quit = $menu.Items.Add("Quit")
$quit.add_Click({ [Console]::Out.WriteLine("quit"); [Console]::Out.Flush() })
$ni.ContextMenuStrip = $menu

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 800
$timer.add_Tick({
  if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) {
    $ni.Visible = $false
    [System.Windows.Forms.Application]::Exit()
    return
  }
  if (Test-Path $cmdFile) {
    $lines = Get-Content $cmdFile -ErrorAction SilentlyContinue
    Clear-Content $cmdFile -ErrorAction SilentlyContinue
    foreach ($line in $lines) {
      if ($line -like "balloon|*") {
        $ni.ShowBalloonTip(4000, "Tarkov Toolkit Companion", $line.Substring(8), "Info")
      }
      if ($line -eq "exit") {
        $ni.Visible = $false
        [System.Windows.Forms.Application]::Exit()
      }
    }
  }
})
$timer.Start()
[System.Windows.Forms.Application]::Run()
`;

export interface Tray {
  balloon(message: string): void;
  dispose(): void;
}

export function startTray(version: string, onAction: (action: TrayAction) => void): Tray {
  const commandFile = path.join(tmpdir(), `raidplanner-tray-${process.pid}.txt`);
  writeFileSync(commandFile, '');
  const scriptFile = path.join(tmpdir(), `raidplanner-tray-${process.pid}.ps1`);
  writeFileSync(scriptFile, SCRIPT);

  const child: ChildProcess = spawn(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-WindowStyle',
      'Hidden',
      '-File',
      scriptFile,
      process.execPath,
      commandFile,
      String(process.pid),
      version,
    ],
    { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
  );

  let buffer = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line === 'update' || line === 'quit') onAction(line);
    }
  });

  const send = (line: string) => {
    try {
      appendFileSync(commandFile, `${line}\n`);
    } catch {
      /* tray gone; nothing to notify */
    }
  };

  return {
    balloon: (message) => send(`balloon|${message}`),
    dispose: () => {
      send('exit');
      setTimeout(() => child.kill(), 2000).unref?.();
    },
  };
}
