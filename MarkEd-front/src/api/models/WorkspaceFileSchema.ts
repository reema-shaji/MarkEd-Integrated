/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceCommentSchema } from './WorkspaceCommentSchema';
export type WorkspaceFileSchema = {
    id: number;
    group_id: number;
    assignment_id: number;
    uploaded_by_id: number;
    uploaded_by_name: string;
    file?: (string | null);
    file_name: string;
    file_size: number;
    file_type: string;
    status: string;
    upload_time: string;
    comments?: Array<WorkspaceCommentSchema>;
};

