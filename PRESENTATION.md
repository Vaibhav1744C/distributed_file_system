# DFS Project Presentation Guide
## What to Run and What to Say — Step by Step

---

## BEFORE MAM ARRIVES — Run These First

**1. Start the cluster (run in PowerShell):**
```powershell
.\start-cluster.ps1
```

**2. Open browser to:**
```
http://127.0.0.1:8080/
```

**3. Keep a second PowerShell window ready (for Node 4 demo)**

---

## STEP 1 — Open with DFS Overview

**What is on screen:** DFS Overview page — hero banner, 6 metric cards, cluster topology diagram, recent activity log

**What to say:**
> "Ma am, our project is an Advanced Distributed File System built in C++ 20 on Windows.
> It runs as multiple independent processes communicating over Winsock2 TCP.
> You can see the coordinator process and three storage nodes running live right now,
> with their actual PIDs, ports, and heartbeat status shown in the architecture diagram."

**Point to:**
- The metric cards: Nodes Online, Files Stored, Storage Used, Total Chunks
- The SVG topology: Client arrow to Coordinator arrow to Node 1, 2, 3
- The green pulse dots on each node showing live heartbeats
- The Recent DFS Activity log showing real operations

---

## STEP 2 — Cluster Topology (Fault Tolerance)

Click **Cluster Topology** in the sidebar.

**What to say:**
> "Ma am, the coordinator manages these three independent storage nodes.
> Each node is an actual Windows process launched using CreateProcess,
> which is the Windows equivalent of fork and exec on Linux.
> Every node sends a TCP heartbeat to the coordinator every 2 seconds."

**Demo — Simulate a crash:**
- Click **Simulate Crash** on Node 2
- Wait 5 seconds

**Say:**
> "Watch — I killed Node 2. The coordinator detects the missing heartbeat
> in under 5 seconds and marks it OFFLINE. If a client downloads a file
> that was stored on Node 2, the coordinator automatically reads from
> Node 1 or Node 3 instead — this is transparent failover."

- Click **Revive Node** to bring Node 2 back

**OS Concept being demonstrated:** Process management, fault tolerance, heartbeat monitoring

---

## STEP 3 — Upload a Real File

Click **File Explorer** in the sidebar.

Click **Upload File**.

**In the form:**
- Click the file picker and select any PDF or document from your computer
- Path auto-fills to /uploads/yourfilename
- Keep Replication at 2 Replicas
- Click **Upload**

**What to say while uploading:**
> "When I upload this file, the coordinator receives it over HTTP,
> splits it into 64 KB chunks, and distributes each chunk to 2 different
> storage nodes for redundancy. Each chunk gets a SHA-256 hash for
> integrity verification. The file is now stored across the cluster."

**After upload — point to the file in the table:**
> "Notice the Replicas column — it shows which nodes store this file.
> The SQLite metadata database records the full chunk-to-node mapping."

**OS Concept:** File systems, chunking, replication, metadata management

---

## STEP 4 — Download and Verify Integrity

Still on File Explorer.

Click the **download button** (arrow icon) on the file you just uploaded.

**What to say:**
> "Now I am downloading the same file back. The coordinator fetches
> all chunks from the storage nodes, verifies the SHA-256 checksum
> of each chunk, and assembles the original file.
> If even one byte was corrupted, the hash check would catch it.
> This is data integrity in a distributed system."

**OS Concept:** Data integrity, SHA-256, fault tolerant retrieval

---

## STEP 5 — DFS Operations Log

Click **DFS Operations** in the sidebar.

**What to say:**
> "Every operation is recorded here — uploads, downloads, deletes, node events.
> This is our audit trail. You can see the file I just uploaded and downloaded
> both logged with their timestamps, storage node assignment, and status.
> The storage distribution bars show how space is used across nodes."

**OS Concept:** Audit logging, SecurityManager, SQLite persistence

---

## STEP 6 — Add Node 4 Dynamically

**In the second PowerShell window, run:**
```powershell
.\add-node.ps1
```

**While it runs, say:**
> "I am adding a 4th storage node at runtime — no restart of the coordinator,
> no code changes. The script creates the storage directory, launches a new
> dfs_storage_node.exe process using CreateProcess, and registers it
> in the coordinator database. Within 2 seconds the node starts sending
> heartbeats and the coordinator marks it ONLINE."

**Go back to Cluster Topology in browser — press Ctrl+Shift+R if needed.**

**Say:**
> "Node 4 is now ONLINE. Upload another file and you will see the coordinator
> select Node 4 for storage because it has the most free space.
> This is the least-utilized-first placement algorithm."

**OS Concept:** Dynamic process creation, distributed systems, auto-scaling

---

## STEP 7 — Linux Terminal (Show OS Commands)

Click **Linux Terminal** in the sidebar under OS Concepts.

Type these commands one by one:

```bash
uname -a
ps aux
df -h
dfs status
dfs nodes
dfs files
```

**What to say:**
> "This terminal simulates the Linux interface.
> Commands like ps aux show the real coordinator and storage node PIDs.
> df -h shows each storage node as a mounted filesystem with used and total space.
> The dfs commands are connected directly to the backend API and return live data."

**OS Concept:** Linux process management, filesystem interface, system monitoring

---

## STEP 8 — OS Concepts (Show 2-3, do not go through all)

### Lock Manager
Click **Lock Manager** under OS Concepts.

**Say:**
> "Every file upload acquires an EXCLUSIVE_WRITE lock on the file path.
> Every download acquires a SHARED_READ lock — multiple readers can proceed
> simultaneously. The LockManager uses std::mutex and condition variables.
> Havender ordering prevents deadlock by always acquiring multiple locks
> in alphabetical order, eliminating circular wait."

### WAL and Recovery
Click **WAL and Recovery** under OS Concepts.

**Say:**
> "Every file operation is wrapped in a Write-Ahead Log transaction.
> Before data moves, a PENDING entry is written to SQLite with an LSN.
> After all chunks are stored, the entry becomes COMMITTED.
> If the coordinator crashes mid-upload, it rolls back the PENDING entry
> on restart — the same principle used by ext4 and NTFS journaling."

**Point to the WAL table with COMMITTED entries.**

### CPU Scheduler (if asked)
Click **CPU Scheduler** under OS Concepts.

Click **Load Sample**, then click **Run**.

**Say:**
> "This simulates OS CPU scheduling algorithms.
> The Windows OS schedules our coordinator threads using its own scheduler.
> Inside the DFS, we also have an application-level RequestScheduler that
> orders file I/O requests using FCFS, Priority, or Round Robin.
> This Gantt chart visualizes how those algorithms compare on the same process set."

---

## STEP 9 — Guided Walkthrough (Best for viva)

Click **Start Demo** in the sidebar.

**Say:**
> "This walkthrough follows a 10 MB PDF upload through every OS concept layer.
> Each stage shows what is happening, which OS concept is involved,
> the exact C++ source file and function responsible, and live backend data."

Click through stages 1 to 8, or click **Play** for auto-advance.

**Key stages to explain:**
- Stage 1: Client and Process Management — CreateProcess, PIDs
- Stage 2: Memory and BoundedBuffer — 64KB chunks, backpressure
- Stage 4: Synchronization — EXCLUSIVE_WRITE lock, WAL begin
- Stage 7: WAL commit — PENDING to COMMITTED

---

## QUICK VIVA ANSWERS — If Mam Asks

**Q: What is your main project?**
A: Advanced Distributed File System in C++20, Windows-native, with SQLite metadata,
   SHA-256 integrity, Winsock2 TCP, reader-writer locks, WAL, and LRU cache.

**Q: How does file storage work?**
A: Files are split into 64KB chunks. Each chunk gets a SHA-256 hash.
   Chunks are distributed to storage nodes using least-utilized-first.
   MetadataManager stores the full chunk-to-node mapping in SQLite.

**Q: How do you prevent data loss?**
A: Replication factor 2 — each chunk stored on 2 nodes.
   Heartbeat monitoring — coordinator marks offline nodes and reads from replicas.
   WAL — incomplete uploads are rolled back on crash.

**Q: What OS concepts are implemented?**
A: Process management (CreateProcess for storage nodes), reader-writer locks
   (LockManager with Havender ordering), write-ahead logging (WalManager),
   bounded buffer producer-consumer (BoundedBuffer with condition variables),
   LRU cache (LruFileCache doubly-linked list), disk scheduling simulation,
   and request scheduling (FCFS, Priority, Round Robin).

**Q: Is this a real DFS or just a simulation?**
A: It is a real working DFS. Files are physically stored on disk in storage/node1,
   storage/node2, storage/node3. The coordinator and nodes are real Windows processes.
   The OS concept simulators (CPU Scheduler, Memory, Deadlock) are educational additions
   that demonstrate the theory underlying the DFS implementation.

**Q: How did you add Node 4 dynamically?**
A: Run add-node.ps1. It calls CreateProcessW to launch a new dfs_storage_node.exe
   with --id 4 --port 9104. The node sends heartbeats to coordinator RPC port 9001.
   We insert the node record directly into SQLite. The coordinator health monitor
   picks up the heartbeat and marks the node ONLINE. No restart needed.

**Q: What is Havender ordering?**
A: When a transaction needs multiple file locks, they are always acquired in
   alphabetical order. This eliminates circular wait — one of the four
   necessary conditions for deadlock — without requiring rollback.

---

## DEMO ORDER SUMMARY (5 minutes)

| # | Action | What to show |
|---|---|---|
| 1 | DFS Overview | Cluster running, 3 nodes live, metrics |
| 2 | Cluster Topology | Kill Node 2, show OFFLINE, Revive |
| 3 | File Explorer | Upload a real file, show it in table |
| 4 | File Explorer | Download the file back |
| 5 | DFS Operations | Show upload and download in audit log |
| 6 | add-node.ps1 | Add Node 4, show it in topology |
| 7 | Linux Terminal | ps aux, dfs nodes, dfs files |
| 8 | Lock Manager | Explain RW locks and deadlock prevention |
| 9 | WAL Recovery | Show committed entries in journal |
| 10 | Guided Walkthrough | Play through 8 stages |

---

## IF SOMETHING BREAKS

**Upload fails or is slow:**
```powershell
.\stop-cluster.ps1
.\start-cluster.ps1
```

**Node 4 not showing:**
```powershell
.\add-node.ps1
```
Then Ctrl+Shift+R in browser.

**Dashboard blank or corrupted:**
Press Ctrl+Shift+R (hard refresh).

**Port conflict:**
```powershell
Get-Process dfs_* | Stop-Process -Force
.\start-cluster.ps1
```

---

*Project: Advanced Distributed File System | C++20 | Windows-Native | November 2026*
