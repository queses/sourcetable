import { ColumnTemplate, ColumnTypeEnum } from "./types"
import { Phone, FileText, Calendar, Briefcase, Building2 } from "lucide-react"

export const COLUMN_TEMPLATES: ColumnTemplate[] = [
  {
    id: "name",
    title: "Company name",
    icon: Building2,
    prompt: "Extract the juridical name of this company (e.g. 'Netflix, Inc.', 'Google LLC', etc.)",
    type: ColumnTypeEnum.TEXT,
  },
  {
    id: "year",
    title: "Year founded",
    icon: Calendar,
    prompt: "Find the year this company was founded",
    type: ColumnTypeEnum.NUMBER,
  },
  {
    id: "industry",
    title: "Company industry",
    icon: Briefcase,
    prompt: "Find the industry for this company (e.g. 'Software', 'Consulting', 'Finance', 'Healthcare', etc.)",
    type: ColumnTypeEnum.TEXT,
  },
  {
    id: "linkedin",
    title: "LinkedIn",
    icon: Phone,
    prompt: "Find LinkedIn URL for the company",
    type: ColumnTypeEnum.TEXT,
  },
  {
    id: "summary",
    title: "Company summary",
    icon: FileText,
    prompt:
      "Create a brief summary of 60 words or less describing what this company does, its main products or services, and key information",
    type: ColumnTypeEnum.TEXT,
  },
]
