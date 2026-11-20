param(
    [int[]]$Ports = @(8000, 3000, 4321)
)

$portList = $Ports -join ', '
Write-Host "Checking ports: $portList..." -ForegroundColor Cyan
$killedCount = 0

foreach ($port in $Ports) {
    $pids = @()
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conns) {
            $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
        }
    } catch {
        $pids = @()
    }

    if (-not $pids -or $pids.Count -eq 0) {
        $lines = netstat -ano | Select-String ":$port\s"
        foreach ($line in $lines) {
            $parts = ($line.ToString().Trim() -split '\s+')
            $candidatePid = $parts[-1]
            if ($candidatePid -match '^\d+$') {
                $pids += [int]$candidatePid
            }
        }
        $pids = $pids | Select-Object -Unique
    }

    foreach ($pidToKill in $pids) {
        if ($pidToKill -and $pidToKill -gt 4) {
            $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
            $procName = if ($proc) { $proc.ProcessName } else { "Unknown" }
            Write-Host "Terminating PID $pidToKill ($procName) on port $port..." -ForegroundColor Yellow
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            $killedCount++
        }
    }
}

if ($killedCount -eq 0) {
    Write-Host "All dev ports ($portList) are free!" -ForegroundColor Green
} else {
    Write-Host "Cleaned up $killedCount lingering process(es). Ports are now free!" -ForegroundColor Green
}
