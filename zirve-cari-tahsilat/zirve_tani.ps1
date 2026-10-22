[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$reportPath = Join-Path $PSScriptRoot "zirve_tani.txt"
$report = New-Object System.Text.StringBuilder

function Log-Line($text = "", $color = "White") {
    Write-Host $text -ForegroundColor $color
    [void]$report.AppendLine($text)
}

Log-Line "============================================================================" "Cyan"
Log-Line "      ZIRVE VERITABANI TESHIS VE TABLO INCELEME RAPORU" "Green"
Log-Line "      Tarih: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | Bilgisayar: $env:COMPUTERNAME" "Gray"
Log-Line "============================================================================" "Cyan"
Log-Line ""

function Exec-Query {
    param($srv, $db, $auth, $u, $p, $sql, $timeout = 20)
    $cs = if ($auth -eq "sql") {
        "Server=$srv;Database=$db;User Id=$u;Password=$p;ApplicationIntent=ReadOnly;Connection Timeout=2;TrustServerCertificate=True;"
    } else {
        "Server=$srv;Database=$db;Integrated Security=True;ApplicationIntent=ReadOnly;Connection Timeout=2;TrustServerCertificate=True;"
    }
    $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
    $conn.Open()
    try {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        $cmd.CommandTimeout = $timeout
        $adp = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dt = New-Object System.Data.DataTable
        [void]$adp.Fill($dt)
        return ,$dt
    } finally {
        $conn.Close()
    }
}

# 1. Bilgisayardaki SQL Servislerini ve Aday Sunuculari Belirle
$candidates = @()

# Zirve disk INI dosyalarini kontrol et
$searchDirs = @("C:\zirvenet", "D:\zirvenet", "E:\zirvenet", "C:\zirve", "D:\zirve", "C:\Program Files\Zirve", "C:\Program Files (x86)\Zirve")
foreach ($d in $searchDirs) {
    if (Test-Path $d) {
        $iniFiles = Get-ChildItem -Path $d -Filter "*.ini" -Recurse -Depth 2 -ErrorAction SilentlyContinue
        foreach ($ini in $iniFiles) {
            try {
                $lines = Get-Content -Path $ini.FullName -Encoding UTF8 -ErrorAction SilentlyContinue
                foreach ($l in $lines) {
                    if ($l -match "^\s*(?:Sunucu|Server|Data\s*Source|HOST)\s*=\s*(.+)$") {
                        $sCand = $matches[1].Trim()
                        if ($sCand -and ($candidates -notcontains $sCand)) { $candidates += $sCand }
                    }
                }
            } catch {}
        }
    }
}

try {
    $svcList = Get-Service | Where-Object { $_.Name -like "MSSQL*" -or $_.DisplayName -like "*SQL Server*" }
    foreach ($s in $svcList) {
        $sUpper = "$($s.Name) $($s.DisplayName)".ToUpperInvariant()
        if ($sUpper -like "*DINAMO*") { continue } # Dinamo'yu kesinlikle alma!
        $inst = if ($s.Name -eq "MSSQLSERVER") { "localhost" } elseif ($s.Name -like "MSSQL`$*") { ".\$($s.Name.Substring(6))" } else { $s.Name }
        if ($inst -and ($candidates -notcontains $inst)) {
            if ($sUpper -like "*ZIRVE*") {
                $candidates = @($inst) + $candidates
            } else {
                $candidates += $inst
            }
        }
    }
} catch {}

$zirveDefaults = @(".\ZIRVESQL", "localhost\ZIRVESQL", "(local)\ZIRVESQL", ".\ZIRVENET", ".\ZIRVE", "localhost\ZIRVE", ".\SQLEXPRESS", "localhost\SQLEXPRESS")
foreach ($zd in $zirveDefaults) {
    if ($candidates -notcontains $zd) { $candidates += $zd }
}
$candidates = $candidates | Select-Object -Unique

$workingSrv = $null
$workingAuth = $null
$workingUser = ""
$workingPass = ""
$allDbs = @()

$attempts = @(
    @{ auth = "windows"; u = ""; p = ""; lbl = "Windows Yetkilendirmesi (Sifresiz)" },
    @{ auth = "sql"; u = "sa"; p = "1"; lbl = "sa / 1 (Zirve Varsayilan)" },
    @{ auth = "sql"; u = "sa"; p = ""; lbl = "sa / Bos Sifre" },
    @{ auth = "sql"; u = "sa"; p = "1234"; lbl = "sa / 1234" },
    @{ auth = "sql"; u = "sa"; p = "zirve"; lbl = "sa / zirve" },
    @{ auth = "sql"; u = "sa"; p = "zirve1"; lbl = "sa / zirve1" }
)

Log-Line "1. SQL Sunucusu ve Yetkilendirme Tespiti..." "Yellow"

foreach ($srv in $candidates) {
    Write-Host "   -> Sunucu kontrol ediliyor: $srv..." -ForegroundColor Gray
    $serverDead = $false
    foreach ($att in $attempts) {
        try {
            $dt = Exec-Query -srv $srv -db "master" -auth $att.auth -u $att.u -p $att.p -sql "SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE' ORDER BY name"
            if ($dt -and $dt.Rows.Count -gt 0) {
                $workingSrv = $srv
                $workingAuth = $att.auth
                $workingUser = $att.u
                $workingPass = $att.p
                foreach ($r in $dt.Rows) { $allDbs += $r["name"].ToString() }
                Log-Line "   [BASARILI] Baglanildi: $srv ($($att.lbl))" "Green"
                break
            }
        } catch {
            $msg = $_.Exception.Message
            # Eger sunucu ornegi bulunamadiysa bu sunucu icin diger sifreleri bosuna deneme
            if ($msg -match "network-related" -or $msg -match "instance-specific" -or $msg -match "server was not found" -or $msg -match "Sunucu bulunamad") {
                $serverDead = $true
                break
            }
        }
    }
    if ($workingSrv) { break }
}

if (-not $workingSrv) {
    Log-Line "   [HATA] Bu bilgisayarda SQL Sunucusuna baglanilamadi!" "Red"
    Log-Line ""
    Log-Line "   DIKKAT: Zirve programi bu bilgisayarda degil baska bir ofis bilgisayarinda kuruludur." "Yellow"
    Log-Line "   Bu 'zirve-cari-tahsilat' klasorunu Zirve'nin acik oldugu bilgisayara kopyalayip" "Yellow"
    Log-Line "   orada 'zirve_tani.bat' dosyasina cift tiklayiniz." "Yellow"
    Log-Line ""
    [System.IO.File]::WriteAllText($reportPath, $report.ToString(), [System.Text.Encoding]::UTF8)
    try { Start-Process notepad.exe $reportPath } catch {}
    exit
}

Log-Line ""
Log-Line "2. Bulunan Veritabanlari ($($allDbs.Count) Adet):" "Yellow"
foreach ($d in $allDbs) {
    Log-Line "   - $d" "Gray"
}

Log-Line ""
Log-Line "3. Firma Veritabanlari ve Tablolar Inceleniyor..." "Yellow"

$tableQuery = "SELECT t.name AS TableName, ISNULL(SUM(p.rows), 0) AS RowCnt FROM sys.tables t LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1) GROUP BY t.name HAVING ISNULL(SUM(p.rows), 0) > 0 ORDER BY ISNULL(SUM(p.rows), 0) DESC"

foreach ($db in $allDbs) {
    if ($db -in @("master", "tempdb", "model", "msdb", "ReportServer", "ReportServerTempDB")) { continue }

    try {
        $tDt = Exec-Query -srv $workingSrv -db $db -auth $workingAuth -u $workingUser -p $workingPass -sql $tableQuery
        if (-not $tDt -or $tDt.Rows.Count -eq 0) { continue }

        Log-Line "----------------------------------------------------------------------------" "Cyan"
        Log-Line "VERITABANI: $db (Dolu Tablo Sayisi: $($tDt.Rows.Count))" "Green"
        Log-Line "----------------------------------------------------------------------------" "Cyan"

        foreach ($tr in $tDt.Rows) {
            $tName = $tr["TableName"].ToString()
            $rCnt = [int]$tr["RowCnt"]
            $upper = $tName.ToUpperInvariant()

            $isInteresting = ($upper -like "*CARI*" -or $upper -like "*HAR*" -or $upper -like "*HESAP*" -or $upper -like "*YEVMIYE*" -or $upper -like "*FATURA*" -or $upper -like "*CEK*" -or $upper -like "*SENET*" -or $upper -like "*KART*")

            if ($isInteresting -or $rCnt -gt 100) {
                Log-Line "   -> TABLO: $tName (Kayit Sayisi: $rCnt)" $(if ($isInteresting) { "Yellow" } else { "Gray" })

                if ($isInteresting) {
                    try {
                        $colDt = Exec-Query -srv $workingSrv -db $db -auth $workingAuth -u $workingUser -p $workingPass -sql "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='$tName'"
                        $cols = @()
                        foreach ($cr in $colDt.Rows) { $cols += "$($cr['COLUMN_NAME']) ($($cr['DATA_TYPE']))" }
                        $colStr = $cols -join ", "
                        Log-Line "      Kolonlar: $colStr" "DarkGray"

                        # Ilk 2 kaydi ornek olarak goster
                        $sampleDt = Exec-Query -srv $workingSrv -db $db -auth $workingAuth -u $workingUser -p $workingPass -sql "SELECT TOP 2 * FROM [$tName] WITH (NOLOCK)"
                        if ($sampleDt -and $sampleDt.Rows.Count -gt 0) {
                            $rowNum = 1
                            foreach ($sr in $sampleDt.Rows) {
                                $vals = @()
                                foreach ($c in $sampleDt.Columns) {
                                    $v = "$($sr[$c.ColumnName])".Trim()
                                    if ($v) { $vals += "$($c.ColumnName)=$v" }
                                }
                                $sampleLine = ($vals | Select-Object -First 6) -join " | "
                                Log-Line "      Ornek $rowNum : $sampleLine" "Cyan"
                                $rowNum++
                            }
                        }
                    } catch {
                        Log-Line "      Kolonlar alinamadi: $($_.Exception.Message)" "Red"
                    }
                    Log-Line ""
                }
            }
        }
    } catch {
        Log-Line "   [$db] incelenemedi: $($_.Exception.Message)" "Red"
    }
}

Log-Line ""
Log-Line "============================================================================" "Cyan"
Log-Line "RAPOR TAMAMLANDI: $reportPath dosyasina kaydedildi." "Green"
Log-Line "Bu dosyayi acip icerigini gorebilirsiniz." "Yellow"
Log-Line "============================================================================" "Cyan"

[System.IO.File]::WriteAllText($reportPath, $report.ToString(), [System.Text.Encoding]::UTF8)
try { Start-Process notepad.exe $reportPath } catch {}
