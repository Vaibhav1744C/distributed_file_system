# Project Transformation Log
## Advanced Distributed File System to Linux OS Concepts Simulator

---

## Overview

This document records every change made to the project: what existed before, what was changed, and why.

---

## 1. Dashboard — Complete Frontend Transformation

### Before

| Property | Old State |
|---|---|
| Theme | Generic dark admin dashboard |
| Layout | 8 horizontal tabs across the top |
| Navigation | Flat tabs: Storage Nodes, File Explorer, Request Scheduling, Memory Buffer, Synchronization, Crash Recovery, Disk Sim, Audit |
| OS Concepts | Not labeled or connected to OS theory |
| Simulations | None — only live DFS data display |
| Gantt Chart | Not present |
| Memory Simulator | Not present |
| CPU Scheduler | Not present |
| Deadlock Playground | Not present |
| Bankers Algorithm | Not present |
| Linux Terminal | Not present |
| System Calls | Not present |
| Guided Walkthrough | Not present |

### After

| Property | New State |
|---|---|
| Theme | Linux dark terminal theme, background #0d1117, JetBrains Mono font |
| Layout | Fixed left sidebar 210px wide plus scrollable main content area |
| Navigation | Sidebar grouped by OS concept category |
| OS Concepts | Every module labeled and connected to OS theory |
| Simulations | 13 fully interactive simulation modules |
| Gantt Chart | Animated HTML5 Canvas Gantt with Play/Pause/Step controls |
| Memory Simulator | 3 sub-modules: Partitioning, Paging, Page Replacement |
| CPU Scheduler | 6 algorithms with step-by-step animation |
| Deadlock Playground | Interactive RAG builder with cycle detection |
| Bankers Algorithm | Editable matrices, step-by-step safety algorithm |
| Linux Terminal | Full command interpreter connected to live DFS state |
| System Calls | Animated ring 3 to ring 0 path visualization |
| Guided Walkthrough | 8-stage interactive DFS upload lifecycle demo |

Files changed:

| File | Before | After |
|---|---|---|
| dashboard/index.html | 8KB, 8 tabs | 50KB, 13 panels plus walkthrough |
| dashboard/styles.css | 2KB | 32KB complete rewrite |
| dashboard/app.js | 15KB | 109KB, 1701 lines |

---

## 2. Sidebar Navigation Labels

### Before

```
SYSTEM
UNIT 2: CPU SCHEDULING
UNIT 3: SYNCHRONIZATION
UNIT 4: MEMORY
UNIT 5: FILE AND IO
INTERNALS
```

### After

```
SYSTEM
PROCESS MANAGEMENT
SYNCHRONIZATION
MEMORY MANAGEMENT
FILE SYSTEM AND IO
SYSTEM INTERNALS
```

Reason: Unit numbers are syllabus references, not meaningful navigation labels. Removed to make the dashboard feel like one integrated project, not a collection of assignment units.

---

## 3. New Simulation Modules Added

### 3.1 CPU Scheduler

**Before:** Only showed the DFS RequestScheduler queue depth and metrics from the backend.

**After:** Full standalone CPU scheduling simulator with:
- 6 algorithms: FCFS, SJF Non-Preemptive, SRTF, Round Robin, Priority NP, Priority Preemptive
- Add/remove processes with arrival time, burst time, priority
- Load sample preset with 5 predefined processes
- Animated Gantt chart on HTML5 Canvas
- Controls: Play, Pause, Step Forward, Step Back, Reset, Speed slider
- Ready/Running/Waiting/Completed queue state visualization
- Per-step text explanation of algorithm decisions
- Performance metrics table: waiting time, turnaround time, response time
- Compare All button: runs all 6 algorithms on same input, shows best-fit recommendation

### 3.2 Memory Simulator

**Before:** Not present.

**After:** Three sub-tabs:

Partitioning sub-tab:
- Variable and Fixed partitioning modes
- First Fit, Best Fit, Worst Fit algorithms
- Animated proportional memory block visualizer
- Compact button, fragmentation tracking

Paging sub-tab:
- Configurable frame count and page size
- Load multiple processes and see frame allocation
- Page table display
- Virtual address translator: enter VA, shows page number, offset, frame, physical address step by step

Page Replacement sub-tab:
- FIFO, LRU, Optimal algorithms
- Step-by-step table with page fault highlighting in red, hits in green
- Belady anomaly demo preset
- Compare All showing fault counts for all 3 algorithms

### 3.3 Deadlock Playground

**Before:** Not present.

**After:**
- Add process nodes P1, P2 and resource nodes R1, R2 with configurable instances
- Add Allocation edges (resource to process) and Request edges (process to resource)
- SVG Resource Allocation Graph drawn programmatically from state
- Detect Deadlock button runs DFS cycle detection on the Wait-For Graph
- Deadlock cycles highlighted in red on the RAG
- Preset scenarios: Classic Deadlock and Safe State
- Recovery by selecting and terminating a process, RAG updates live

### 3.4 Bankers Algorithm

**Before:** Not present.

**After:**
- Configurable number of processes (2 to 8) and resource types (1 to 5)
- Editable Allocation matrix and Maximum matrix with inline number inputs
- Auto-computed Need matrix (Max minus Allocation), read-only
- Editable Available resources vector
- Load Classic Example button fills the textbook 5-process 3-resource example
- Run Safety Check animates through safety algorithm steps
- Step Forward advances one step at a time
- Safety result shows SAFE STATE with safe sequence, or UNSAFE STATE
- Resource Request Simulation: enter request vector, check if grantable and safe

### 3.5 Process Manager

**Before:** Only showed Win32 process PIDs from the nodes API.

**After:**
- Linux-style process table with columns: PID, PPID, Name, State, Priority, Burst, Arrival
- States use Linux terminology: READY, RUNNING, WAITING, TERMINATED
- Create Process form with name, arrival time, burst time, priority, PPID
- Real DFS processes shown at top of table from backend
- Simulated processes added below
- Click any row to open PCB inspector showing: PC, SP, registers, memory limits, open files
- Process Tree SVG diagram showing parent-child hierarchy
- Terminate button per simulated process changes state to TERMINATED

### 3.6 System Calls

**Before:** Not present.

**After:**
- 8 Linux syscalls listed: fork, exec, exit, open, read, write, close, mmap
- Click any syscall to animate the execution path:
  - User Application Ring 3
  - syscall instruction (int 0x80 or syscall opcode)
  - System Call Interface dispatch table
  - Kernel mode switch from ring 3 to ring 0
  - Kernel Subsystem
  - Return value via register rax
- Shows syscall number, arguments, return type, kernel subsystem for each
- Disclaimer: clearly labeled as educational simulation, not real Linux kernel execution

### 3.7 Linux Terminal

**Before:** Not present.

**After:** Full interactive terminal emulator with commands connected to live DFS state.

| Command | What It Does |
|---|---|
| ps aux | Shows real coordinator and node PIDs from backend API |
| top | Live process list with CPU and memory |
| free -h | Memory stats connected to real buffer data from backend |
| df -h | Each storage node shown as a filesystem mount with used/total |
| lsblk | Storage nodes shown as block devices |
| ls -l | DFS files with rwxrwxrwx Linux-style permissions |
| cat /proc/meminfo | Simulated /proc/meminfo output |
| cat /proc/cpuinfo | Simulated CPU info |
| uname -a | Linux kernel version string |
| dfs status | Live coordinator status from backend |
| dfs nodes | Node table from /api/nodes |
| dfs files | File list from /api/files |
| dfs stats | Buffer, cache, and scheduler stats |
| dfs locks | Active locks and deadlock status |
| dfs wal | Recent WAL journal entries |
| history | Shows command history |

Additional features: arrow-key history navigation, Tab completion for command names, scrollback.

---

## 4. Guided DFS Walkthrough

**Before:** Not present.

**After:** 8-stage interactive walkthrough following a 10 MB report.pdf upload through every OS concept layer.

| Stage | OS Concept | Live Backend Data |
|---|---|---|
| 1. Client Initiates Upload | Process Management, System Calls | Coordinator PID, active threads |
| 2. Memory and Buffer Allocation | Memory Management, Bounded Buffer | Buffer occupancy, produced/consumed |
| 3. Coordinator Processes Request | CPU Scheduling, RequestScheduler | Queue depth, algorithm, throughput |
| 4. Synchronization and Locking | Reader-Writer Locks, WAL | Active locks, deadlock status |
| 5. File Storage and Disk IO | File Systems, Disk IO | Node status, used/total space |
| 6. Replication and Fault Tolerance | Distributed Storage | Node heartbeat timestamps |
| 7. Metadata and WAL Commit | Write-Ahead Logging | Recent WAL entries, LSNs |
| 8. Upload Complete | All OS concepts combined | File count, last upload timestamp |

Each stage shows:
- What is happening in plain language
- Which OS concept is involved
- How our DFS specifically uses it
- Exact source file, class, and function reference
- Live backend data fetched in real time
- Button to open the related simulator module

Controls: Previous, Play/Pause auto-advancing every 3.5 seconds, Next, Reset. Progress dots at bottom.

---

## 5. DFS Connection Sections Added to Every Module

**Before:** No connection between OS concept simulators and the actual DFS backend.

**After:** Every module has a collapsible section called "How This Is Used in Our DFS" showing a single focused paragraph with:
- Direct relationship to file storage operations
- Exact source file, class, and method references
- A concrete file upload or download example
- Status badge: REAL DFS (green), MIXED (blue), or EDUCATIONAL (amber)

| Module | Status | Key Implementation Reference |
|---|---|---|
| Process Manager | REAL DFS | ProcessManager::launchStorageNode uses CreateProcessW |
| CPU Scheduler | MIXED | RequestScheduler in request_scheduler.cpp is app-level, not OS burst scheduling |
| Lock Manager | REAL DFS | LockManager::acquireLock with 3-5 second timeout, Havender ordering |
| Deadlock Playground | REAL DFS | acquireMultipleLocks sorts alphabetically to prevent circular wait |
| Bankers Algorithm | EDUCATIONAL | DFS uses lock ordering and WFG detection instead of Bankers |
| Memory Simulator | REAL DFS | BoundedBuffer 16 slots, LruFileCache 64 items |
| File Explorer | REAL DFS | 64KB chunks with SHA-256, file_id_chk_index naming format |
| Disk Scheduler | MIXED | Physical IO by Windows NTFS; DiskSchedulerSimulator for education |
| IO Buffer and Cache | REAL DFS | cv_not_full_ backpressure wait, LruFileCache::invalidate on write |
| WAL and Recovery | REAL DFS | beginTransaction PENDING to commitTransaction COMMITTED |
| System Calls | EDUCATIONAL | Win32 equivalents: CreateProcessW, WSASend, CreateFile |
| Audit Log | REAL DFS | SecurityManager::recordAudit writes to SQLite via MetadataManager |

---

## 6. HTTP Server Fix

**File:** src/web/http_server.cpp

### Before

The handleSocket function used a single recv() call with a 16384 byte buffer:

```cpp
char buf[16384];
int recvd = recv(sock, buf, sizeof(buf) - 1, 0);  // ONE recv call, 16KB max
if (recvd <= 0) return;
buf[recvd] = '\0';
HttpRequest req = parseRequest(std::string(buf, recvd), ip);
```

**Problems this caused:**
- If the browser sent the HTTP POST body in a second TCP segment (common for requests larger than the network MTU of around 1400 bytes), the body arrived empty after the first recv call
- Upload failures with WinError 10054 connection forcibly closed
- Alternating success/fail pattern on consecutive requests
- Large file content silently cut off mid-JSON causing parse errors in the coordinator

### After

The function now reads headers first in a loop, then reads body in a loop until Content-Length is fully satisfied:

```cpp
// Step 1: Read until end of HTTP headers (blank line)
while (header_end == std::string::npos) {
    int n = recv(sock, tmp, sizeof(tmp), 0);
    raw.append(tmp, n);
    header_end = raw.find(blank_line);
}

// Step 2: Parse headers, extract Content-Length
HttpRequest req = parseRequest(raw, ip);
size_t content_length = stoull(req.headers["Content-Length"]);

// Step 3: Read remaining body bytes in a loop
while (body_so_far.size() < content_length) {
    int n = recv(sock, tmp, to_read, 0);
    body_so_far.append(tmp, n);
}
req.body = body_so_far;
```

**Result:** Upload works reliably for any content size up to the 50MB safety limit.

---

## 7. Dynamic Node Creation

**Files:** src/coordinator/coordinator.cpp, src/coordinator/coordinator.h

### Before

The coordinator only supported 3 hardcoded nodes registered at startup. No API existed to add nodes at runtime. No way to expand the cluster without a full restart.

```cpp
std::vector<NodeInfo> default_nodes = {
    {1, "StorageNode_1", "127.0.0.1", 9101, "storage/node1", ...},
    {2, "StorageNode_2", "127.0.0.1", 9102, "storage/node2", ...},
    {3, "StorageNode_3", "127.0.0.1", 9103, "storage/node3", ...}
};
```

### After

Three new methods added to the Coordinator class:

**findAvailablePort(start_port)**
- Scans from start_port upward
- Skips ports already used by existing nodes
- Verifies the port is actually bindable with a temporary bind attempt
- Returns -1 if no port found in the next 100 candidates

**addDynamicNode(requested_id, requested_port, storage_dir)**
1. Generates node ID as max existing ID plus 1 if not specified
2. Finds an available port if not specified
3. Creates storage directory via std::filesystem::create_directories
4. Registers NodeInfo in SQLite as OFFLINE
5. Launches dfs_storage_node.exe via ProcessManager::launchStorageNode using CreateProcessW
6. Waits up to 8 seconds for the first heartbeat from the new node
7. Marks node ONLINE in SQLite when heartbeat is received
8. Returns AddNodeResult struct with: success, node_id, port, storage_path, process_id, message

**removeDynamicNode(node_id, force)**
- Checks if node holds the only replica of any chunk
- Refuses removal if data would be lost and force is false
- If safe or force is true: terminates the process and marks node OFFLINE

**Three new REST API endpoints:**

| Endpoint | Method | Purpose |
|---|---|---|
| /api/nodes/create | POST | Add a new storage node dynamically at runtime |
| /api/nodes/remove | POST | Remove a node with safety check for data loss |
| /api/nodes/preview | GET | Get the suggested ID, port, and directory for the next node |

**How to add Node 4 manually from PowerShell:**
```powershell
.\build\dfs_storage_node.exe --id 4 --port 9104 --dir storage/node4 --coord-port 9001
```

Node 4 self-registers via heartbeat within 2 seconds. No coordinator restart needed. The coordinator's selectStorageNodesForChunks function sorts nodes by most free space, so Node 4 (completely empty) is selected first for new uploads automatically.

---

## 8. Upload Bug — Root Cause Analysis

### Symptoms
- WinError 10054 connection forcibly closed on file uploads
- Alternating success/fail pattern on consecutive upload requests
- Uploads smaller than 200 bytes worked reliably
- Medium-size uploads failed approximately 50 percent of the time

### Root Cause 1: HTTP body truncation (fixed)
Single recv call in handleSocket read only the first TCP segment. If the browser sent the POST body in a second TCP segment, the coordinator received an empty body. The upload handler then tried to parse an empty JSON string, found no path, and returned an error. Fixed by reading headers and body in separate loops until Content-Length is satisfied.

### Root Cause 2: SQLite WAL file growth (requires periodic maintenance)
3 storage nodes send heartbeats every 2 seconds. Each heartbeat calls updateNodeHeartbeat which writes to SQLite. This creates approximately 1.5 write transactions per second. Without periodic SQLite checkpointing, the WAL file grows without bound. After long cluster uptime the WAL file reached 4MB, causing individual DB write operations in uploadFile to take 2 or more seconds. The 10-second socket timeout in TcpServer then triggered before the upload response was sent, causing the connection to close.

Fix: Run the following after stopping the cluster:
```python
import sqlite3
conn = sqlite3.connect('data/dfs_metadata.db')
conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
conn.close()
```

The coordinator should ideally run periodic checkpoint calls in the healthMonitorLoop.

### Root Cause 3: chunk_buffer_ timing sensitivity
The coordinator workerSchedulingLoop background thread and the upload handler both interact with the shared chunk_buffer_. BoundedBuffer is fully thread-safe so no data corruption occurred, but the shared resource contributed to timing sensitivity under load.

---

## 9. Files Modified Summary

| File | Type | Change Summary |
|---|---|---|
| dashboard/index.html | Frontend | Complete rewrite — 8 tabs to 13 panels plus walkthrough |
| dashboard/styles.css | Frontend | Complete rewrite — Linux dark terminal theme |
| dashboard/app.js | Frontend | Complete rewrite — all simulators, terminal, walkthrough, 1701 lines |
| src/web/http_server.cpp | Backend | Fixed body reading — single recv to loop until Content-Length |
| src/coordinator/coordinator.cpp | Backend | Added addDynamicNode, removeDynamicNode, findAvailablePort, 3 new API routes |
| src/coordinator/coordinator.h | Backend | Added AddNodeResult struct and 3 new method declarations |

---

## 10. Existing Features Kept Unchanged

Every feature that existed before the transformation was preserved:

- All 3 original storage node processes and startup scripts (start-cluster.ps1, stop-cluster.ps1)
- TCP Winsock2 communication between coordinator and storage nodes
- File upload, download, rename, and delete operations
- SHA-256 chunk hashing and integrity verification on every download
- Chunk replication to multiple storage nodes based on replication factor
- Heartbeat sending every 2 seconds and health monitoring
- Auto re-replication when a node goes offline and a chunk becomes under-replicated
- Transparent failover reads from surviving replicas
- LockManager reader-writer locks with Havender ordering
- WalManager write-ahead logging with PENDING/COMMITTED/ROLLED_BACK states
- RequestScheduler with FCFS, Priority with aging, and Round Robin
- LruFileCache with 64-item capacity using doubly-linked list plus hashmap
- BoundedBuffer with 16-slot capacity and condition-variable backpressure
- MetadataManager SQLite database with files, chunks, replicas, versions, audit log, WAL
- DiskSchedulerSimulator with FCFS, SSTF, and SCAN algorithms
- SecurityManager with audit logging and path traversal attack prevention
- All existing REST API endpoints: /api/status, /api/nodes, /api/files, /api/scheduler, /api/buffer, /api/cache, /api/locks, /api/recovery, /api/audit, /api/disk_sim

---

## 11. How to Demonstrate Adding a New Node

Open a new PowerShell window in the project folder and run:

```powershell
.\build\dfs_storage_node.exe --id 4 --port 9104 --dir storage/node4 --coord-port 9001
```

Then in the Linux Terminal tab in the dashboard type:

```bash
dfs nodes
```

Node 4 will appear as ONLINE. Upload a new file from the File Explorer tab. The coordinator's placement algorithm selects nodes sorted by most free space, so Node 4 (completely empty) will be selected first for the new upload.

To verify Node 4 actually stored the file:

```bash
dfs files
```

The replicas column will show Node 4 among the replica nodes for the new file.

---

*November 2026*

---

## 2. Sidebar Labels

Before: UNIT 2 CPU SCHEDULING, UNIT 3 SYNCHRONIZATION, UNIT 4 MEMORY, UNIT 5 FILE AND IO

After: PROCESS MANAGEMENT, SYNCHRONIZATION, MEMORY MANAGEMENT, FILE SYSTEM AND IO, SYSTEM INTERNALS

---

## 3. New Modules Added

| Module | Before | After |
|---|---|---|
| CPU Scheduler | Only DFS queue stats | 6 algorithms Gantt Compare All |
| Memory Simulator | Not present | Partitioning Paging Page Replacement |
| Deadlock Playground | Not present | RAG builder cycle detection |
| Bankers Algorithm | Not present | Matrices step-by-step safety |
| Process Manager | Only Win32 PIDs | Linux table PCB inspector tree |
| System Calls | Not present | 8 syscalls ring3 to ring0 animation |
| Linux Terminal | Not present | Full shell ps top free df ls dfs cmds |
| Guided Walkthrough | Not present | 8-stage upload demo live data |

---

## 4. Guided DFS Walkthrough

8 stages following a 10MB report.pdf upload:

1. Client Initiates Upload - Process Management
2. Memory and Buffer Allocation - BoundedBuffer LruFileCache
3. Coordinator Processes Request - RequestScheduler
4. Synchronization and Locking - LockManager WAL
5. File Storage and Disk IO - StorageNode chunks
6. Replication and Fault Tolerance - heartbeat re-replication
7. Metadata and WAL Commit - WalManager SQLite
8. Upload Complete - full summary

Each stage shows live backend data and links to the related simulator module.

---

## 5. DFS Connection Sections

Every module has a collapsible How This Is Used in Our DFS section.
One paragraph. One status badge. Exact source file references.

| Module | Status |
|---|---|
| Process Manager | REAL DFS |
| CPU Scheduler | MIXED |
| Lock Manager | REAL DFS |
| Deadlock Playground | REAL DFS |
| Bankers Algorithm | EDUCATIONAL |
| Memory Simulator | REAL DFS |
| File Explorer | REAL DFS |
| Disk Scheduler | MIXED |
| IO Buffer and Cache | REAL DFS |
| WAL and Recovery | REAL DFS |
| System Calls | EDUCATIONAL |
| Audit Log | REAL DFS |

---

## 6. HTTP Server Bug Fix

File: src/web/http_server.cpp

Before: Single recv() call, 16384 byte buffer. Browser POST body in second TCP segment arrived empty.
Caused: upload failures, alternating success/fail, WinError 10054.

After: Loop reads headers until blank line. Loop reads body until Content-Length satisfied.
Result: uploads work reliably up to 50MB.

---

## 7. Dynamic Node Addition

Files: src/coordinator/coordinator.cpp and coordinator.h

Before: Only 3 hardcoded nodes. No runtime API.

After: Three new methods added:
- findAvailablePort() - scans for a free bindable port
- addDynamicNode() - creates dir, launches via CreateProcessW, waits for heartbeat, marks ONLINE
- removeDynamicNode() - checks for data loss before removing

New API endpoints: /api/nodes/create, /api/nodes/remove, /api/nodes/preview

To add Node 4 open a new PowerShell window and run:
.\\build\\dfs_storage_node.exe --id 4 --p 9104 --dir storage/node4 --coord-p 9001

Node 4 self-registers via heartbeat in 2 seconds. No restart needed.

---

## 8. Upload Bug Root Causes

Root Cause 1 fixed: HTTP body truncation.
Single recv read only first TCP segment. Fixed by looping until Content-Length satisfied.

Root Cause 2 maintenance needed: SQLite WAL growth.
3 nodes heartbeat every 2 seconds. WAL grows to 4MB without checkpointing.
DB writes take 2+ seconds causing timeouts mid-upload.
Fix: run PRAGMA wal_checkpoint after stopping the cluster.

---

## 9. Files Modified

| File | Type | Change |
|---|---|---|
| dashboard/index.html | Frontend | Complete rewrite |
| dashboard/styles.css | Frontend | Complete rewrite |
| dashboard/app.js | Frontend | Complete rewrite 1701 lines |
| src/web/http_server.cpp | Backend | Fixed body reading loop |
| src/coordinator/coordinator.cpp | Backend | Dynamic node methods and 3 API routes |
| src/coordinator/coordinator.h | Backend | AddNodeResult struct and declarations |

---

## 10. Existing Features Preserved

Nothing removed from original project:
- All 3 storage nodes and startup scripts
- TCP Winsock2 communication
- File upload download rename delete
- SHA-256 integrity verification
- Chunk replication and failover
- Heartbeat and health monitoring
- LockManager WalManager RequestScheduler
- LruFileCache BoundedBuffer
- MetadataManager SQLite
- DiskSchedulerSimulator
- SecurityManager audit logging
- All original REST API endpoints

---

*November 2026*
