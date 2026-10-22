[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "      ZIRVE SQL OTOMATIK DERIN TABLO VE DÖKÜM TARAYICI" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Bu arac, bilgisayarinizdaki Zirve SQL veritabanlarini tek tek gezer," -ForegroundColor Gray
Write-Host "hangi veritabaninda kac adet Cari Kart ve Cari Hareket oldugunu bulur." -ForegroundColor Gray
Write-Host ""

$folder = $PSScriptRoot
$dataDir = Join-Path $folder "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
$dbFile = Join-Path $dataDir "zirve_finans_db.json"

# Ortak SQL sorgu fonksiyonu
function Exec-Query {
    param($server, $db, $authType, $user, $pass, $sql)
    $cs = if ($authType -eq "sql") {
        "Server=$server;Database=$db;User Id=$user;Password=$pass;ApplicationIntent=ReadOnly;Connection Timeout=4;TrustServerCertificate=True;"
    } else {
        "Server=$server;Database=$db;Integrated Security=True;ApplicationIntent=ReadOnly;Connection Timeout=4;TrustServerCertificate=True;"
    }
    $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
    $conn.Open()
    try {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        $cmd.CommandTimeout = 20
        $adp = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dt = New-Object System.Data.DataTable
        [void]$adp.Fill($dt)
        return ,$dt
    } finally {
        $conn.Close()
    }
}

# 1. SQL Sunucu ve Giriş Türünü Tespit Et
$candidates = @(".\ZIRVESQL", "localhost\ZIRVESQL", ".\SQLEXPRESS", "localhost\SQLEXPRESS", "localhost", "(local)")
$workingSrv = $null
$workingAuth = $null
$workingUser = ""
$workingPass = ""
$allDatabases = @()

Write-Host "1. SQL Sunucusuna baglaniliyor..." -ForegroundColor Yellow

foreach ($srv in $candidates) {
    $attempts = @(
        @{ auth = "windows"; u = ""; p = ""; lbl = "Windows Authentication" },
        @{ auth = "sql"; u = "sa"; p = ""; lbl = "sa (sifresiz)" },
        @{ auth = "sql"; u = "sa"; p = "1"; lbl = "sa / 1" },
        @{ auth = "sql"; u = "sa"; p = "1234"; lbl = "sa / 1234" },
        @{ auth = "sql"; u = "sa"; p = "zirve"; lbl = "sa / zirve" }
    )
    foreach ($att in $attempts) {
        try {
            $dt = Exec-Query -server $srv -db "master" -authType $att.auth -user $att.u -pass $att.p -sql "SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE' ORDER BY name"
            if ($dt -and $dt.Rows.Count -gt 0) {
                $workingSrv = $srv
                $workingAuth = $att.auth
                $workingUser = $att.u
                $workingPass = $att.p
                foreach ($r in $dt.Rows) { $allDatabases += $r["name"].ToString() }
                Write-Host "   [BASARILI] $srv sunucusuna baglanildi ($($att.lbl))" -ForegroundColor Green
                break
            }
        } catch {}
    }
    if ($workingSrv) { break }
}

if (-not $workingSrv) {
    Write-Host "[HATA] SQL Server bulunamadi. Lutfen Zirve programinin acik oldugundan emin olun." -ForegroundColor Red
    pause
    exit
}

Write-Host ""
Write-Host "2. Toplam $($allDatabases.Count) veritabani icinde Cari ve Hareket dokumleri araniyor..." -ForegroundColor Yellow
Write-Host ""

$foundTargets = @()

foreach ($db in $allDatabases) {
    # Sistem veritabanlarini atla
    if ($db -in @("master", "tempdb", "model", "msdb", "ReportServer", "ReportServerTempDB")) { continue }

    try {
        # Tablolari ve satir sayilarini al
        $tDt = Exec-Query -server $workingSrv -db $db -authType $workingAuth -user $workingUser -pass $workingPass -sql @"
SELECT t.name AS TableName, ISNULL(SUM(p.rows), 0) AS RowCnt
FROM sys.tables t
LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
GROUP BY t.name
HAVING ISNULL(SUM(p.rows), 0) > 0
ORDER BY ISNULL(SUM(p.rows), 0) DESC
"@
        if (-not $tDt -or $tDt.Rows.Count -eq 0) { continue }

        $tablesWithRows = @{}
        foreach ($tr in $tDt.Rows) {
            $tablesWithRows[$tr["TableName"].ToString()] = [int]$tr["RowCnt"]
        }

        # Cari tablosu ara
        $cariTable = $null
        foreach ($cand in @("CARI", "CARIKART", "TBLCARI", "CARI_KART", "CARILER", "CARIHESAP", "CARIKARTLAR", "TBL_CARI", "MUSTERI")) {
            foreach ($tn in $tablesWithRows.Keys) {
                if ($tn.ToUpperInvariant() -eq $cand) { $cariTable = $tn; break }
            }
            if ($cariTable) { break }
        }
        if (-not $cariTable) {
            foreach ($tn in $tablesWithRows.Keys) {
                $u = $tn.ToUpperInvariant()
                if ($u -like "*CARI*" -and $u -notlike "*HAR*" -and $u -notlike "*EK*" -and $u -notlike "*NOT*") {
                    $cariTable = $tn; break
                }
            }
        }

        # Cari Hareket tablosu ara
        $harTable = $null
        foreach ($cand in @("CARIHAR", "CARI_HAREKET", "CARIHAREKET", "TBLCARIHAR", "CARIHAR2", "CHAREKET", "TBL_CARIHAR")) {
            foreach ($tn in $tablesWithRows.Keys) {
                if ($tn.ToUpperInvariant() -eq $cand) { $harTable = $tn; break }
            }
            if ($harTable) { break }
        }
        if (-not $harTable) {
            foreach ($tn in $tablesWithRows.Keys) {
                $u = $tn.ToUpperInvariant()
                if ($u -like "*CARI*HAR*" -or $u -like "*CHAREKET*") {
                    $harTable = $tn; break
                }
            }
        }

        if ($cariTable -or $harTable) {
            $cariCnt = if ($cariTable -and $tablesWithRows.ContainsKey($cariTable)) { $tablesWithRows[$cariTable] } else { 0 }
            $harCnt = if ($harTable -and $tablesWithRows.ContainsKey($harTable)) { $tablesWithRows[$harTable] } else { 0 }

            $sampleCari = ""
            if ($cariTable -and $cariCnt -gt 0) {
                try {
                    $sDt = Exec-Query -server $workingSrv -db $db -authType $workingAuth -user $workingUser -pass $workingPass -sql "SELECT TOP 1 * FROM [$cariTable] WITH (NOLOCK)"
                    if ($sDt -and $sDt.Rows.Count -gt 0) {
                        $colList = @()
                        foreach ($col in $sDt.Columns) { $colList += $col.ColumnName }
                        $unvCol = $colList | Where-Object { $_.ToUpperInvariant() -in @("UNVAN", "UNVANI", "UNVAN1", "CARIUNVAN", "CARI_UNVAN", "FIRMAADI", "MUSTERIADI", "ADI") } | Select-Object -First 1
                        $kodCol = $colList | Where-Object { $_.ToUpperInvariant() -in @("CARIKOD", "KOD", "CARIKODU", "CARI_KOD", "CRK") } | Select-Object -First 1
                        if ($unvCol -and $kodCol) { $sampleCari = "$($sDt.Rows[0][$kodCol]) - $($sDt.Rows[0][$unvCol])" }
                    }
                } catch {}
            }

            $foundTargets += [PSCustomObject]@{
                Index = $foundTargets.Count + 1
                Database = $db
                CariTable = $cariTable
                CariCount = $cariCnt
                HarTable = $harTable
                HarCount = $harCnt
                Sample = $sampleCari
            }
        }
    } catch {}
}

if ($foundTargets.Count -eq 0) {
    Write-Host "[BILGI] Zirve veritabanlarinda standart 'CARI' tablosu bulunamadi." -ForegroundColor Yellow
    Write-Host "Mevcut tum veritabanlari:" -ForegroundColor Cyan
    $allDatabases | ForEach-Object { Write-Host " - $_" }
    Write-Host ""
    Write-Host "TAVSIYE: Zirve programindan 'Cari Bakiye Listesi'ni veya 'Ekstre'yi Excel olarak" -ForegroundColor Green
    Write-Host "kaydedip programin ekranina surukleyip birakabilirsiniz!" -ForegroundColor Green
    pause
    exit
}

Write-Host "============================================================================" -ForegroundColor Green
Write-Host " BULUNAN ZIRVE FIRMA VE CARI VERİTABANLARI:" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green

foreach ($t in $foundTargets) {
    Write-Host " [$($t.Index)] Veritabani: $($t.Database)" -ForegroundColor Cyan
    Write-Host "     • Cari Kart Tablosu   : $($t.CariTable) ($($t.CariCount) Cari Kaydi)" -ForegroundColor White
    Write-Host "     • Cari Hareket Tablosu: $($t.HarTable) ($($t.HarCount) Hareket Kaydi)" -ForegroundColor White
    if ($t.Sample) {
        Write-Host "     • Ornek Cari         : $($t.Sample)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "Hangi veritabanindaki cari ve hareket dokumunu programa aktarmak istersiniz?" -ForegroundColor Yellow
$selection = Read-Host "Seciminiz (1-$($foundTargets.Count) veya cikmak icin Enter)"

if ($selection -match "^\d+$" -and [int]$selection -le $foundTargets.Count -and [int]$selection -ge 1) {
    $selTarget = $foundTargets[[int]$selection - 1]
    Write-Host ""
    Write-Host "Secilen Veritabani: $($selTarget.Database)" -ForegroundColor Green
    Write-Host "Cariler ve hareketler okunuyor..." -ForegroundColor Yellow

    # Otomatik API senkronizasyonunu tetikle veya dogrudan data dosyasina yaz
    try {
        $syncPayload = @{
            server = $workingSrv
            authType = $workingAuth
            user = $workingUser
            password = $workingPass
            database = $selTarget.Database
            customCariTable = $selTarget.CariTable
            customCariHarTable = $selTarget.HarTable
        } | ConvertTo-Json

        $res = Invoke-RestMethod -Uri "http://localhost:8090/api/sql/sync" -Method Post -Body $syncPayload -ContentType "application/json; charset=utf-8" -TimeoutSec 10 -ErrorAction SilentlyContinue
        if ($res -and $res.ok) {
            Write-Host "TEBRIKLER! $($res.cariler.Count) Cari ve $($res.hareketler.Count) Cari Hareket basariyla aktarildi!" -ForegroundColor Green
            Write-Host "Tarayicinizdaki ekranda 'F5' tusuna basarak dokumu gorebilirsiniz." -ForegroundColor Cyan
        } else {
            Write-Host "Veritabani adi programa kaydedildi. Programi acip 'Zirve SQL' sekmesinden '$($selTarget.Database)' seciniz." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Not: Arka plandaki sunucuya baglanilamadi. Program acildiginda Veritabani olarak '$($selTarget.Database)' seciniz." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Tamamlandi. Cikmak icin bir tusa basiniz." -ForegroundColor Gray
pause
