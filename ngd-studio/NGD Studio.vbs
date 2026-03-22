' NGD Studio Launcher
' CMD 창 없이 서버를 시작하고 브라우저를 엽니다.
' 브라우저를 닫으면 서버가 자동 종료됩니다.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 현재 스크립트의 폴더로 이동
studioDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = studioDir

' Node.js 확인
retCode = WshShell.Run("cmd /c where node.exe >nul 2>nul", 0, True)
If retCode <> 0 Then
    MsgBox "Node.js가 설치되어 있지 않습니다." & vbCrLf & vbCrLf & _
           "https://nodejs.org 에서 LTS 버전을 설치 후 다시 실행하세요.", _
           vbExclamation, "NGD Studio"
    WScript.Quit 1
End If

' pnpm 확인 및 설치
retCode = WshShell.Run("cmd /c where pnpm.cmd >nul 2>nul", 0, True)
If retCode <> 0 Then
    WshShell.Run "cmd /c npm.cmd install -g pnpm", 0, True
End If

' 의존성 설치
If Not fso.FolderExists(studioDir & "\node_modules\.bin") Then
    WshShell.Run "cmd /c cd /d """ & studioDir & """ && pnpm.cmd install", 0, True
End If

' 기존 포트 프로세스 정리
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano 2^>nul ^| findstr "":3020"" ^| findstr ""LISTENING""') do taskkill /pid %a /f >nul 2>nul", 0, True
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano 2^>nul ^| findstr "":3021 "" ^| findstr ""LISTENING""') do taskkill /pid %a /f >nul 2>nul", 0, True

' 서버 시작 (숨김 모드, 0 = hidden)
WshShell.Run "cmd /c cd /d """ & studioDir & """ && call pnpm.cmd dev:sse", 0, False
WshShell.Run "cmd /c cd /d """ & studioDir & """ && call pnpm.cmd dev", 0, False

' Next.js 준비 대기 (최대 60초)
ready = False
For i = 1 To 60
    WScript.Sleep 1000
    retCode = WshShell.Run("cmd /c netstat -ano 2>nul | findstr "":3020"" | findstr ""LISTENING"" >nul 2>nul", 0, True)
    If retCode = 0 Then
        ready = True
        Exit For
    End If
Next

If ready Then
    ' 브라우저 열기
    WshShell.Run "http://localhost:3020"
End If

' 스크립트 종료 — 서버는 백그라운드에서 계속 실행.
' 브라우저를 닫으면 heartbeat가 중단되고 SSE 서버가 자동 종료됨.
' Next.js dev 서버는 SSE 서버 종료 후 포트만 남으므로,
' 다음 실행 시 start.bat/vbs가 포트 정리함.
