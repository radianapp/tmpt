param(
    [switch]$SkipGit
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " TMPT Version Bumper " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Paths
$versionFile = "shared/version.js"
$docsFile = "docs/VERSIONS.md"

if (-not (Test-Path $versionFile)) {
    Write-Host "Error: File $versionFile tidak ditemukan!" -ForegroundColor Red
    exit 1
}

# 1. Read current version
$content = Get-Content $versionFile -Raw
$null = $content -match 'major:\s*(\d+)'
$major = [int]$matches[1]
$null = $content -match 'minor:\s*(\d+)'
$minor = [int]$matches[1]
$null = $content -match 'patch:\s*(\d+)'
$patch = [int]$matches[1]
$oldFull = "$major.$minor.$patch"

Write-Host "Versi Saat Ini: v$oldFull" -ForegroundColor Yellow

# 2. Ask what to bump
$bumpType = Read-Host "Bagian mana yang ingin dinaikkan? (major/minor/patch) [default: patch]"
if ([string]::IsNullOrWhiteSpace($bumpType)) { $bumpType = "patch" }

$newMajor = $major
$newMinor = $minor
$newPatch = $patch

switch ($bumpType.ToLower()) {
    "major" { $newMajor++; $newMinor = 0; $newPatch = 0 }
    "minor" { $newMinor++; $newPatch = 0 }
    "patch" { $newPatch++ }
    default { Write-Host "Input tidak valid. Menggunakan patch." -ForegroundColor Yellow; $newPatch++ }
}

$newFull = "$newMajor.$newMinor.$newPatch"
$date = Get-Date -Format "yyyy-MM-dd"

Write-Host "Versi Baru: v$newFull" -ForegroundColor Green

# 3. Update version.js
$content = $content -replace "major:\s*\d+", "major: $newMajor"
$content = $content -replace "minor:\s*\d+", "minor: $newMinor"
$content = $content -replace "patch:\s*\d+", "patch: $newPatch"
$content = $content -replace "full:\s*`"[^`"]+`"", "full: `"$newFull`""
$content = $content -replace "last_update:\s*`"[^`"]+`"", "last_update: `"$date`""

Set-Content -Path $versionFile -Value $content -Encoding UTF8

# 4. Ask for release notes
$releaseNotes = Read-Host "Masukkan deskripsi/catatan rilis singkat"
if ([string]::IsNullOrWhiteSpace($releaseNotes)) {
    $releaseNotes = "Minor fixes and updates."
}

# 5. Update VERSIONS.md
$versionDocEntry = @"
## v$newFull
- **Tanggal:** $date
- **Pembaruan:** $releaseNotes

"@

if (Test-Path $docsFile) {
    $oldDocs = Get-Content $docsFile -Raw
    # Assuming there's a title at the top, we want to insert right below it.
    # We will search for the first "## v" or insert at the top if not found.
    $insertIndex = $oldDocs.IndexOf("## v")
    if ($insertIndex -ge 0) {
        $newDocs = $oldDocs.Substring(0, $insertIndex) + $versionDocEntry + $oldDocs.Substring($insertIndex)
        Set-Content -Path $docsFile -Value $newDocs -Encoding UTF8
    } else {
        Set-Content -Path $docsFile -Value ($versionDocEntry + $oldDocs) -Encoding UTF8
    }
} else {
    $title = "# Catatan Rilis (Versions)`n`n"
    Set-Content -Path $docsFile -Value ($title + $versionDocEntry) -Encoding UTF8
}

Write-Host "File version.js dan VERSIONS.md berhasil diperbarui!" -ForegroundColor Green

# 5b. Update Bubblewrap twa-manifest.json if exists
$twaManifest = "deploy/bubblewrap/twa-manifest.json"
if (Test-Path $twaManifest) {
    Write-Host "Mendeteksi konfigurasi Bubblewrap TWA..." -ForegroundColor Cyan
    try {
        $json = Get-Content $twaManifest -Raw | ConvertFrom-Json
        $oldCode = $json.appVersionCode
        $newCode = $oldCode + 1
        
        $json.appVersionCode = $newCode
        $json.appVersionName = $newFull
        $json.appVersion = $newFull
        
        # Simpan kembali berkas JSON
        $newJson = $json | ConvertTo-Json -Depth 100
        Set-Content -Path $twaManifest -Value $newJson -Encoding UTF8
        
        Write-Host "Berhasil memperbarui twa-manifest.json!" -ForegroundColor Green
        Write-Host " -> Kode Versi Android (appVersionCode): $oldCode -> $newCode" -ForegroundColor Yellow
        Write-Host " -> Nama Versi Android (appVersionName): $newFull" -ForegroundColor Yellow
    } catch {
        Write-Host "Peringatan: Gagal memperbarui twa-manifest.json secara otomatis: $_" -ForegroundColor Yellow
    }
}

# 6. Git Operations
if (-not $SkipGit) {
    Write-Host "Melakukan commit dan tag di Git..." -ForegroundColor Cyan
    
    $stageAll = Read-Host "Ada file lain yang berubah (HTML/CSS/JS/Docs). Ingin melakukan 'git add .' untuk memasukkan semuanya? (y/n) [default: y]"
    if ([string]::IsNullOrWhiteSpace($stageAll) -or $stageAll.ToLower() -eq 'y') {
        git add .
    } else {
        git add $versionFile $docsFile
    }
    
    git commit -m "v${newFull}: $releaseNotes"
    git tag "v$newFull"
    
    $push = Read-Host "Push ke origin? (y/n) [default: y]"
    if ([string]::IsNullOrWhiteSpace($push) -or $push.ToLower() -eq 'y') {
        git push origin main
        git push origin --tags
        Write-Host "Berhasil di-push ke GitHub!" -ForegroundColor Green
    }
}

Write-Host "Selesai!" -ForegroundColor Cyan
