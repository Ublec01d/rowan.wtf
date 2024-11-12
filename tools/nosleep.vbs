' Prevents the PC from sleeping by double-tapping Scroll Lock every 5 minutes.
' Displays a tray icon when the script is active using PowerShell (lolbin method) to reside in the hidden icon menu on the taskbar.

Set objShell = WScript.CreateObject("WScript.Shell")

' Create a tray icon using PowerShell (lolbin method)
Dim trayIconCommand
trayIconCommand = "powershell -windowstyle hidden -command ""[reflection.assembly]::loadwithpartialname('System.Windows.Forms') > $null; " & _
                   "$notify = new-object system.windows.forms.notifyicon; " & _
                   "$notify.icon = [system.drawing.icon]::ExtractAssociatedIcon((Get-Process -id $pid).Path); " & _
                   "$notify.visible = $true; " & _
                   "$notify.text = 'nosleep.vbs - keeps your PC awake'; " & _
                   "$menu = New-Object System.Windows.Forms.ContextMenu; " & _
                   "$exitItem = New-Object System.Windows.Forms.MenuItem 'Quit program for some reason ¯\_(ツ)_/¯'; " & _
                   "$menu.MenuItems.Add($exitItem); " & _
                   "$notify.ContextMenu = $menu; " & _
                   "$exitItem.add_Click({ $notify.visible = $false; [System.Windows.Forms.Application]::Exit(); Stop-Process -Name 'wscript' -Force }); " & _
                   "[System.Windows.Forms.Application]::Run()"""
objShell.Run trayIconCommand, 0, False

Do While True
  ' Toggle Scroll Lock twice
  objShell.SendKeys "{SCROLLLOCK}{SCROLLLOCK}"
  WScript.Sleep 300000 ' 5 minutes
Loop

' Clean up when the script ends (optional)
' This section will only be triggered if the script is stopped manually.
Sub Cleanup()
    ' No specific cleanup needed for PowerShell tray icon
End Sub

On Error Resume Next
WScript.ConnectObject WScript, "WScript_"
Sub WScript_OnQuit
    Cleanup()
End Sub
On Error GoTo 0
