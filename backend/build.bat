@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

set WKVER=10.0.26100.0
set WKROOT=C:\Program Files (x86)\Windows Kits\10

set LIB=%LIB%;%WKROOT%\Lib\%WKVER%\um\x64;%WKROOT%\Lib\%WKVER%\ucrt\x64
set INCLUDE=%INCLUDE%;%WKROOT%\Include\%WKVER%\um;%WKROOT%\Include\%WKVER%\ucrt;%WKROOT%\Include\%WKVER%\shared

echo LIB=%LIB%
"%USERPROFILE%\.cargo\bin\cargo.exe" build
