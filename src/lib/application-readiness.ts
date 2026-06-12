import type { ApplicationReadinessChecklistItem } from "@/lib/types";

export const applicationReadinessChecklist: ApplicationReadinessChecklistItem[] = [
  { id: "photo-id", label: "Photo identification", requiredForMostApplications: true },
  { id: "employment-letter", label: "Employment letter", requiredForMostApplications: true },
  { id: "pay-stubs", label: "Recent pay stubs", requiredForMostApplications: true },
  { id: "bank-statements", label: "Bank statements", requiredForMostApplications: true },
  { id: "landlord-reference", label: "Landlord reference", requiredForMostApplications: true },
  { id: "credit-report", label: "Credit screenshot or report", requiredForMostApplications: true },
  { id: "guarantor-documents", label: "Guarantor documents", requiredForMostApplications: false },
  { id: "pet-documents", label: "Pet documents", requiredForMostApplications: false },
];

export function getApplicationReadinessSummary() {
  return {
    trackedReadyCount: 0,
    totalCount: applicationReadinessChecklist.length,
    items: applicationReadinessChecklist,
  };
}
