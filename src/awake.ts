/**
 * Keeps the computer from sleeping while a campaign runs (round 9 lost six
 * hours to sleep). A helper process holds the system awake and exits when this
 * process does, even if it crashes. The display may still sleep; the power plan
 * is never changed.
 */
import { spawn, type ChildProcess } from 'node:child_process';

export function keepAwake(pid = process.pid): { stop: () => void; how: string; child?: ChildProcess } {
  let child: ChildProcess | undefined;
  let how = 'none';
  try {
    if (process.platform === 'win32') {
      // ES_CONTINUOUS | ES_SYSTEM_REQUIRED, held until the parent process exits.
      const script = [
        "Add-Type -Namespace W -Name P -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint f);'",
        '[void][W.P]::SetThreadExecutionState([uint32]"0x80000001")',
        `try { Wait-Process -Id ${pid} -ErrorAction Stop } catch {}`,
      ].join('; ');
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore', windowsHide: true });
      how = 'SetThreadExecutionState';
    } else if (process.platform === 'darwin') {
      child = spawn('caffeinate', ['-i', '-w', String(pid)], { stdio: 'ignore' });
      how = 'caffeinate';
    } else {
      child = spawn('systemd-inhibit', ['--what=sleep', '--why=comicbench campaign', 'tail', `--pid=${pid}`, '-f', '/dev/null'], { stdio: 'ignore' });
      how = 'systemd-inhibit';
    }
    child.on('error', () => {
      how = 'none';
    });
    child.unref();
  } catch {
    how = 'none';
  }
  return { stop: () => child?.kill(), how, ...(child ? { child } : {}) };
}
