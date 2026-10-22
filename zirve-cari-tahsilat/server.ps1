[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$port = 8090
$folder = $PSScriptRoot
$dataDir = Join-Path $folder "data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}
$dbFile = Join-Path $dataDir "zirve_finans_db.json"

function Get-SqlConnectionString {
    param($cfg, $databaseName = "master")
    $srv = if ($cfg.server) { $cfg.server } else { ".\ZIRVESQL" }
    $db = if ($databaseName) { $databaseName } elseif ($cfg.database) { $cfg.database } else { "master" }
    if ($cfg.authType -eq "sql" -and $cfg.user) {
        return "Server=$srv;Database=$db;User Id=$($cfg.user);Password=$($cfg.password);ApplicationIntent=ReadOnly;Connection Timeout=2;TrustServerCertificate=True;"
    } else {
        return "Server=$srv;Database=$db;Integrated Security=True;ApplicationIntent=ReadOnly;Connection Timeout=2;TrustServerCertificate=True;"
    }
}

function Invoke-SqlQuery {
    param([string]$connStr, [string]$query)
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    try {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $query
        $cmd.CommandTimeout = 30
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dt = New-Object System.Data.DataTable
        [void]$adapter.Fill($dt)
        $rows = @()
        foreach ($r in $dt.Rows) {
            $obj = @{}
            foreach ($c in $dt.Columns) {
                $val = $r[$c.ColumnName]
                if ($val -is [System.DBNull]) { $val = $null }
                elseif ($val -is [DateTime]) { $val = $val.ToString("yyyy-MM-dd") }
                $obj[$c.ColumnName] = $val
            }
            $rows += $obj
        }
        return ,$rows
    } finally {
        $conn.Close()
    }
}

function ConvertTo-DoubleSafe($val) {
    if ($null -eq $val -or $val -is [System.DBNull]) { return 0.0 }
    if ($val -is [double] -or $val -is [float] -or $val -is [decimal] -or $val -is [int] -or $val -is [long]) {
        return [double]$val
    }
    $str = "$val".Trim()
    if ([string]::IsNullOrWhiteSpace($str)) { return 0.0 }
    $res = 0.0
    if ([double]::TryParse($str, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$res)) {
        return $res
    }
    $trCulture = [System.Globalization.CultureInfo]::GetCultureInfo("tr-TR")
    if ([double]::TryParse($str, [System.Globalization.NumberStyles]::Any, $trCulture, [ref]$res)) {
        return $res
    }
    $cleanStr = $str.Replace(" ", "").Replace(".", "").Replace(",", ".")
    if ([double]::TryParse($cleanStr, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$res)) {
        return $res
    }
    return 0.0
}

function Get-ZirveConfigFromDisk {
    $searchDirs = @("C:\zirvenet", "D:\zirvenet", "E:\zirvenet", "C:\zirve", "D:\zirve", "C:\Program Files\Zirve", "C:\Program Files (x86)\Zirve")
    $found = @()
    foreach ($d in $searchDirs) {
        if (Test-Path $d) {
            $iniFiles = Get-ChildItem -Path $d -Filter "*.ini" -Recurse -Depth 2 -ErrorAction SilentlyContinue
            foreach ($ini in $iniFiles) {
                try {
                    $lines = Get-Content -Path $ini.FullName -Encoding UTF8 -ErrorAction SilentlyContinue
                    $srv = ""
                    $usr = ""
                    $pwd = ""
                    foreach ($l in $lines) {
                        if ($l -match "^\s*(?:Sunucu|Server|Data\s*Source|HOST)\s*=\s*(.+)$") {
                            $srv = $matches[1].Trim()
                        }
                        if ($l -match "^\s*(?:Kullanici|User|UID|User\s*Id)\s*=\s*(.+)$") {
                            $usr = $matches[1].Trim()
                        }
                        if ($l -match "^\s*(?:Sifre|Password|PWD)\s*=\s*(.+)$") {
                            $pwd = $matches[1].Trim()
                        }
                    }
                    if ($srv) {
                        $already = $found | Where-Object { $_.server -eq $srv }
                        if (-not $already) {
                            $found += @{
                                iniFile = $ini.FullName
                                server = $srv
                                user = if ($usr) { $usr } else { "sa" }
                                password = $pwd
                            }
                        }
                    }
                } catch {}
            }
        }
    }
    return $found
}

function Discover-ZirveSql {
    $services = @()
    try {
        $svcList = Get-Service | Where-Object { $_.Name -like "MSSQL*" -or $_.DisplayName -like "*SQL Server*" }
        foreach ($s in $svcList) {
            $instName = if ($s.Name -eq "MSSQLSERVER") { "localhost" } elseif ($s.Name -like "MSSQL`$*") { ".\$($s.Name.Substring(6))" } else { $s.Name }
            $services += @{
                serviceName = $s.Name
                displayName = $s.DisplayName
                status = $s.Status.ToString()
                suggestedServer = $instName
                isDinamo = ($s.Name -like "*DINAMO*" -or $s.DisplayName -like "*DINAMO*")
                isZirve = ($s.Name -like "*ZIRVE*" -or $s.DisplayName -like "*ZIRVE*")
            }
        }
    } catch {}

    # 1. Zirve disk INI dosyalarından sunucuları al
    $candidates = @()
    $iniCfgs = Get-ZirveConfigFromDisk
    foreach ($ic in $iniCfgs) {
        if ($ic.server -and ($candidates -notcontains $ic.server)) { $candidates += $ic.server }
    }

    # 2. Zirve servislerini ekle
    foreach ($svc in $services) {
        if ($svc.isZirve -and $svc.suggestedServer -and ($candidates -notcontains $svc.suggestedServer)) {
            $candidates += $svc.suggestedServer
        }
    }

    # 3. Zirve varsayılan instance adları (Dinamo KESİNLİKLE buraya eklenmez!)
    $zirveDefaults = @(".\ZIRVESQL", "localhost\ZIRVESQL", "(local)\ZIRVESQL", ".\ZIRVENET", ".\ZIRVE", "localhost\ZIRVE", ".\SQLEXPRESS", "localhost\SQLEXPRESS")
    foreach ($zd in $zirveDefaults) {
        if ($candidates -notcontains $zd) { $candidates += $zd }
    }

    $foundInstances = @()
    foreach ($srv in $candidates) {
        if ($srv.ToUpperInvariant() -like "*DINAMO*") { continue } # Dinamo instance'larını Zirve aramasına sokma!

        $authAttempts = @(
            @{ authType = "windows"; user = ""; password = ""; label = "Windows Yetkilendirmesi" },
            @{ authType = "sql"; user = "sa"; password = "1"; label = "SQL (sa / 1)" },
            @{ authType = "sql"; user = "sa"; password = ""; label = "SQL (sa / sifresiz)" },
            @{ authType = "sql"; user = "sa"; password = "1234"; label = "SQL (sa / 1234)" },
            @{ authType = "sql"; user = "sa"; password = "zirve"; label = "SQL (sa / zirve)" }
        )
        foreach ($auth in $authAttempts) {
            try {
                $cfg = @{ server = $srv; authType = $auth.authType; user = $auth.user; password = $auth.password }
                $cs = Get-SqlConnectionString -cfg $cfg -databaseName "master"
                $dbs = Invoke-SqlQuery -connStr $cs -query "SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE' ORDER BY name"
                $dbNames = @()
                foreach ($d in $dbs) { $dbNames += $d.name }
                $foundInstances += @{
                    server = $srv
                    authType = $auth.authType
                    user = $auth.user
                    password = $auth.password
                    authLabel = $auth.label
                    databases = $dbNames
                }
                break
            } catch {
                $msg = $_.Exception.Message
                if ($msg -match "network-related" -or $msg -match "instance-specific" -or $msg -match "server was not found" -or $msg -match "Sunucu bulunamad") {
                    break
                }
            }
        }
    }

    return @{
        ok = $true
        services = $services
        instances = $foundInstances
        iniConfigs = $iniCfgs
    }
}

function Pick-Column {
    param($availableCols, [string[]]$candidates)
    foreach ($cand in $candidates) {
        foreach ($col in $availableCols) {
            if ($col.ToUpperInvariant() -eq $cand.ToUpperInvariant()) {
                return $col
            }
        }
    }
    foreach ($cand in $candidates) {
        foreach ($col in $availableCols) {
            if ($col.ToUpperInvariant() -like "*$($cand.ToUpperInvariant())*") {
                return $col
            }
        }
    }
    return $null
}

function AutoScan-AllZirveDatabases {
    param($cfg)

    # 1. Aday SQL Sunucularını ve Yetkilendirmeleri Belirle
    $candidates = @()
    if ($cfg.server -and ($cfg.server.ToUpperInvariant() -notlike "*DINAMO*")) {
        $candidates += $cfg.server
    }

    # Zirve disk INI dosyalarını kontrol et
    $iniCfgs = Get-ZirveConfigFromDisk
    foreach ($ic in $iniCfgs) {
        if ($ic.server -and ($candidates -notcontains $ic.server)) { $candidates += $ic.server }
    }

    # Bilgisayarda çalışan Zirve SQL servislerini listeye ekle (Dinamo KESİNLİKLE eklenmez!)
    try {
        $svcList = Get-Service | Where-Object { $_.Name -like "MSSQL*" -or $_.DisplayName -like "*SQL Server*" }
        foreach ($s in $svcList) {
            $sUpper = "$($s.Name) $($s.DisplayName)".ToUpperInvariant()
            if ($sUpper -like "*DINAMO*") { continue } # Dinamo'yu kesinlikle listeye alma
            $inst = if ($s.Name -eq "MSSQLSERVER") { "localhost" } elseif ($s.Name -like "MSSQL`$*") { ".\$($s.Name.Substring(6))" } else { $s.Name }
            if ($inst -and ($candidates -notcontains $inst)) {
                if ($sUpper -like "*ZIRVE*") {
                    $candidates = @($inst) + $candidates # Zirve servislerini en başa al
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

    # Zirve'nin kullandığı yaygın şifreler ve yetkilendirmeler
    $authAttempts = @()
    if ($cfg.authType -eq "sql" -and $cfg.user) {
        $authAttempts += @{ authType = "sql"; user = $cfg.user; password = $cfg.password; label = "Girilmiş SQL Şifresi" }
    } elseif ($cfg.authType -eq "windows") {
        $authAttempts += @{ authType = "windows"; user = ""; password = ""; label = "Windows Yetkilendirmesi" }
    }

    $authAttempts += @(
        @{ authType = "windows"; user = ""; password = ""; label = "Windows Yetkilendirmesi" },
        @{ authType = "sql"; user = "sa"; password = "1"; label = "sa / 1 (Zirve Varsayılan)" },
        @{ authType = "sql"; user = "sa"; password = ""; label = "sa / boş şifre" },
        @{ authType = "sql"; user = "sa"; password = "1234"; label = "sa / 1234" },
        @{ authType = "sql"; user = "sa"; password = "zirve"; label = "sa / zirve" },
        @{ authType = "sql"; user = "sa"; password = "zirve1"; label = "sa / zirve1" }
    )

    $workingConnStr = $null
    $workingCfg = $null
    $dbs = @()
    $lastError = ""

    # Her sunucuyu ve her şifre kombinasyonunu test et
    foreach ($srv in $candidates) {
        $serverDead = $false
        foreach ($auth in $authAttempts) {
            try {
                $testCfg = @{ server = $srv; authType = $auth.authType; user = $auth.user; password = $auth.password }
                $csMaster = Get-SqlConnectionString -cfg $testCfg -databaseName "master"
                $rawDbs = Invoke-SqlQuery -connStr $csMaster -query "SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE' ORDER BY name"
                if ($rawDbs -and $rawDbs.Count -gt 0) {
                    $workingConnStr = $csMaster
                    $workingCfg = $testCfg
                    $dbs = $rawDbs
                    break
                }
            } catch {
                $lastError = $_.Exception.Message
                if ($lastError -match "network-related" -or $lastError -match "instance-specific" -or $lastError -match "server was not found" -or $lastError -match "Sunucu bulunamad") {
                    $serverDead = $true
                    break
                }
            }
        }
        if ($workingCfg) { break }
    }

    if (-not $workingCfg) {
        return @{
            ok = $false
            error = "Zirve SQL Sunucusuna bağlanılamadı. ($lastError). Eğer Zirve bu bilgisayarda kurulu değilse lütfen üst kutudan 'Zirve Ağdaki Bilgisayarda Kurulu' seçeneğini seçip ana bilgisayarın IP adresini yazınız."
            candidates = @()
        }
    }

    # 2. Zirve Genel Veritabanında Şirket Tanımları Var mı Kontrol Et
    $firmaMap = @{}
    foreach ($masterDb in @("ZIRVEDB", "ZIRVE_GENEL", "GENEL")) {
        try {
            $csGenel = Get-SqlConnectionString -cfg $workingCfg -databaseName $masterDb
            $fRows = Invoke-SqlQuery -connStr $csGenel -query "SELECT FIRMAKODU, UNVAN FROM FIRMALAR WITH (NOLOCK)"
            foreach ($fr in $fRows) {
                if ($fr.FIRMAKODU -and $fr.UNVAN) {
                    $firmaMap["$($fr.FIRMAKODU)".Trim().ToUpperInvariant()] = "$($fr.UNVAN)".Trim()
                }
            }
        } catch {}
    }

    # 3. Her veritabanını tara ve Cari / Hareket tablolarını puanla
    $results = @()
    foreach ($d in $dbs) {
        $dbName = $d.name
        if ($dbName -in @("master", "tempdb", "model", "msdb", "ReportServer", "ReportServerTempDB")) { continue }

        try {
            $csDb = Get-SqlConnectionString -cfg $workingCfg -databaseName $dbName
            $tRaw = Invoke-SqlQuery -connStr $csDb -query @"
SELECT t.name AS TableName, ISNULL(SUM(p.rows), 0) AS RowCnt
FROM sys.tables t
LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
GROUP BY t.name
HAVING ISNULL(SUM(p.rows), 0) > 0
"@
            if (-not $tRaw -or $tRaw.Count -eq 0) { continue }

            $tblMap = @{}
            foreach ($row in $tRaw) { $tblMap[$row.TableName] = [int]$row.RowCnt }
            $allTblNames = @($tblMap.Keys)

            $cariTbl = $null
            foreach ($cand in @("CARI", "CARIKART", "TBLCARI", "CARI_KART", "CARILER", "CARIHESAP", "CARIKARTLAR", "TBL_CARI", "MUSTERI", "CARIGENEL", "TBLCARIKART")) {
                foreach ($tn in $allTblNames) {
                    if ($tn.ToUpperInvariant() -eq $cand) { $cariTbl = $tn; break }
                }
                if ($cariTbl) { break }
            }
            if (-not $cariTbl) {
                foreach ($tn in $allTblNames) {
                    $u = $tn.ToUpperInvariant()
                    if ($u -like "*CARI*" -and $u -notlike "*HAR*" -and $u -notlike "*EK*" -and $u -notlike "*NOT*" -and $u -notlike "*LOG*") {
                        $cariTbl = $tn; break
                    }
                }
            }

            $harTbl = $null
            foreach ($cand in @("CARIHAR", "CARI_HAREKET", "CARIHAREKET", "TBLCARIHAR", "CARIHAR2", "CHAREKET", "TBL_CARIHAR", "HAREKET", "CARI_HAR", "CARIHAREKETLER")) {
                foreach ($tn in $allTblNames) {
                    if ($tn.ToUpperInvariant() -eq $cand) { $harTbl = $tn; break }
                }
                if ($harTbl) { break }
            }
            if (-not $harTbl) {
                foreach ($tn in $allTblNames) {
                    $u = $tn.ToUpperInvariant()
                    if ($u -like "*CARI*HAR*" -or $u -like "*CHAREKET*" -or $u -like "*CARI*ISLEM*") {
                        $harTbl = $tn; break
                    }
                }
            }

            if ($cariTbl -or $harTbl) {
                $cCount = if ($cariTbl -and $tblMap.ContainsKey($cariTbl)) { $tblMap[$cariTbl] } else { 0 }
                $hCount = if ($harTbl -and $tblMap.ContainsKey($harTbl)) { $tblMap[$harTbl] } else { 0 }

                $sampleName = ""
                if ($cariTbl -and $cCount -gt 0) {
                    try {
                        $sRows = Invoke-SqlQuery -connStr $csDb -query "SELECT TOP 1 * FROM [$cariTbl] WITH (NOLOCK)"
                        if ($sRows -and $sRows.Count -gt 0) {
                            $rObj = $sRows[0]
                            foreach ($k in $rObj.Keys) {
                                if ($k.ToUpperInvariant() -in @("STA", "UNVAN", "CARIUNVAN", "ADI", "FIRMAADI")) {
                                    $sampleName = "$($rObj[$k])".Trim()
                                    break
                                }
                            }
                        }
                    } catch {}
                }

                # Eğer ZirveDB'den şirket unvanı eşleşirse göster
                $upperDb = $dbName.ToUpperInvariant()
                foreach ($fKod in $firmaMap.Keys) {
                    if ($upperDb.StartsWith($fKod) -or $upperDb.Contains($fKod)) {
                        if (-not $sampleName) { $sampleName = "Firma: $($firmaMap[$fKod])" }
                        break
                    }
                }

                $sonTarih = ""
                if ($harTbl -and $hCount -gt 0) {
                    try {
                        $hCols = Invoke-SqlQuery -connStr $csDb -query "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='$harTbl'"
                        $colList = @()
                        foreach ($hc in $hCols) { $colList += $hc.COLUMN_NAME }
                        $tCol = Pick-Column $colList @("TARIH", "ISLEMTARIHI", "TAR", "DATE")
                        if ($tCol) {
                            $maxDateRes = Invoke-SqlQuery -connStr $csDb -query "SELECT MAX([$tCol]) AS SonTarih FROM [$harTbl] WITH (NOLOCK)"
                            if ($maxDateRes -and $maxDateRes.Count -gt 0 -and $maxDateRes[0].SonTarih) {
                                $sonTarih = "$($maxDateRes[0].SonTarih)"
                            }
                        }
                    } catch {}
                }

                $yearBonus = 0
                if ($dbName -like "*2026*" -or $sonTarih -like "*2026*") { $yearBonus = 10000 }
                elseif ($dbName -like "*2025*" -or $sonTarih -like "*2025*") { $yearBonus = 5000 }

                $results += @{
                    database = $dbName
                    cariTable = $cariTbl
                    cariCount = $cCount
                    harTable = $harTbl
                    harCount = $hCount
                    sampleCari = $sampleName
                    sonTarih = $sonTarih
                    score = ($cCount * 2) + $hCount + $yearBonus
                }
            }
        } catch {}
    }

    $sorted = $results | Sort-Object -Property score -Descending
    return @{
        ok = $true
        workingConfig = $workingCfg
        candidates = ,$sorted
    }
}

function Sync-ZirveDatabase {
    param($cfg)

    # Bağlantıyı test et, gerekirse Zirve şifre alternatiflerini dene
    $cs = Get-SqlConnectionString -cfg $cfg -databaseName $cfg.database
    $workingConn = $false
    try {
        $testConn = New-Object System.Data.SqlClient.SqlConnection($cs)
        $testConn.Open()
        $testConn.Close()
        $workingConn = $true
    } catch {}

    if (-not $workingConn) {
        $fallbacks = @(
            @{ authType = "sql"; user = "sa"; password = "1" },
            @{ authType = "sql"; user = "sa"; password = "" },
            @{ authType = "sql"; user = "sa"; password = "1234" },
            @{ authType = "sql"; user = "sa"; password = "zirve" },
            @{ authType = "windows"; user = ""; password = "" }
        )
        foreach ($fb in $fallbacks) {
            try {
                $altCfg = @{ server = $cfg.server; authType = $fb.authType; user = $fb.user; password = $fb.password; database = $cfg.database }
                $altCs = Get-SqlConnectionString -cfg $altCfg -databaseName $cfg.database
                $testConn = New-Object System.Data.SqlClient.SqlConnection($altCs)
                $testConn.Open()
                $testConn.Close()
                $cs = $altCs
                $workingConn = $true
                break
            } catch {}
        }
    }

    $tablesRaw = @()
    try {
        $tablesRaw = Invoke-SqlQuery -connStr $cs -query @"
SELECT t.name AS TableName, ISNULL(SUM(p.rows), 0) AS RowCnt
FROM sys.tables t
LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
GROUP BY t.name
ORDER BY ISNULL(SUM(p.rows), 0) DESC
"@
    } catch {
        try {
            $tablesRaw = Invoke-SqlQuery -connStr $cs -query "SELECT TABLE_NAME AS TableName, 0 AS RowCnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
        } catch {}
    }

    $colsRaw = Invoke-SqlQuery -connStr $cs -query "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS"
    $tableMap = @{}
    foreach ($r in $colsRaw) {
        $tn = $r.TABLE_NAME
        if (-not $tableMap.ContainsKey($tn)) { $tableMap[$tn] = @() }
        $tableMap[$tn] += $r.COLUMN_NAME
    }

    $allTableNames = @($tableMap.Keys)

    # 1. CARI KART TABLOSU BUL (Önce kullanıcının seçimi, yoksa kayıt sayısı en yüksek olanı bul)
    $cariTable = if ($cfg.customCariTable -and ($allTableNames -contains $cfg.customCariTable)) { $cfg.customCariTable } else { $null }
    if (-not $cariTable) {
        $bestCariCnt = -1
        foreach ($cand in @("CARIKART", "CARI", "TBLCARI", "CARI_KART", "CARILER", "CARIHESAP", "CARIKARTLAR", "TBL_CARI", "CARI_HESAP", "MUSTERI", "CARIGENEL", "TBLCARIKART", "HESAP", "HESAPPLANI", "PLAN", "TBLHESAP")) {
            foreach ($tn in $allTableNames) {
                if ($tn.ToUpperInvariant() -eq $cand) {
                    $cnt = if ($tblMap.ContainsKey($tn)) { [int]$tblMap[$tn] } else { 0 }
                    if ($cnt -gt $bestCariCnt) {
                        $bestCariCnt = $cnt
                        $cariTable = $tn
                    }
                }
            }
        }
    }
    if (-not $cariTable) {
        foreach ($tn in $allTableNames) {
            $upper = $tn.ToUpperInvariant()
            if ($upper -like "*CARI*" -and $upper -notlike "*HAR*" -and $upper -notlike "*EK*" -and $upper -notlike "*NOT*" -and $upper -notlike "*LOG*") {
                $cariTable = $tn; break
            }
        }
    }

    # 2. CARI HAREKET TABLOSU BUL (Önce kullanıcının seçimi, yoksa kayıt sayısı > 0 olan tabloyu seç)
    $cariHarTable = if ($cfg.customCariHarTable -and ($allTableNames -contains $cfg.customCariHarTable)) { $cfg.customCariHarTable } else { $null }
    $harCandidates = @("CARIHAR", "CHAREKET", "CARI_HAREKET", "CARIHAREKET", "TBLCARIHAR", "TBL_CARIHAR", "CARIHAR2", "CARI_HAR", "CARIHAREKETLER", "CARISATIR", "CARIFIS", "CARI_ISLEM", "CARIISLEM", "HAREKETLER", "HAREKET", "CH", "CARIEKSTRE", "YEVMIYE", "YEVMIYEHAR", "MUHASEBE", "MUHASEBEHAR", "FISHAR", "FIS")
    if (-not $cariHarTable) {
        $maxHarCnt = -1
        foreach ($cand in $harCandidates) {
            foreach ($tn in $allTableNames) {
                if ($tn.ToUpperInvariant() -eq $cand) {
                    $cnt = if ($tblMap.ContainsKey($tn)) { [int]$tblMap[$tn] } else { 0 }
                    if ($cnt -gt $maxHarCnt) {
                        $maxHarCnt = $cnt
                        $cariHarTable = $tn
                    }
                }
            }
        }
        if (-not $cariHarTable) {
            foreach ($tn in $allTableNames) {
                $upper = $tn.ToUpperInvariant()
                if (($upper -like "*CARI*HAR*" -or $upper -like "*CHAREKET*" -or $upper -like "*CARI*ISLEM*") -and $upper -notlike "*LOG*") {
                    $cnt = if ($tblMap.ContainsKey($tn)) { [int]$tblMap[$tn] } else { 0 }
                    if ($cnt -gt $maxHarCnt) {
                        $maxHarCnt = $cnt
                        $cariHarTable = $tn
                    }
                }
            }
        }
    }

    # 2.B ÇAPRAZ VERİTABANI KONTROLÜ (Eğer cari hareketler bu veritabanında 0 ise, yıl veritabanına bak: örn. FIRMA_2026)
    $harCs = $cs
    $harDbName = $cfg.database
    $harRowCnt = if ($cariHarTable -and $tblMap.ContainsKey($cariHarTable)) { [int]$tblMap[$cariHarTable] } else { 0 }

    if (-not $cariHarTable -or $harRowCnt -le 0) {
        try {
            $csMaster = Get-SqlConnectionString -cfg $cfg -databaseName "master"
            $allDbs = Invoke-SqlQuery -connStr $csMaster -query "SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE'"
            $baseClean = $cfg.database -replace "_20\d\d$", "" -replace "20\d\d$", "" -replace "_GENEL$", ""
            foreach ($d in $allDbs) {
                $candDb = $d.name
                if ($candDb -eq $cfg.database) { continue }
                if ($candDb -like "*$baseClean*" -or $candDb -like "*2026*" -or $candDb -like "*2025*") {
                    try {
                        $csOther = Get-SqlConnectionString -cfg $cfg -databaseName $candDb
                        $otherTables = Invoke-SqlQuery -connStr $csOther -query "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'"
                        foreach ($ot in $otherTables) {
                            if ($ot.TABLE_NAME.ToUpperInvariant() -in $harCandidates) {
                                $cntRes = Invoke-SqlQuery -connStr $csOther -query "SELECT COUNT(1) AS Cnt FROM [$($ot.TABLE_NAME)] WITH (NOLOCK)"
                                if ($cntRes -and [int]$cntRes[0].Cnt -gt 0) {
                                    $cariHarTable = $ot.TABLE_NAME
                                    $harDbName = $candDb
                                    $harCs = $csOther
                                    break
                                }
                            }
                        }
                    } catch {}
                }
                if ($cariHarTable -and $harCs -ne $cs) { break }
            }
        } catch {}
    }

    # 3. FATURA TABLOSU BUL
    $faturaTable = $null
    foreach ($cand in @("FATURA", "FATURAUST", "TBLFATUIRS", "FATURALAR", "EFATURA", "FATURAHAR")) {
        foreach ($tn in $allTableNames) {
            if ($tn.ToUpperInvariant() -eq $cand) { $faturaTable = $tn; break }
        }
        if ($faturaTable) { break }
    }

    # 4. CEK/SENET TABLOSU BUL
    $cekSenetTable = $null
    foreach ($cand in @("CEKSENET", "CEK_SENET", "CEKLER", "TBLCEKSENET", "TBL_CEKSENET")) {
        foreach ($tn in $allTableNames) {
            if ($tn.ToUpperInvariant() -eq $cand) { $cekSenetTable = $tn; break }
        }
        if ($cekSenetTable) { break }
    }

    $cariler = @()
    if ($cariTable) {
        $cCols = $tableMap[$cariTable]
        $colRef   = Pick-Column $cCols @("REF", "LOGICALREF", "ID", "SIRANO", "IND", "CARIID")
        $colVkn   = Pick-Column $cCols @("VERGINO", "VKN", "TCKIMLIKNO", "VERGI_NO", "TCNO", "TCKNO", "VERGI_NUMARASI", "IDENTITY_NO")
        $colVd    = Pick-Column $cCols @("VERGIDAIRESI", "VD", "VERGI_DAIRESI", "DAIRESI")
        $colTel   = Pick-Column $cCols @("TEL", "TELEFON", "TEL1", "TELEFON1", "CEPTEL", "GSM", "TELEFONU")
        $colMail  = Pick-Column $cCols @("EMAIL", "EPOSTA", "MAIL", "E_MAIL")
        $colVade  = Pick-Column $cCols @("VADGUN", "VADEGUNU", "VADE", "ODEMEGUNU", "OPSIYON", "GUN")
        $colDoviz = Pick-Column $cCols @("DOVIZCINSI", "DOVIZ", "PARABIRIMI", "DOVIZKODU", "CURRENCY")
        $colTur   = Pick-Column $cCols @("TIP", "TIPI", "CARITIP", "GRUPKOD", "OZELKOD1", "OZELKOD")

        $rawCariler = Invoke-SqlQuery -connStr $cs -query "SELECT TOP 10000 * FROM [$cariTable] WITH (NOLOCK)"
        $idx = 1
        foreach ($rc in $rawCariler) {
            # Cari Kodu Çıkar
            $kodVal = ""
            foreach ($kCand in @("CARIKOD", "KOD", "CARIKODU", "CARI_KOD", "HESAPKODU", "FIRMAKODU", "MUSTERIKODU", "CRK", "CODE", "CARINO")) {
                $mK = Pick-Column $cCols @($kCand)
                if ($mK -and $rc[$mK] -and -not [string]::IsNullOrWhiteSpace("$($rc[$mK])")) {
                    $kodVal = "$($rc[$mK])".Trim()
                    break
                }
            }
            if (-not $kodVal) {
                $kodVal = if ($colRef -and $rc[$colRef]) { "CR-$($rc[$colRef])" } else { "CR-$idx" }
            }

            # Cari Ünvanı (Adı) Çıkar — Asla STA (Status) alınmaz!
            $unvanVal = ""
            foreach ($uCand in @("UNVAN", "UNVANI", "UNVAN1", "UNVANI1", "UNVAN_1", "UNVANI_1", "HESAPISMI", "HESAP_ISMI", "HESAPADI", "HESAP_ADI", "CARIUNVAN", "CARI_UNVAN", "CARI_UNVANI", "FIRMAADI", "FIRMA_ADI", "TICARETUNVANI", "TICARET_UNVANI", "MUSTERIADI", "MUSTERI_ADI", "ADISOYADI", "ADI", "ADI1", "ISIM", "ACIKLAMA", "TANIMI")) {
                $mU = Pick-Column $cCols @($uCand)
                if ($mU -and $rc[$mU] -and -not [string]::IsNullOrWhiteSpace("$($rc[$mU])")) {
                    $candText = "$($rc[$mU])".Trim()
                    if ($candText.Length -gt 1) {
                        $unvanVal = $candText
                        # UNVAN2 varsa birleştir (Zirve uzun unvanları UNVAN1 ve UNVAN2 olarak tutar)
                        foreach ($u2Cand in @("UNVAN2", "UNVANI2", "UNVANI_2", "SOYADI")) {
                            $m2 = Pick-Column $cCols @($u2Cand)
                            if ($m2 -and $rc[$m2] -and -not [string]::IsNullOrWhiteSpace("$($rc[$m2])")) {
                                $unvanVal = "$unvanVal $($rc[$m2])".Trim()
                                break
                            }
                        }
                        break
                    }
                }
            }

            # Eğer standart unvan bulunamadıysa satırdaki string kolonları tara
            if (-not $unvanVal -or $unvanVal -eq $kodVal) {
                foreach ($cName in $cCols) {
                    $uN = $cName.ToUpperInvariant()
                    if (($uN -like "*UNVAN*" -or $uN -like "*ADI*" -or $uN -like "*NAME*" -or $uN -like "*TITLE*" -or $uN -like "*ISMI*" -or $uN -like "*TANIM*") -and $uN -notlike "*KOD*" -and $uN -notlike "*REF*" -and $uN -notlike "*ID*" -and $uN -notlike "*VERGI*") {
                        $strVal = "$($rc[$cName])".Trim()
                        if ($strVal.Length -gt 2) {
                            $unvanVal = $strVal
                            break
                        }
                    }
                }
            }

            if (-not $unvanVal) { $unvanVal = $kodVal }

            $cariler += @{
                id = if ($colRef -and $rc[$colRef]) { "ZRV-C-$($rc[$colRef])" } else { "ZRV-C-$kodVal" }
                ref = if ($colRef -and $rc[$colRef]) { "$($rc[$colRef])".Trim() } else { $kodVal }
                kod = $kodVal
                unvan = $unvanVal
                vkn = if ($colVkn -and $rc[$colVkn]) { "$($rc[$colVkn])".Trim() } else { "" }
                vergiDairesi = if ($colVd -and $rc[$colVd]) { "$($rc[$colVd])".Trim() } else { "" }
                telefon = if ($colTel -and $rc[$colTel]) { "$($rc[$colTel])".Trim() } else { "" }
                email = if ($colMail -and $rc[$colMail]) { "$($rc[$colMail])".Trim() } else { "" }
                vadeGunu = if ($colVade -and $rc[$colVade]) { [int]$rc[$colVade] } else { 30 }
                doviz = if ($colDoviz -and $rc[$colDoviz]) { "$($rc[$colDoviz])".Trim() } else { "TRY" }
                grup = if ($colTur -and $rc[$colTur]) { "$($rc[$colTur])".Trim() } else { "Genel" }
                kaynak = "Zirve SQL ($cariTable)"
            }
            $idx++
        }
    }

    $hareketler = @()
    if ($cariHarTable) {
        $hColsRaw = Invoke-SqlQuery -connStr $harCs -query "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='$cariHarTable'"
        $hCols = @()
        foreach ($hc in $hColsRaw) { $hCols += $hc.COLUMN_NAME }

        $colHCari   = Pick-Column $hCols @("CARIKOD", "KOD", "CARIKODU", "CARI_KOD", "HESAPKODU", "HESAP_KODU", "FIRMAKODU", "CRK", "CARINO", "CLIENT_CODE", "HESAP")
        $colHRef    = Pick-Column $hCols @("CARIREF", "CARIID", "CARI_REF", "CARI_ID", "REF", "IND", "LOGICALREF", "ID", "SIRANO", "HAREKETID")
        $colHTarih  = Pick-Column $hCols @("TARIH", "ISLEMTARIHI", "EVRAKTARIHI", "TAR", "TARIHI", "DATE", "FIS_TARIHI", "BELGE_TARIHI")
        $colHVade   = Pick-Column $hCols @("VADETARIHI", "VADE", "ODEMETARIHI", "VADTAR", "VADE_TARIHI", "DUEDATE")
        $colHEvrak  = Pick-Column $hCols @("EVRAKNO", "BELGENO", "FISNO", "FATURANO", "SERINO", "EVRAK_NO", "BELGE_NO", "FIS_NO", "DOC_NO", "NO")
        $colHTur    = Pick-Column $hCols @("ISLEMTURU", "ISLEMTIPI", "TUR", "TIPI", "MODUL", "TRCODE", "KAYITTIPI", "ISLEM_TURU", "HAREKET_TURU", "TURU")
        $colHAcik   = Pick-Column $hCols @("ACIKLAMA", "ACIKLAMA1", "NOT1", "DETAY", "ACIK", "ACIKLAMA_1", "DESCRIPTION", "BILGI")
        $colHBorc   = Pick-Column $hCols @("BORC", "BORCU", "BORCTOPLAM", "TUTARBORC", "BORCTUTAR", "DBORC", "YERELBORC", "BORC_TUTAR", "BORC_TL", "BORCLU", "DEBIT")
        $colHAlacak = Pick-Column $hCols @("ALACAK", "ALACAGI", "ALACAKTOPLAM", "TUTARALACAK", "ALACAKTUTAR", "DALACAK", "YERELALACAK", "ALACAK_TUTAR", "ALACAK_TL", "ALACAKLI", "CREDIT")
        $colHTutar  = Pick-Column $hCols @("TUTAR", "MEBLAG", "GENELTOPLAM", "NETTUTAR", "TOPLAM", "AMOUNT")
        $colHBA     = Pick-Column $hCols @("BA", "BORCALACAK", "SIGN", "YON", "B_A", "BORC_ALACAK", "HAREKET_TIPI", "ISLEMTIPI")
        $colHDoviz  = Pick-Column $hCols @("DOVIZCINSI", "DOVIZ", "PARABIRIMI", "CURRENCY")
        $colHKur    = Pick-Column $hCols @("DOVIZKURU", "KUR", "TLKUR", "RATE")

        $orderClause = if ($colHTarih) { "ORDER BY [$colHTarih] DESC" } else { "" }
        $rawHar = Invoke-SqlQuery -connStr $harCs -query "SELECT TOP 25000 * FROM [$cariHarTable] WITH (NOLOCK) $orderClause"
        $hIdx = 1
        foreach ($rh in $rawHar) {
            $borcVal = 0.0
            $alacakVal = 0.0

            if ($colHBorc) { $borcVal = ConvertTo-DoubleSafe $rh[$colHBorc] }
            if ($colHAlacak) { $alacakVal = ConvertTo-DoubleSafe $rh[$colHAlacak] }

            if ($borcVal -eq 0 -and $alacakVal -eq 0 -and $colHTutar) {
                $tVal = ConvertTo-DoubleSafe $rh[$colHTutar]
                $baStr = if ($colHBA -and $rh[$colHBA]) { "$($rh[$colHBA])".Trim().ToUpperInvariant() } else { "B" }
                if ($baStr -like "*A*" -or $baStr -eq "1" -or $baStr -eq "-1" -or $baStr -eq "2") {
                    $alacakVal = [Math]::Abs($tVal)
                } else {
                    $borcVal = [Math]::Abs($tVal)
                }
            }

            # Sıfır tutarlı ve boş kayıtları atla
            if ($borcVal -eq 0 -and $alacakVal -eq 0) { continue }

            $cariKey = if ($colHCari -and $rh[$colHCari]) { "$($rh[$colHCari])".Trim() } else { "" }
            $cariRefVal = if ($colHRef -and $rh[$colHRef]) { "$($rh[$colHRef])".Trim() } else { "" }
            $tarihStr = if ($colHTarih -and $rh[$colHTarih]) { "$($rh[$colHTarih])" } else { (Get-Date).ToString("yyyy-MM-dd") }
            $vadeStr  = if ($colHVade -and $rh[$colHVade]) { "$($rh[$colHVade])" } else { $tarihStr }
            $turRaw   = if ($colHTur -and $rh[$colHTur]) { "$($rh[$colHTur])".Trim() } else { "Cari Hareket" }
            $acikStr  = if ($colHAcik -and $rh[$colHAcik]) { "$($rh[$colHAcik])".Trim() } else { $turRaw }
            $evrakStr = if ($colHEvrak -and $rh[$colHEvrak]) { "$($rh[$colHEvrak])".Trim() } else { "EVR-$hIdx" }

            $hareketler += @{
                id = "ZRV-H-$hIdx"
                cariKod = $cariKey
                cariRef = $cariRefVal
                tarih = $tarihStr
                vadeTarihi = $vadeStr
                evrakNo = $evrakStr
                islemTuru = $turRaw
                aciklama = $acikStr
                borc = [Math]::Round($borcVal, 2)
                alacak = [Math]::Round($alacakVal, 2)
                doviz = if ($colHDoviz -and $rh[$colHDoviz]) { "$($rh[$colHDoviz])".Trim() } else { "TRY" }
                kur = if ($colHKur -and $rh[$colHKur]) { ConvertTo-DoubleSafe $rh[$colHKur] } else { 1.0 }
                kaynak = "Zirve SQL ($cariHarTable)"
            }
            $hIdx++
        }
    }

    return @{
        ok = $true
        database = $cfg.database
        detectedTables = @{
            cariTable = $cariTable
            cariHarTable = "$cariHarTable $(if ($harDbName -ne $cfg.database) { "($harDbName)" } else { '' })"
            faturaTable = $faturaTable
            cekSenetTable = $cekSenetTable
            allTables = $tablesRaw
        }
        cariler = $cariler
        hareketler = $hareketler
    }
}

function Scan-ZirveXmlFolder {
    param([string]$scanPath)
    if ([string]::IsNullOrWhiteSpace($scanPath)) { $scanPath = "C:\zirve" }
    if (-not (Test-Path $scanPath)) {
        return @{ ok = $false; error = "Belirtilen klasor bulunamadi: $scanPath" }
    }
    $xmlFiles = Get-ChildItem -Path $scanPath -Filter "*.xml" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 500
    $xmlContents = @()
    foreach ($f in $xmlFiles) {
        try {
            $raw = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
            if ($raw -match "Invoice" -and ($raw -match "AccountingSupplierParty" -or $raw -match "LegalMonetaryTotal")) {
                $xmlContents += @{
                    fileName = $f.Name
                    fullPath = $f.FullName
                    lastWrite = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
                    xml = $raw
                }
            }
        } catch {}
    }
    return @{
        ok = $true
        scanPath = $scanPath
        totalXmlFound = $xmlContents.Count
        files = $xmlContents
    }
}

$lanIp = "127.0.0.1"
try {
    $ipObj = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1
    if ($ipObj -and $ipObj.IPAddress) { $lanIp = $ipObj.IPAddress }
} catch {}

$listener = New-Object System.Net.HttpListener
$lanEnabled = $false
try {
    $url = "http://localhost:$port/"
    $listener.Prefixes.Add("http://+:$port/")
    $listener.Start()
    $lanEnabled = $true
} catch {
    try {
        $listener = New-Object System.Net.HttpListener
        $url = "http://localhost:$port/"
        $listener.Prefixes.Add($url)
        $listener.Start()
    } catch {
        $port = 8091
        $url = "http://localhost:$port/"
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add($url)
        $listener.Start()
    }
}

$lanUrl = "http://${lanIp}:${port}/"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " ZIRVE CARI HESAP, FATURA, TAHSILAT VE ODEME YONETIM SISTEMI" -ForegroundColor Green
Write-Host " Bu Bilgisayar Adresi       : $url" -ForegroundColor Yellow
Write-Host " Diger Terminaller Icin IP  : $lanUrl $(if ($lanEnabled) {'(Aktif)'} else {'(Yonetici Olarak Calistirilirsa Aktif)'})" -ForegroundColor Cyan
Write-Host " Veritabani Dosyasi         : $dbFile" -ForegroundColor Gray
Write-Host " Kapatmak icin bu pencereyi kapatabilir veya Ctrl+C basabilirsiniz." -ForegroundColor Gray
Write-Host "==========================================================================" -ForegroundColor Cyan

Start-Process $url

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

    if ($request.HttpMethod -eq "OPTIONS") {
        $response.StatusCode = 200
        $response.Close()
        continue
    }

    $localPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }

    try {
        if ($localPath -eq "api/status") {
            $json = (@{ ok = $true; serverTime = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"); machineName = $env:COMPUTERNAME; lanIp = $lanIp; lanUrl = $lanUrl; lanEnabled = $lanEnabled; hasSavedDb = (Test-Path $dbFile) } | ConvertTo-Json -Depth 6)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/data" -and $request.HttpMethod -eq "GET") {
            if (Test-Path $dbFile) {
                $bytes = [System.IO.File]::ReadAllBytes($dbFile)
            } else {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"initialized":false}')
            }
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/data" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()
            [System.IO.File]::WriteAllText($dbFile, $body, [System.Text.Encoding]::UTF8)
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/sql/discover" -and $request.HttpMethod -eq "POST") {
            $result = Discover-ZirveSql
            $json = ($result | ConvertTo-Json -Depth 8)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/sql/databases" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $cfg = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()
            $cs = Get-SqlConnectionString -cfg $cfg -databaseName "master"
            $dbs = Invoke-SqlQuery -connStr $cs -query "SELECT name, create_date FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE' ORDER BY name"
            $json = (@{ ok = $true; databases = $dbs } | ConvertTo-Json -Depth 6)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/sql/autodetect" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $cfg = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()
            $scanResult = AutoScan-AllZirveDatabases -cfg $cfg
            $json = ($scanResult | ConvertTo-Json -Depth 6)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/sql/scan-network" -and $request.HttpMethod -eq "POST") {
            $foundServers = @()
            try {
                $arpOutput = & arp -a
                $ipList = @()
                foreach ($line in ($arpOutput -split "`r?`n")) {
                    if ($line -match '(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})') {
                        $ip = $matches[1]
                        if ($ip -notlike "127.*" -and $ip -notlike "*.255" -and $ip -notlike "224.*" -and $ip -notlike "239.*" -and $ip -notlike "255.*") {
                            $ipList += $ip
                        }
                    }
                }
                $ipList = $ipList | Select-Object -Unique

                foreach ($targetIp in $ipList) {
                    try {
                        $tcp = New-Object System.Net.Sockets.TcpClient
                        $iar = $tcp.BeginConnect($targetIp, 1433, $null, $null)
                        $wh = $iar.AsyncWaitHandle.WaitOne(300, $false)
                        if ($wh -and $tcp.Connected) {
                            $tcp.EndConnect($iar)
                            $foundServers += @{
                                ip = $targetIp
                                port = 1433
                                suggestedServer = "$targetIp\ZIRVESQL"
                            }
                            $tcp.Close()
                        }
                    } catch {}
                }
            } catch {}
            $json = (@{ ok = $true; servers = $foundServers } | ConvertTo-Json -Depth 6)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/sql/sync" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $cfg = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()
            $syncRes = Sync-ZirveDatabase -cfg $cfg
            $json = ($syncRes | ConvertTo-Json -Depth 8)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/sql/tables" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $cfg = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()
            $cs = Get-SqlConnectionString -cfg $cfg -databaseName $cfg.database
            $tablesRaw = @()
            try {
                $tablesRaw = Invoke-SqlQuery -connStr $cs -query @"
SELECT t.name AS TableName, ISNULL(SUM(p.rows), 0) AS RowCnt
FROM sys.tables t
LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
GROUP BY t.name
ORDER BY ISNULL(SUM(p.rows), 0) DESC
"@
            } catch {
                try {
                    $tablesRaw = Invoke-SqlQuery -connStr $cs -query "SELECT TABLE_NAME AS TableName, 0 AS RowCnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
                } catch {}
            }
            $json = (@{ ok = $true; database = $cfg.database; tables = $tablesRaw } | ConvertTo-Json -Depth 6)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/sql/query" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $cfg = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()
            $cs = Get-SqlConnectionString -cfg $cfg -databaseName $cfg.database
            $rows = Invoke-SqlQuery -connStr $cs -query $cfg.query
            $json = (@{ ok = $true; rows = $rows } | ConvertTo-Json -Depth 6)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($localPath -eq "api/xml/scan" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $reqObj = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()
            $scanRes = Scan-ZirveXmlFolder -scanPath $reqObj.path
            $json = ($scanRes | ConvertTo-Json -Depth 6)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }
    } catch {
        $errJson = (@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Depth 4)
        $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errJson)
        $response.StatusCode = 200
        $response.ContentType = "application/json; charset=utf-8"
        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        $response.Close()
        continue
    }

    $filePath = Join-Path $folder $localPath
    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = "application/octet-stream"
        switch ($ext) {
            ".html" { $contentType = "text/html; charset=utf-8" }
            ".css"  { $contentType = "text/css; charset=utf-8" }
            ".js"   { $contentType = "application/javascript; charset=utf-8" }
            ".json" { $contentType = "application/json; charset=utf-8" }
            ".xml"  { $contentType = "application/xml; charset=utf-8" }
            ".png"  { $contentType = "image/png" }
            ".svg"  { $contentType = "image/svg+xml" }
        }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
        $response.AddHeader("Pragma", "no-cache")
        $response.AddHeader("Expires", "0")
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("Dosya bulunamadi: $localPath")
        $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
    }
    $response.Close()
}
