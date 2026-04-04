import { createExport, getExportJob, getExports } from "@workspace/api-client-react";

export const exportClient = {
  create: createExport,
  list: getExports,
  getStatus: getExportJob,
};
