// src/services/secFilingTemplateService.ts
import type {
  SecFinancialTableTemplate,
  SecFinancialTableTemplateCreate,
  SecFinancialTableTemplateDeleteResult,
  SecFinancialTableTemplateList,
  SecFinancialTableTemplateUpdate
} from '../types/secFilingTemplate';
import { apiClient } from './apiClient';

const BASE = '/sec-filings/table-templates';

export const getFinancialTableTemplates = async () => {
  return apiClient.get<SecFinancialTableTemplateList>(BASE);
};

export const getFinancialTableTemplate = async (id: string) => {
  return apiClient.get<SecFinancialTableTemplate>(`${BASE}/${id}`);
};

export const createFinancialTableTemplate = async (
  payload: SecFinancialTableTemplateCreate
) => {
  return apiClient.post<SecFinancialTableTemplate>(BASE, payload);
};

export const updateFinancialTableTemplate = async (
  id: string,
  payload: SecFinancialTableTemplateUpdate
) => {
  return apiClient.put<SecFinancialTableTemplate>(`${BASE}/${id}`, payload);
};

export const deleteFinancialTableTemplate = async (id: string) => {
  return apiClient.delete<SecFinancialTableTemplateDeleteResult>(`${BASE}/${id}`);
};
