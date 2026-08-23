' Encerra o servidor do Nexo.
Set shell = CreateObject("WScript.Shell")
shell.Run "taskkill /F /IM node.exe", 0, True
