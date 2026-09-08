# MYRAA Code Signing — creates a local self-signed certificate and signs the exe
# Run as Administrator. This makes Smart App Control trust the app on THIS machine.

param(
    [string]$ExePath = "$PSScriptRoot\MYRAA AI OS.exe"
)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    MYRAA AI OS — Local Code Signing" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Create self-signed certificate (valid 5 years)
$certName = "MYRAA AI OS (Local Development)"
$cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -eq "CN=$certName" }

if (-not $cert) {
    Write-Host "[1/3] Creating self-signed certificate..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject "CN=$certName" `
        -CertStoreLocation Cert:\LocalMachine\My `
        -NotAfter (Get-Date).AddYears(5) `
        -HashAlgorithm SHA256 `
        -KeyAlgorithm RSA `
        -KeyLength 2048
    Write-Host "       Certificate created: $($cert.Thumbprint)" -ForegroundColor Green
} else {
    Write-Host "[1/3] Certificate already exists: $($cert.Thumbprint)" -ForegroundColor Green
}

# 2. Add to Trusted Root (so Smart App Control accepts it)
Write-Host "[2/3] Adding to Trusted Root store..." -ForegroundColor Yellow
$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$rootStore.Open("ReadWrite")
$rootStore.Add($cert)
$rootStore.Close()
Write-Host "       Done." -ForegroundColor Green

# 3. Sign the exe
Write-Host "[3/3] Signing: $ExePath" -ForegroundColor Yellow
if (-not (Test-Path $ExePath)) {
    Write-Host "       ERROR: File not found: $ExePath" -ForegroundColor Red
    exit 1
}

Set-AuthenticodeSignature -FilePath $ExePath -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
Write-Host "       Signed successfully!" -ForegroundColor Green

Write-Host ""
Write-Host "  The app is now trusted on this machine." -ForegroundColor Cyan
Write-Host "  Smart App Control will no longer block it." -ForegroundColor Cyan
Write-Host ""
