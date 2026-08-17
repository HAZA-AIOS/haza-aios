export type StudentStatus = "applicant" | "active" | "inactive" | "withdrawn" | "graduated" | "transferred" | "archived";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface StudentGuardian {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  relationship: "father" | "mother" | "guardian" | "other";
  email: string;
  phone: string;
  isEmergencyContact: boolean;
  address?: string;
  occupation?: string;
  isPrimaryContact: boolean;
  portalAccessEnabled?: boolean;
  authorizedForPortal?: boolean;
}

export interface Student {
  id: string;
  organizationId: string;
  userId?: string;
  admissionNumber: string; // The school's unique ID for the student, e.g. "TMS-2026-00125"
  studentNumber?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: string;
  gender: Gender;
  nationality?: string;
  email?: string;
  phone?: string;
  address?: string;
  photoUrl?: string;
  
  admissionDate: string;
  status: StudentStatus;
  
  guardians: StudentGuardian[];
  portalAccessEnabled?: boolean;
  
  metadata?: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;
}

// --- ACADEMIC STRUCTURE ---

export type AcademicYearStatus = "planned" | "active" | "completed" | "archived";
export type TermStatus = "planned" | "active" | "completed";
export type AcademicEntityStatus = "active" | "inactive";

export interface AcademicYear {
  id: string;
  organizationId: string;
  name: string; // e.g. "2025-2026"
  startDate: string; // ISO format YYYY-MM-DD
  endDate: string; // ISO format YYYY-MM-DD
  status: AcademicYearStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Term {
  id: string;
  organizationId: string;
  academicYearId: string;
  name: string; // e.g. "Term 1"
  startDate: string;
  endDate: string;
  status: TermStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Grade {
  id: string;
  organizationId: string;
  name: string; // e.g. "Grade 1"
  level: number;
  order: number;
  status: AcademicEntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  organizationId: string;
  gradeId: string;
  name: string; // e.g. "Section A"
  capacity?: number;
  status: AcademicEntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSubject {
  gradeId: string;
  subjectId: string;
}

export type EnrollmentStatus = "active" | "completed" | "dropped" | "transferred";

export interface Enrollment {
  id: string;
  organizationId: string;
  studentId: string;
  academicYear: string; // e.g. "2025-2026"
  gradeId: string; // e.g. "grade-5"
  sectionId: string; // e.g. "section-A"
  enrollmentDate: string;
  status: EnrollmentStatus;
  
  createdAt: string;
  updatedAt: string;
}

export type StaffType = "teacher" | "administrator" | "coordinator" | "accountant" | "counselor" | "librarian" | "it_staff" | "support_staff" | "other";
export type StaffStatus = "active" | "inactive" | "on_leave" | "suspended" | "resigned" | "terminated" | "archived";
export type EmploymentStatus = "full_time" | "part_time" | "contract" | "temporary" | "volunteer";

export interface Department {
  id: string;
  organizationId: string;
  name: string; // e.g. "Mathematics", "Science", "Administration"
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  organizationId: string;
  employeeNumber: string; // e.g. TMS-EMP-001
  userId?: string; // Link to application user if applicable
  
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  
  phone?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  
  hireDate: string;
  staffType: StaffType;
  employmentStatus: EmploymentStatus;
  status: StaffStatus;
  departmentId?: string;
  
  qualifications?: string; // For teachers, etc.
  
  metadata?: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  status: AcademicEntityStatus;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingAssignment {
  id: string;
  organizationId: string;
  staffId: string; // Must be a staff member where staffType === 'teacher'
  academicYear: string;
  gradeId: string; // e.g. "grade-5"
  sectionId?: string; // optional, e.g. "section-A". If empty, maybe assigned to whole grade.
  subjectId: string; // Link to Subject
  
  isActive: boolean;
  
  createdAt: string;
  updatedAt: string;
}

// --- ATTENDANCE MANAGEMENT ---

export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AttendanceSessionType = "daily" | "period" | "subject";
export type AttendanceSessionStatus = "draft" | "completed";

export interface AttendanceSession {
  id: string;
  organizationId: string;
  academicYearId: string;
  date: string; // YYYY-MM-DD
  gradeId: string;
  sectionId: string;
  
  // Optional for daily attendance, required for period/subject
  subjectId?: string;
  teacherId?: string;
  
  sessionType: AttendanceSessionType;
  status: AttendanceSessionStatus;
  
  markedBy?: string; // staff/user ID who marked it
  
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  organizationId: string;
  sessionId: string;
  studentId: string;
  
  status: AttendanceStatus;
  note?: string;
  
  markedAt: string;
  markedBy: string;
  updatedAt: string;
}

export interface AttendanceSummary {
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
}

// --- TIMETABLE & SCHEDULING ---

export interface SchoolSchedule {
  id: string;
  organizationId: string;
  academicYearId: string;
  workingDays: number[]; // 0=Sunday, 1=Monday, etc.
  scheduleStartTime: string; // e.g. "08:00"
  scheduleEndTime: string; // e.g. "16:00"
  createdAt: string;
  updatedAt: string;
}

export type PeriodType = "teaching" | "break" | "activity";

export interface TimePeriod {
  id: string;
  organizationId: string;
  name: string; // e.g. "Period 1", "Lunch Break"
  startTime: string; // e.g. "08:00"
  endTime: string; // e.g. "08:45"
  type: PeriodType;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableEntry {
  id: string;
  organizationId: string;
  academicYearId: string;
  termId?: string;
  gradeId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string; // Staff ID
  roomId?: string; // Where applicable
  dayOfWeek: number; // 0-6
  periodId: string;
  createdAt: string;
  updatedAt: string;
}

// --- EXAMINATION, ASSESSMENT & RESULTS MANAGEMENT ---

export type ExaminationType =
  | "monthly_test"
  | "mid_term"
  | "final_term"
  | "annual"
  | "entry_assessment"
  | "other";

export type ExaminationStatus = "draft" | "scheduled" | "in_progress" | "completed" | "published" | "archived";
export type AssessmentType = "class_test" | "assignment" | "quiz" | "project" | "practical" | "oral" | "other";
export type AssessmentStatus = "draft" | "assigned" | "in_progress" | "completed" | "published" | "archived";
export type ExamSubjectStatus = "draft" | "scheduled" | "completed" | "cancelled";
export type ResultStatus = "draft" | "in_progress" | "completed" | "published" | "archived";

export interface Examination {
  id: string;
  organizationId: string;
  name: string;
  academicYearId: string;
  termId?: string;
  type: ExaminationType;
  startDate: string;
  endDate: string;
  status: ExaminationStatus;
  description?: string;
  publishedAt?: string;
  publishedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExaminationSubject {
  id: string;
  organizationId: string;
  examinationId: string;
  gradeId: string;
  sectionId?: string;
  subjectId: string;
  maximumMarks: number;
  passingMarks: number;
  weightage?: number;
  examDate?: string;
  status: ExamSubjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  organizationId: string;
  title: string;
  academicYearId: string;
  termId?: string;
  gradeId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  type: AssessmentType;
  maximumMarks: number;
  passingMarks: number;
  weightage?: number;
  assessmentDate: string;
  status: AssessmentStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type MarkSourceType = "examination" | "assessment";

export interface MarkRecord {
  id: string;
  organizationId: string;
  sourceType: MarkSourceType;
  sourceId: string;
  examinationSubjectId?: string;
  academicYearId: string;
  termId?: string;
  gradeId: string;
  sectionId: string;
  subjectId: string;
  studentId: string;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
  gradePoint?: number;
  remarks?: string;
  enteredBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GradingRule {
  id: string;
  organizationId: string;
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectResult {
  subjectId: string;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
  gradePoint?: number;
  passed: boolean;
  remarks?: string;
}

export interface StudentResult {
  studentId: string;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
  gradePoint?: number;
  passed: boolean;
  subjects: SubjectResult[];
}

export interface ResultPublication {
  id: string;
  organizationId: string;
  examinationId: string;
  academicYearId: string;
  termId?: string;
  gradeId: string;
  sectionId: string;
  status: ResultStatus;
  results: StudentResult[];
  publishedAt?: string;
  publishedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectPerformance {
  subjectId: string;
  maximumMarks: number;
  average: number;
  highest: number;
  lowest: number;
  passRate: number;
  gradeDistribution: Record<string, number>;
}

// --- FEES, BILLING & FINANCIAL MANAGEMENT ---

export type FinanceRecordStatus = "active" | "inactive" | "archived";
export type FeeFrequency = "one_time" | "monthly" | "quarterly" | "term_based" | "annual" | "custom";
export type DiscountType = "fixed" | "percentage";
export type DiscountStatus = "active" | "inactive" | "expired" | "archived";
export type AdjustmentType = "scholarship" | "sibling_discount" | "staff_child_discount" | "special_concession" | "waiver" | "custom";
export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled" | "voided";
export type PaymentMethod = "cash" | "bank_transfer" | "card" | "online" | "cheque" | "other";
export type PaymentStatus = "recorded" | "voided";
export type LedgerEntryType = "invoice" | "discount" | "payment" | "payment_void";

export interface FeeCategory {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  status: FinanceRecordStatus;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructure {
  id: string;
  organizationId: string;
  academicYearId: string;
  gradeId: string;
  feeCategoryId: string;
  name: string;
  amountCents: number;
  frequency: FeeFrequency;
  effectiveFrom: string;
  effectiveTo?: string;
  status: FinanceRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudentFeeAssignment {
  id: string;
  organizationId: string;
  studentId: string;
  enrollmentId: string;
  academicYearId: string;
  feeStructureId: string;
  amountCents: number;
  status: FinanceRecordStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeeDiscount {
  id: string;
  organizationId: string;
  name: string;
  type: DiscountType;
  value: number;
  reason: string;
  authorizedBy: string;
  studentId?: string;
  feeCategoryId?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  status: DiscountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceAdjustment {
  id: string;
  type: AdjustmentType;
  description: string;
  amountCents: number;
  reason: string;
  authorizedBy: string;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  feeCategoryId: string;
  feeStructureId?: string;
  description: string;
  quantity: number;
  amountCents: number;
  discountCents: number;
  adjustmentCents: number;
  finalAmountCents: number;
}

export interface StudentInvoice {
  id: string;
  organizationId: string;
  studentId: string;
  enrollmentId: string;
  academicYearId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: string;
  items: InvoiceLineItem[];
  discountCents: number;
  adjustmentCents: number;
  subtotalCents: number;
  totalCents: number;
  paidAmountCents: number;
  balanceCents: number;
  adjustments: InvoiceAdjustment[];
  issuedAt?: string;
  voidedAt?: string;
  voidReason?: string;
  notificationEvents?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FeePayment {
  id: string;
  organizationId: string;
  invoiceId: string;
  studentId: string;
  amountCents: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  receivedBy: string;
  notes?: string;
  status: PaymentStatus;
  voidedAt?: string;
  voidReason?: string;
  voidedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeeReceipt {
  id: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  studentId: string;
  receiptNumber: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  receiptDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentFeeLedgerEntry {
  id: string;
  organizationId: string;
  studentId: string;
  invoiceId?: string;
  paymentId?: string;
  receiptId?: string;
  type: LedgerEntryType;
  description: string;
  debitCents: number;
  creditCents: number;
  balanceCents: number;
  occurredAt: string;
}

export interface FeeCollectionSummary {
  totalBilledCents: number;
  totalCollectedCents: number;
  outstandingCents: number;
  overdueCents: number;
  collectionRate: number;
  paymentsTodayCents: number;
  outstandingStudents: number;
}

export interface FeeReportFilters {
  academicYearId?: string;
  gradeId?: string;
  sectionId?: string;
  studentId?: string;
  feeCategoryId?: string;
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface FeeCollectionReportRow {
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: InvoiceStatus;
}

export interface PaymentReportRow {
  paymentId: string;
  invoiceId: string;
  studentId: string;
  amountCents: number;
  paymentDate: string;
  method: PaymentMethod;
  status: PaymentStatus;
}

export interface GradeFeeSummaryRow {
  gradeId: string;
  billedCents: number;
  collectedCents: number;
  outstandingCents: number;
}

// --- COMMUNICATION & NOTIFICATIONS ---

export type CommunicationPriority = "normal" | "important" | "urgent";
export type CommunicationChannel = "in_app" | "email" | "sms" | "whatsapp";
export type CommunicationStatus = "draft" | "scheduled" | "sent" | "cancelled" | "failed";
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "archived" | "cancelled";
export type DeliveryStatus = "pending" | "queued" | "sent" | "delivered" | "failed" | "cancelled";
export type RecipientKind = "student" | "guardian" | "staff" | "teacher" | "user";
export type AudienceType =
  | "organization"
  | "all_students"
  | "all_guardians"
  | "all_teachers"
  | "all_staff"
  | "class"
  | "section"
  | "selected_students"
  | "selected_guardians"
  | "selected_staff"
  | "selected_users";

export interface CommunicationAudience {
  type: AudienceType;
  academicYear?: string;
  gradeId?: string;
  sectionId?: string;
  studentIds?: string[];
  guardianIds?: string[];
  staffIds?: string[];
  userIds?: string[];
}

export interface ResolvedRecipient {
  id: string;
  organizationId: string;
  kind: RecipientKind;
  displayName: string;
  email?: string;
  phone?: string;
  userId?: string;
  studentId?: string;
  guardianId?: string;
  staffId?: string;
}

export interface Announcement {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  authorId: string;
  audience: CommunicationAudience;
  priority: CommunicationPriority;
  publishAt?: string;
  expiresAt?: string;
  status: AnnouncementStatus;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface CommunicationMessage {
  id: string;
  organizationId: string;
  subject: string;
  body: string;
  senderId: string;
  audience: CommunicationAudience;
  channels: CommunicationChannel[];
  priority: CommunicationPriority;
  status: CommunicationStatus;
  scheduledAt?: string;
  templateId?: string;
  idempotencyKey?: string;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

export interface SisNotification {
  id: string;
  organizationId: string;
  recipientKind: RecipientKind;
  recipientId: string;
  recipientUserId?: string;
  type: string;
  title: string;
  message: string;
  priority: CommunicationPriority;
  relatedResourceType?: string;
  relatedResourceId?: string;
  actionPath?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface CommunicationTemplate {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  subject: string;
  content: string;
  supportedVariables: string[];
  status: FinanceRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAttempt {
  id: string;
  organizationId: string;
  communicationId?: string;
  announcementId?: string;
  notificationId?: string;
  recipientId: string;
  recipientKind: RecipientKind;
  channel: CommunicationChannel;
  status: DeliveryStatus;
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  errorCategory?: string;
  retryCount: number;
}

export interface NotificationPreference {
  id: string;
  organizationId: string;
  recipientKind: RecipientKind;
  recipientId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  academicEnabled: boolean;
  financeEnabled: boolean;
  generalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationSummary {
  publishedAnnouncements: number;
  communicationsSent: number;
  pendingDeliveries: number;
  failedDeliveries: number;
  unreadNotifications: number;
}

// --- PARENT & STUDENT PORTAL ---

export type PortalRole = "parent" | "student";
export type PortalUpdateRequestStatus = "submitted" | "reviewing" | "approved" | "rejected";
export type PortalUpdateRequestType = "contact_update" | "profile_update" | "communication_preference" | "other";

export interface PortalActor {
  organizationId: string;
  userId: string;
  role: PortalRole;
}

export interface PortalStudentSummary {
  id: string;
  displayName: string;
  admissionNumber: string;
  status: StudentStatus;
  photoUrl?: string;
  email?: string;
  phone?: string;
  gradeName?: string;
  sectionName?: string;
  academicYear?: string;
}

export interface PortalTimetableItem {
  id: string;
  dayOfWeek: number;
  periodName: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName: string;
  roomId?: string;
}

export interface PortalResultItem {
  id: string;
  sourceType: MarkSourceType;
  sourceName: string;
  subjectName: string;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
  passed?: boolean;
  remarks?: string;
  publishedAt?: string;
}

export interface PortalFinanceSummary {
  visible: boolean;
  providerConfigured: boolean;
  outstandingCents: number;
  overdueCents: number;
  invoices: StudentInvoice[];
  payments: FeePayment[];
  receipts: FeeReceipt[];
}

export interface PortalCommunicationSummary {
  announcements: Announcement[];
  notifications: SisNotification[];
  unreadNotifications: number;
  messages: CommunicationMessage[];
}

export interface PortalStudentDashboard {
  student: PortalStudentSummary;
  attendance: AttendanceSummary;
  attendanceHistory: Array<{ session: AttendanceSession; record: AttendanceRecord }>;
  timetable: PortalTimetableItem[];
  results: PortalResultItem[];
  assessments: PortalResultItem[];
  finance: PortalFinanceSummary;
  communication: PortalCommunicationSummary;
}

export interface ParentPortalDashboard {
  userId: string;
  linkedStudents: PortalStudentSummary[];
  selectedStudent?: PortalStudentDashboard;
  totalUnreadNotifications: number;
}

export interface StudentPortalDashboard extends PortalStudentDashboard {
  userId: string;
}

export interface PortalUpdateRequest {
  id: string;
  organizationId: string;
  requesterUserId: string;
  requesterRole: PortalRole;
  studentId?: string;
  type: PortalUpdateRequestType;
  subject: string;
  details: string;
  status: PortalUpdateRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PortalPolicy {
  organizationId: string;
  studentFinanceVisible: boolean;
  studentMessagingEnabled: boolean;
  parentMessagingEnabled: boolean;
}

// --- SIS ANALYTICS, REPORTING & OPERATIONAL HEALTH ---

export type SisAnalyticsPermission =
  | "analytics.view"
  | "reports.view"
  | "reports.export"
  | "student_reports.view"
  | "staff_reports.view"
  | "attendance_reports.view"
  | "timetable_reports.view"
  | "results_reports.view"
  | "finance_reports.view"
  | "communication_reports.view"
  | "data_quality.view"
  | "sis_health.view";

export type SisReportKind =
  | "student_directory"
  | "staff_directory"
  | "attendance_summary"
  | "timetable_summary"
  | "results_summary"
  | "finance_collection"
  | "communication_delivery";

export type SisHealthStatus = "healthy" | "warning" | "critical";
export type SisModuleCompletionStatus = "complete" | "partial" | "issue";
export type SisDataQualitySeverity = "info" | "warning" | "critical";

export interface SisAnalyticsActor {
  userId: string;
  role: "Owner" | "Admin" | "Member" | "Teacher" | "Accountant";
  permissions?: SisAnalyticsPermission[];
}

export interface SisAnalyticsFilters {
  academicYearId?: string;
  termId?: string;
  gradeId?: string;
  sectionId?: string;
  subjectId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SisMetric {
  label: string;
  value: number;
  unit?: "count" | "percent" | "cents";
}

export interface SisDistributionItem {
  label: string;
  value: number;
}

export interface SisAnalyticsOverview {
  students: {
    total: number;
    active: number;
    admissions: number;
    withdrawals: number;
    byStatus: SisDistributionItem[];
    byClass: SisDistributionItem[];
  };
  staff: {
    total: number;
    activeTeachers: number;
    activeStaff: number;
    teachersWithoutAssignments: number;
  };
  attendance: AttendanceSummary & {
    completedSessions: number;
    draftSessions: number;
  };
  academics: {
    academicYears: number;
    activeAcademicYears: number;
    grades: number;
    sections: number;
    subjects: number;
  };
  timetable: {
    scheduledClasses: number;
    teacherLoad: SisDistributionItem[];
    periodUtilization: SisDistributionItem[];
  };
  results: {
    examinations: number;
    publishedResults: number;
    passRate: number;
    averagePerformance: number;
  };
  finance: FeeCollectionSummary;
  communication: CommunicationSummary & {
    failedDeliveries: number;
  };
  portal: {
    linkedParentAccounts: number;
    linkedStudentAccounts: number;
    portalReadyStudents: number;
  };
}

export interface SisReportColumn {
  key: string;
  label: string;
  sensitive?: boolean;
}

export interface SisReportResult {
  kind: SisReportKind;
  title: string;
  columns: SisReportColumn[];
  rows: Array<Record<string, string | number | boolean | null>>;
  generatedAt: string;
}

export interface SisDataQualityIssue {
  id: string;
  category: string;
  severity: SisDataQualitySeverity;
  title: string;
  details: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
}

export interface SisReadinessItem {
  key: string;
  label: string;
  status: SisHealthStatus;
  details: string;
}

export interface SisModuleCompletion {
  epic: "10A" | "10B" | "10C" | "10D" | "10E" | "10F" | "10G" | "10H" | "10I";
  module: string;
  status: SisModuleCompletionStatus;
  details: string;
}

export interface SisHealthOverview {
  status: SisHealthStatus;
  readiness: SisReadinessItem[];
  dataQuality: SisDataQualityIssue[];
  modules: SisModuleCompletion[];
}
