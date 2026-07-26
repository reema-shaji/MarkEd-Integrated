/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CriterionResultEntry } from './CriterionResultEntry';
/**
 * A student's own mark for an individual assignment.
 *
 * Mirrors the original student-home mark (Tomas' student/views.home): the mark
 * is only revealed once every criterion is Finished. Until then `released` is
 * False and the numbers are withheld — the same finished-only gate the source
 * used before showing a mark instead of "-".
 */
export type MySubmissionResultSchema = {
    released: boolean;
    status: string;
    score: number;
    total: number;
    percentage: number;
    breakdown: Array<CriterionResultEntry>;
};

