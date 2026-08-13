import { useState, useEffect } from "react";
import { SisService } from "./sis-service";
import { useOrganization } from "../../../org/use-organization";
import type { School, AcademicYear, Student, Staff } from "./sis.types";

export function useSisSchool() {
  const { organization } = useOrganization();
  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!organization) return;
    setIsLoading(true);
    SisService.getSchoolByOrg(organization.id)
      .then(s => setSchool(s || null))
      .finally(() => setIsLoading(false));
  }, [organization]);

  return { school, isLoading };
}

export function useSisDashboardMetrics() {
  const { organization } = useOrganization();
  const [metrics, setMetrics] = useState<{
    studentCount: number;
    staffCount: number;
    classCount: number;
    currentAcademicYear: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!organization) return;
    setIsLoading(true);
    SisService.getDashboardMetrics(organization.id)
      .then(m => setMetrics(m))
      .finally(() => setIsLoading(false));
  }, [organization]);

  return { metrics, isLoading };
}
