# SIS Core Architecture

## Overview
The School Information System (SIS) Core resides completely inside the `education` module to enforce strict boundaries from the HAZA AIOS Core Platform. 

## Domain Entities
The core entities mirror standard K-12 and Higher-Ed structures:
- **School**: The root institutional entity tied directly to a Core `Organization`.
- **AcademicYear**: Temporal bounds for academic terms. Only one year can be marked as `isCurrent` for a specific school.
- **Academic Hierarchy**: `EducationLevel` -> `Grade` -> `Section`.
- **People**: `Student` and `Staff`. These are isolated by `organizationId`.
- **Enrollment**: `StudentEnrollment` bridges a `Student` to an `AcademicYear`, `Grade`, and `Section`. This allows preserving history across years instead of permanently tying a student to a class.

## Data Boundaries (Tenant Isolation)
Every entity fundamentally belongs to an `organizationId` or a `schoolId`. Backend APIs and frontend services (like `SisService`) enforce these boundaries in every query to prevent data leakage between tenants.

## UI Components
Generic components created for the SIS (such as `Table`, `Avatar`, and `StatusBadge`) have been abstracted to `packages/ui` to remain framework-agnostic and reusable for future modules like Healthcare or Corporate HR.

## Future Epics
The following systems are out of scope for the Core and are planned for future Epics:
- Attendance
- Timetable
- Examinations
- Fees
- Communication
- Parent Portal
- Student Portal
- Analytics
- AI Academic Workflows
