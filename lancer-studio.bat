@echo off
rem Double-clic : lance le serveur du studio et ouvre la page dans le navigateur.
rem Laisser cette fenetre ouverte pendant que tu travailles (la fermer arrete le serveur).
rem Sans ce serveur, index.html marche quand meme, mais le bouton Sauvegarder
rem ne peut plus ecrire sur le disque (il telecharge un fichier a la place).
cd /d "%~dp0"
title Flot - serveur (ne pas fermer)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installe-le depuis https://nodejs.org puis relance ce fichier.
  pause
  exit /b 1
)

rem Si le serveur tourne deja, on ouvre juste la page
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://localhost:8123/api/ping -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" http://localhost:8123/
  exit /b 0
)

start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:8123/"
node outils\serveur.js
pause
