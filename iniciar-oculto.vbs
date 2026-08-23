' Inicia o servidor do Nexo sem mostrar a janela preta do console.
'
' O truque: o Windows Script Host consegue lançar um processo com a janela
' escondida (o 0 no segundo parametro). O node continua rodando normalmente,
' so que sem interface.
'
' Uso: dar dois cliques neste arquivo, ou apontar o Agendador de Tarefas
' para ele. Para parar, encerre o processo "node.exe" no Gerenciador de
' Tarefas, ou use parar.vbs.

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

pasta = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = pasta

' 0 = janela oculta | False = nao espera terminar
shell.Run "node """ & pasta & "\servidor.cjs""", 0, False
