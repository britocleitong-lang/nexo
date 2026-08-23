' Garante que o servidor esta rodando e abre o Nexo no navegador.
' Se voce instalou como aplicativo pelo Edge, pode usar o icone normal;
' este arquivo serve para o caso de abrir direto no navegador.

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = pasta

' Sobe o servidor (se ja estiver rodando, o node avisa e encerra sozinho)
shell.Run "node """ & pasta & "\servidor.cjs""", 0, False
WScript.Sleep 900
shell.Run "http://localhost:4173", 1, False
