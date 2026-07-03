@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

set WKVER=10.0.26100.0
set WKROOT=C:\Program Files (x86)\Windows Kits\10
set LIB=%LIB%;%WKROOT%\Lib\%WKVER%\um\x64;%WKROOT%\Lib\%WKVER%\ucrt\x64

set DATABASE_URL=postgres://postgres:password@localhost:5432/beampay_dev
set REDIS_URL=redis://localhost:6379
set STELLAR_RPC_URL=https://soroban-testnet.stellar.org
set ALLBRIDGE_API_URL=https://core-api.allbridge.io
set JWT_SECRET=dev-jwt-secret-change-in-production
set RUST_LOG=info

"%USERPROFILE%\.cargo\bin\cargo.exe" run
