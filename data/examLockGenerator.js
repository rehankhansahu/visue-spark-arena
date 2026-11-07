// ============================================================================
// V Spark 2026 - Windows PC Exam-Lock Batch Script Generator
// Generates self-elevating, self-cleaning, network-locking .bat script for student PCs
// ============================================================================

function generateExamLockScript({ passKey, teamName, university, serverUrl }) {
  const cleanTeamName = (teamName || 'Team').replace(/[^a-zA-Z0-9 _-]/g, '');
  const cleanPassKey = (passKey || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanUniversity = (university || 'University').replace(/[^a-zA-Z0-9 _-]/g, '');
  const cleanServerUrl = serverUrl.replace(/\/+$/, '');

  const batTemplate = [
    '@echo off',
    'setlocal EnableDelayedExpansion',
    'title V Spark 2026 - Exam Mode Security Tool',
    '',
    ':: =========================================================================',
    ':: V SPARK 2026 - ARENA EXAM MODE NETWORK LOCK',
    ':: Team: ' + cleanTeamName,
    ':: University: ' + cleanUniversity,
    ':: =========================================================================',
    '',
    ':: 1. Self-Elevation Check (Run as Administrator)',
    'net session >nul 2>&1',
    'if %errorLevel% neq 0 (',
    '    echo ========================================================',
    '    echo   [V SPARK 2026] EXAM MODE SECURITY CHECK',
    '    echo   Administrator privileges required to lock network.',
    '    echo   Prompting Windows for administrator permission...',
    '    echo ========================================================',
    '    powershell -NoProfile -Command "Start-Process cmd -ArgumentList \'/c \\"\\"%~f0\\"\\"\' -Verb RunAs"',
    '    exit /b',
    ')',
    '',
    ':: 2. Configuration Parameters',
    'set "PASS_KEY=' + cleanPassKey + '"',
    'set "SERVER_URL=' + cleanServerUrl + '"',
    'set "APP_DIR=%LOCALAPPDATA%\\VSpark"',
    'set "UNLOCK_PATH=%APP_DIR%\\Emergency_Unlock.bat"',
    '',
    'if not exist "%APP_DIR%" mkdir "%APP_DIR%" >nul 2>&1',
    '',
    ':: 3. Generate Hidden Emergency Unlocker (For Faculty / Emergency Use)',
    '(',
    '  echo @echo off',
    '  echo net session ^>nul 2^>^&1',
    '  echo if %%errorLevel%% neq 0 (',
    '  echo   powershell -NoProfile -Command "Start-Process cmd -ArgumentList \'/c \\"\\"%%~f0\\"\\"\' -Verb RunAs"',
    '  echo   exit /b',
    '  echo ^)',
    '  echo ========================================================',
    '  echo   [V SPARK 2026] RESTORING NORMAL INTERNET ACCESS...',
    '  echo ========================================================',
    '  echo netsh advfirewall firewall delete rule name="VSpark_Allow_DNS" ^>nul 2^>^&1',
    '  echo netsh advfirewall firewall delete rule name="VSpark_Allow_Arena" ^>nul 2^>^&1',
    '  echo netsh advfirewall firewall delete rule name="VSpark_Block_Outbound" ^>nul 2^>^&1',
    '  echo powershell -NoProfile -Command "try { Invoke-RestMethod -Uri \'' + cleanServerUrl + '/api/team/pc-lock\' -Method Post -Body \'{\\"passKey\\":\\"' + cleanPassKey + '\\",\\"status\\":\\"unlocked\\"}\' -ContentType \'application/json\' -TimeoutSec 5 } catch {}" ^>nul 2^>^&1',
    '  echo.',
    '  echo Internet 100%% Restored! You can now close this window.',
    '  echo timeout /t 4 ^>nul 2^>^&1',
    ') > "%UNLOCK_PATH%"',
    '',
    ':: 4. Apply Windows Firewall Rules via PowerShell',
    'echo [V Spark] Locking PC Network to V Spark Arena Only...',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "& { try { $ips = @(); try { $ips += [System.Net.Dns]::GetHostAddresses(([Uri]\'' + cleanServerUrl + '\').Host) | ForEach-Object { $_.IPAddressToString } } catch {}; $cdns = @(\'cdn.tailwindcss.com\',\'cdnjs.cloudflare.com\',\'cdn.sheetjs.com\',\'fonts.googleapis.com\',\'fonts.gstatic.com\'); foreach ($d in $cdns) { try { $ips += [System.Net.Dns]::GetHostAddresses($d) | ForEach-Object { $_.IPAddressToString } } catch {} }; $uIps = ($ips | Sort-Object -Unique) -join \',\'; netsh advfirewall firewall add rule name=\'VSpark_Allow_DNS\' dir=out action=allow protocol=UDP remoteport=53 | Out-Null; if ($uIps) { netsh advfirewall firewall add rule name=\'VSpark_Allow_Arena\' dir=out action=allow remoteip=$uIps protocol=TCP remoteport=80,443 | Out-Null }; netsh advfirewall firewall add rule name=\'VSpark_Block_Outbound\' dir=out action=block protocol=TCP remoteport=80,443 | Out-Null; Invoke-RestMethod -Uri \'' + cleanServerUrl + '/api/team/pc-lock\' -Method Post -Body (@{ passKey = \'' + cleanPassKey + '\'; status = \'locked\' } | ConvertTo-Json) -ContentType \'application/json\' -TimeoutSec 8 | Out-Null; } catch {} }"',
    '',
    'echo.',
    'echo ========================================================',
    'echo   [SUCCESS] PC Network Locked to V Spark Arena!',
    'echo   This window will now run silently in the background.',
    'echo ========================================================',
    'timeout /t 2 >nul 2>&1',
    '',
    ':: 5. Launch Background Watchdog and Exit Visible Console',
    'powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command "& { Add-Type -AssemblyName System.Windows.Forms; $pKey = \'' + cleanPassKey + '\'; $sUrl = \'' + cleanServerUrl + '\'; $self = \'%~f0\'; $running = $true; $reason = \'Contest Finished\'; while ($running) { Start-Sleep -Seconds 4; try { $body = @{ passKey = $pKey } | ConvertTo-Json; $res = Invoke-RestMethod -Uri \\"$sUrl/api/team/pc-heartbeat\\" -Method Post -Body $body -ContentType \'application/json\' -TimeoutSec 6; if ($res.success) { if ($res.contestStatus -eq \'ended\' -or ($res.remainingSeconds -ne $null -and $res.remainingSeconds -le 0)) { $reason = \'Contest Time Up (Timer Ended)\'; $running = $false; }; if ($res.leftArena -eq $true -or $res.teamStatus -eq \'left_early\') { $reason = \'You Left the Contest (Session Closed)\'; $running = $false; } } } catch {} }; [System.Windows.Forms.MessageBox]::Show(\\"🎉 V Spark 2026: $reason`n`nInternet wapis bahaal karne aur exam lock tool PC se remove karne ke liye OK dabayein.\\", \'V Spark Arena Exam Mode\', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information); netsh advfirewall firewall delete rule name=\'VSpark_Allow_DNS\' | Out-Null; netsh advfirewall firewall delete rule name=\'VSpark_Allow_Arena\' | Out-Null; netsh advfirewall firewall delete rule name=\'VSpark_Block_Outbound\' | Out-Null; try { $unBody = @{ passKey = $pKey; status = \'unlocked\' } | ConvertTo-Json; Invoke-RestMethod -Uri \\"$sUrl/api/team/pc-lock\\" -Method Post -Body $unBody -ContentType \'application/json\' -TimeoutSec 6 | Out-Null; } catch {}; try { Remove-Item \\"$env:LOCALAPPDATA\\VSpark\\Emergency_Unlock.bat\\" -Force -ErrorAction SilentlyContinue; Remove-Item \\"$env:LOCALAPPDATA\\VSpark\\" -Force -Recurse -ErrorAction SilentlyContinue; Remove-Item $self -Force -ErrorAction SilentlyContinue; } catch {} }"',
    '',
    'exit /b'
  ];

  return batTemplate.join('\r\n');
}

module.exports = { generateExamLockScript };
