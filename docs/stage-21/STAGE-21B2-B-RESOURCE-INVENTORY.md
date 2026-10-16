# HAZA AIOS — STAGE 21B.2-B: RESOURCE INVENTORY

**Document ID:** STAGE-21B2-B-RESOURCE-INVENTORY  
**Repository:** `C:\HAZA-APPS\HAZA-AIOS`  
**Railway Project:** `haza-aios` (`e28efe9a-f4f0-4ace-8ccf-5cc04baede34`)  
**Timestamp:** October 15, 2026, 08:24:43 PKT (03:24:43 UTC)  

---

## 1. Environments in Railway Project `haza-aios`

| Environment Name | Environment ID | Classification | State | Created |
| :--- | :--- | :--- | :--- | :--- |
| **`production`** | `e1766450-207b-497f-a563-d4a939a0da16` | Live Production (Protected) | Active | 2026-09-18 |
| **`stage19-rehearsal`** | `c19bac81-2451-43fa-862e-3a527c46f6a5` | Historical Rehearsal (Preserved)| Active | 2026-10-07 |
| **`staging`** | `c04d8e3d-36f5-45cb-8da2-1e9876f2dd06` | Stage 21 Staging Target | **Active (NEW)**| 2026-10-15 |

---

## 2. Services in Environment `staging`

### 2.1 Staging MySQL Service
- **Service Name:** `MySQL-KAw6`
- **Service ID:** `cc023f38-2a49-4ebc-b4a2-9b9e931153d1`
- **Engine Image:** `mysql:8`
- **Container Deployment ID:** `5627efb6-9a82-44f6-b998-0789d110c1f1`
- **Container Status:** `SUCCESS` / `RUNNING`
- **Private Domain:** `mysql-kaw6.railway.internal`
- **Port:** `3306`
- **Public Domain:** None (`domains: []`)
- **Volume Name:** `mysql-volume-Zx05`
- **Volume ID:** `e4134e4e-bdaf-4841-82df-99c48edbc0e2`
- **Mount Path:** `/var/lib/mysql`
- **Volume Size:** `5000 MB` (5 GB)
- **Initialized Database:** `haza_aios_staging`

### 2.2 Staging API Service
- **Service Name:** `haza-aios-api-staging`
- **Service ID:** `4a894896-ee30-48ce-a891-7fe2ca11d47b`
- **Type:** Empty Service
- **Source Link:** None (`repo: null`, `image: null`)
- **Deployment Status:** **NOT DEPLOYED** (`latestDeployment: null`, `activeDeployments: []`)
- **Build Status:** None
- **Domains:** None (`domains: []`)

---

## 3. Production Environment Baseline (Protected & Unchanged)

### 3.1 Production Services
- **API Service:** `api` (`6eb47d5c-e93b-4e8a-8f94-acb41aa2ae74`)
  - Latest Deployment: `ee0fceb8-02ad-4e48-8f22-fc77ac00ef3b`
  - Commit: `241d711a0a9737dd1973a80c5a51eb418d74a1e6`
  - Health: `HTTP 200 OK`
- **MySQL Service:** `MySQL` (`fbab30e4-7c99-42b6-87da-33f98b5ab77d`)
  - Latest Deployment: `70bbbdfd-23a0-4230-a8e5-c848b42377a8`
  - Volume: `mysql-volume` (`123b7d37-5af6-4a4f-b2ea-9b212bedf31b`)
- **Web Service:** `web` (`d81d71f2-e07f-4f3e-bd68-00571e86c559`)
  - Latest Deployment: `756a27a7-b2f4-4f28-b8ec-81e30c2a5c8c`
  - Commit: `241d711a0a9737dd1973a80c5a51eb418d74a1e6`
