export interface TenantLabels {
  customerLabel: string;      // "Patient", "Borrower", "Member", etc.
  customersLabelPlural: string; // "Patients", "Borrowers", "Members"
  dateLabel: string;          // "Appointment Date", "EMI Due Date", etc.
  typeLabel: string;          // "Medical Case", "Loan Type", etc.
  customSuggestions: string[]; // ["Doctor Name"], ["EMI Amount"], etc.
}

export const INDUSTRY_TAXONOMY: Record<string, TenantLabels> = {
  clinic: {
    customerLabel: "Patient",
    customersLabelPlural: "Patients",
    dateLabel: "Appointment Date",
    typeLabel: "Treatment Type",
    customSuggestions: ["Doctor Name", "Insurance Provider", "Treatment Cost"],
  },
  nbfc: {
    customerLabel: "Borrower",
    customersLabelPlural: "Borrowers",
    dateLabel: "EMI Due Date",
    typeLabel: "Loan Type",
    customSuggestions: ["Loan Account Number", "Outstanding Balance", "EMI Amount"],
  },
  finance: {
    customerLabel: "Borrower",
    customersLabelPlural: "Borrowers",
    dateLabel: "EMI Due Date",
    typeLabel: "Loan Type",
    customSuggestions: ["Loan Account Number", "Outstanding Balance", "EMI Amount"],
  },
  gym: {
    customerLabel: "Member",
    customersLabelPlural: "Members",
    dateLabel: "Renewal Date",
    typeLabel: "Membership Plan",
    customSuggestions: ["Personal Trainer", "Locker Number", "Branch Location"],
  },
  'real-estate': {
    customerLabel: "Lead",
    customersLabelPlural: "Leads",
    dateLabel: "Site Visit Date",
    typeLabel: "Property Interest",
    customSuggestions: ["Budget Range", "Preferred Location", "Unit Configuration"],
  },
  d2c: {
    customerLabel: "Buyer",
    customersLabelPlural: "Buyers",
    dateLabel: "Delivery Date",
    typeLabel: "Order Status",
    customSuggestions: ["Order ID", "COD Balance Pending", "Courier Partner"],
  },
  default: {
    customerLabel: "Customer",
    customersLabelPlural: "Customers",
    dateLabel: "Due Date",
    typeLabel: "Customer Type",
    customSuggestions: ["Account Manager", "Preferred Time", "Alternative Phone"],
  }
};

export function getTenantLabels(businessType: string | null | undefined): TenantLabels {
  if (!businessType) return INDUSTRY_TAXONOMY.default;
  const key = businessType.toLowerCase().trim();
  return INDUSTRY_TAXONOMY[key] || INDUSTRY_TAXONOMY.default;
}
