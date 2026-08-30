Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
' Get the folder where this VBS file is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir
' Try to find node.exe in PATH, or use the one in the folder
nodePath = "node"
WshShell.Run nodePath & " server\index.js", 0, False
WScript.Sleep 3000
' Open browser after server starts
WshShell.Run "http://localhost:8088"
