/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PresignedPostData } from './PresignedPostData';
export type FileUploadResponse = {
    success: boolean;
    upload_url: (PresignedPostData | null);
    permanent_url: (string | null);
    message: string;
};

