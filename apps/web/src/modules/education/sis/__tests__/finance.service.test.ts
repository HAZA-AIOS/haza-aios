import { beforeEach, describe, expect, it } from "vitest";
import { AcademicService } from "../academic.service";
import { EnrollmentService } from "../enrollment.service";
import { FinanceService } from "../finance.service";
import { StudentService } from "../student.service";

const owner = { userId: "owner-1", role: "Owner" as const };
const accountant = { userId: "acct-1", role: "Accountant" as const };
const member = { userId: "member-1", role: "Member" as const };

async function seedFinanceContext(organizationId: string) {
  const year = await AcademicService.createAcademicYear(organizationId, {
    name: `2026-2027-${organizationId}`,
    startDate: "2026-08-01",
    endDate: "2027-07-31",
    status: "active",
  });
  const grade = await AcademicService.createGrade(organizationId, {
    name: "Grade 5",
    level: 5,
    order: 5,
    status: "active",
  });
  const section = await AcademicService.createSection(organizationId, {
    gradeId: grade.id,
    name: "A",
    capacity: 35,
    status: "active",
  });
  const student = await StudentService.createStudent({
    organizationId,
    firstName: "Mina",
    lastName: "Shah",
    dateOfBirth: "2014-01-01",
    gender: "female",
    admissionDate: "2026-08-01",
    status: "active",
    guardians: [],
  });
  const enrollment = await EnrollmentService.enrollStudent({
    organizationId,
    studentId: student.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    enrollmentDate: "2026-08-01",
    status: "active",
  });
  const category = await FinanceService.createFeeCategory(organizationId, {
    name: "Tuition Fee",
    code: `TUITION-${organizationId}`,
    description: "Recurring tuition",
    status: "active",
    displayOrder: 1,
  }, owner);
  const structure = await FinanceService.createFeeStructure(organizationId, {
    name: "Grade 5 Tuition",
    academicYearId: year.id,
    gradeId: grade.id,
    feeCategoryId: category.id,
    amountCents: 1_000_000,
    frequency: "monthly",
    effectiveFrom: "2026-08-01",
    status: "active",
  }, owner);
  return { year, grade, section, student, enrollment, category, structure };
}

describe("Epic 10G: Fees, Billing & Financial Management", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates and updates fee categories with organization isolation", async () => {
    const category = await FinanceService.createFeeCategory("org-fees-a", {
      name: "Admission Fee",
      code: "ADM",
      status: "active",
      displayOrder: 1,
    }, owner);
    await FinanceService.updateFeeCategory("org-fees-a", category.id, { status: "inactive" }, owner);

    expect(await FinanceService.getFeeCategories("org-fees-a")).toMatchObject([{ status: "inactive" }]);
    expect(await FinanceService.getFeeCategories("org-fees-b")).toHaveLength(0);
  });

  it("validates fee structures against academic year, class, and category", async () => {
    const { year, grade, category, structure } = await seedFinanceContext("org-structure");

    expect(structure.amountCents).toBe(1_000_000);
    await expect(FinanceService.createFeeStructure("org-structure", {
      name: "Invalid Structure",
      academicYearId: year.id,
      gradeId: grade.id,
      feeCategoryId: category.id,
      amountCents: 0,
      frequency: "annual",
      effectiveFrom: "2026-08-01",
      status: "active",
    }, owner)).rejects.toThrow("greater than zero");
  });

  it("assigns fees using enrollment and rejects wrong organization access", async () => {
    const { student, enrollment, structure } = await seedFinanceContext("org-assignment");
    const assignment = await FinanceService.assignFeeStructureToStudent("org-assignment", student.id, enrollment.id, structure.id, owner);

    expect(assignment.amountCents).toBe(1_000_000);
    await expect(FinanceService.assignFeeStructureToStudent("org-other", student.id, enrollment.id, structure.id, owner))
      .rejects.toThrow("Student not found");
  });

  it("calculates fixed discounts, partial payments, receipts, and paid status", async () => {
    const { student, enrollment, structure, category } = await seedFinanceContext("org-invoice");
    const discount = await FinanceService.createDiscount("org-invoice", {
      name: "Merit Scholarship",
      type: "fixed",
      value: 100_000,
      reason: "Approved scholarship",
      authorizedBy: "Principal",
      studentId: student.id,
      feeCategoryId: category.id,
      status: "active",
    }, owner);

    const invoice = await FinanceService.createInvoice("org-invoice", {
      studentId: student.id,
      enrollmentId: enrollment.id,
      academicYearId: structure.academicYearId,
      issueDate: "2026-09-01",
      dueDate: "2026-09-10",
      currency: "USD",
      feeStructureIds: [structure.id],
      discountIds: [discount.id],
      status: "issued",
    }, accountant);

    expect(invoice.subtotalCents).toBe(1_000_000);
    expect(invoice.discountCents).toBe(100_000);
    expect(invoice.totalCents).toBe(900_000);

    const first = await FinanceService.recordPayment("org-invoice", {
      invoiceId: invoice.id,
      amountCents: 400_000,
      paymentDate: "2026-09-02",
      paymentMethod: "cash",
      referenceNumber: "PAY-1",
      receivedBy: "Cashier",
    }, accountant);
    expect(first.invoice.balanceCents).toBe(500_000);
    expect(first.invoice.status).toBe("partially_paid");
    expect(first.receipt.receiptNumber).toMatch(/^RCT-/);

    const second = await FinanceService.recordPayment("org-invoice", {
      invoiceId: invoice.id,
      amountCents: 500_000,
      paymentDate: "2026-09-03",
      paymentMethod: "bank_transfer",
      referenceNumber: "PAY-2",
      receivedBy: "Cashier",
    }, accountant);
    expect(second.invoice.balanceCents).toBe(0);
    expect(second.invoice.status).toBe("paid");
  });

  it("supports percentage discounts and rejects overpayments and duplicate references", async () => {
    const { student, enrollment, structure, category } = await seedFinanceContext("org-discount");
    const discount = await FinanceService.createDiscount("org-discount", {
      name: "Sibling Discount",
      type: "percentage",
      value: 10,
      reason: "Sibling concession",
      authorizedBy: "Finance Admin",
      feeCategoryId: category.id,
      status: "active",
    }, owner);
    const invoice = await FinanceService.createInvoice("org-discount", {
      studentId: student.id,
      enrollmentId: enrollment.id,
      academicYearId: structure.academicYearId,
      issueDate: "2026-09-01",
      dueDate: "2026-09-10",
      currency: "USD",
      feeStructureIds: [structure.id],
      discountIds: [discount.id],
      status: "issued",
    }, owner);

    expect(invoice.totalCents).toBe(900_000);
    await expect(FinanceService.recordPayment("org-discount", {
      invoiceId: invoice.id,
      amountCents: 900_001,
      paymentDate: "2026-09-02",
      paymentMethod: "cash",
      receivedBy: "Cashier",
    }, accountant)).rejects.toThrow("exceeds outstanding");

    await FinanceService.recordPayment("org-discount", {
      invoiceId: invoice.id,
      amountCents: 100_000,
      paymentDate: "2026-09-02",
      paymentMethod: "cash",
      referenceNumber: "DUP-1",
      receivedBy: "Cashier",
    }, accountant);
    await expect(FinanceService.recordPayment("org-discount", {
      invoiceId: invoice.id,
      amountCents: 100_000,
      paymentDate: "2026-09-03",
      paymentMethod: "cash",
      referenceNumber: "DUP-1",
      receivedBy: "Cashier",
    }, accountant)).rejects.toThrow("reference number already exists");
  });

  it("voids payments instead of deleting financial records", async () => {
    const { student, enrollment, structure } = await seedFinanceContext("org-void");
    const invoice = await FinanceService.createInvoice("org-void", {
      studentId: student.id,
      enrollmentId: enrollment.id,
      academicYearId: structure.academicYearId,
      issueDate: "2026-09-01",
      dueDate: "2026-09-10",
      currency: "USD",
      feeStructureIds: [structure.id],
      status: "issued",
    }, owner);
    const { payment } = await FinanceService.recordPayment("org-void", {
      invoiceId: invoice.id,
      amountCents: 250_000,
      paymentDate: "2026-09-02",
      paymentMethod: "online",
      referenceNumber: "VOID-1",
      receivedBy: "Cashier",
    }, accountant);

    const voided = await FinanceService.voidPayment("org-void", payment.id, "Wrong invoice selected", "Finance Lead", owner);
    const updatedInvoice = (await FinanceService.getInvoices("org-void"))[0];
    const ledger = await FinanceService.getStudentLedger("org-void", student.id);

    expect(voided.status).toBe("voided");
    expect(updatedInvoice.balanceCents).toBe(1_000_000);
    expect(ledger.some((entry) => entry.type === "payment_void")).toBe(true);
  });

  it("enforces finance permissions", async () => {
    await expect(FinanceService.createFeeCategory("org-permissions", {
      name: "Library Fee",
      code: "LIB",
      status: "active",
      displayOrder: 1,
    }, member)).rejects.toThrow("Unauthorized");
  });

  it("returns collection, outstanding, payment, student statement, and class summary reports", async () => {
    const { student, enrollment, structure } = await seedFinanceContext("org-reports");
    const invoice = await FinanceService.createInvoice("org-reports", {
      studentId: student.id,
      enrollmentId: enrollment.id,
      academicYearId: structure.academicYearId,
      issueDate: "2026-09-01",
      dueDate: "2026-09-10",
      currency: "USD",
      feeStructureIds: [structure.id],
      status: "issued",
    }, owner);
    await FinanceService.recordPayment("org-reports", {
      invoiceId: invoice.id,
      amountCents: 300_000,
      paymentDate: "2026-09-02",
      paymentMethod: "cash",
      receivedBy: "Cashier",
    }, accountant);

    const collection = await FinanceService.getCollectionReport("org-reports");
    const outstanding = await FinanceService.getOutstandingReport("org-reports");
    const payments = await FinanceService.getPaymentReport("org-reports");
    const ledger = await FinanceService.getStudentLedger("org-reports", student.id);
    const classSummary = await FinanceService.getGradeFeeSummary("org-reports");
    const summary = await FinanceService.getCollectionSummary("org-reports");

    expect(collection).toHaveLength(1);
    expect(outstanding[0].balanceCents).toBe(700_000);
    expect(payments).toHaveLength(1);
    expect(ledger.at(-1)?.balanceCents).toBe(700_000);
    expect(classSummary[0].outstandingCents).toBe(700_000);
    expect(summary.collectionRate).toBe(30);
  });
});
