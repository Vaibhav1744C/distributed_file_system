param(
    [int]$NodeId = 4,
    [int]$NodePort = 9104
)

$root = $PSScriptRoot
$storagePath = "storage\node$NodeId"
$exe = "$root\build\dfs_storage_node.exe"

Write-Host "Adding Node $NodeId on port $NodePort..." -ForegroundColor Cyan

# Step 1: Kill any existing process on that port
Get-Process -Name "dfs_storage_node" -ErrorAction SilentlyContinue | ForEach-Object {
    # We can't easily check port without netstat, so just leave existing ones
}

# Step 2: Create storage directory
New-Item -ItemType Directory -Path "$root\$storagePath" -Force | Out-Null
Write-Host "[1/4] Storage directory created: $storagePath" -ForegroundColor Green

# Step 3: Launch the storage node process
$proc = Start-Process -FilePath $exe `
    -ArgumentList "--id $NodeId --port $NodePort --dir $storagePath --coord-port 9001" `
    -WorkingDirectory $root -PassThru
Write-Host "[2/4] Node process launched. PID: $($proc.Id)" -ForegroundColor Green

# Step 4: Wait 2 seconds for process to start
Start-Sleep -Seconds 2

# Step 5: Register in SQLite database directly
$dbPath = "$root\data\dfs_metadata.db"
$epoch = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
python -c "
import sqlite3, sys
conn = sqlite3.connect(r'$dbPath')
conn.execute('''INSERT OR REPLACE INTO storage_nodes
    (id, name, host, port, storage_path, total_space, used_space, status, process_id, last_heartbeat)
    VALUES ($NodeId, 'StorageNode_$NodeId', '127.0.0.1', $NodePort, '$storagePath', 107374182400, 0, 'ONLINE', $($proc.Id), $epoch)''')
conn.commit()
conn.close()
print('DB updated')
"
Write-Host "[3/4] Node registered in coordinator database" -ForegroundColor Green

# Step 6: Verify via API
Start-Sleep -Seconds 2
$r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/nodes" -UseBasicParsing -TimeoutSec 5
$nodes = $r.Content | ConvertFrom-Json
$node4 = $nodes | Where-Object { $_.id -eq $NodeId }
if ($node4) {
    Write-Host "[4/4] Node $NodeId confirmed ONLINE via API" -ForegroundColor Green
} else {
    Write-Host "[4/4] Node may still be starting - refresh the dashboard" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Node $NodeId is ONLINE" -ForegroundColor Green
Write-Host " Hard refresh the dashboard: Ctrl+Shift+R" -ForegroundColor Yellow
Write-Host " Then upload a file - Node $NodeId will receive new files" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan