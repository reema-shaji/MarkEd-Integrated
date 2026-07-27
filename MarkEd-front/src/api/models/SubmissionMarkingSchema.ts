/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SubmissionCriterionMark } from './SubmissionCriterionMark';
export type SubmissionMarkingSchema = {
    submission_id: number;
    student_name: string;
    criteria: Array<SubmissionCriterionMark>;
    score: number;
    total: number;
    finalised: boolean;
};

