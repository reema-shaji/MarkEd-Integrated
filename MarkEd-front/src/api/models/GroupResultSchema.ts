/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Transparent score breakdown: base + adjustment = final (Hao GM-13).
 */
export type GroupResultSchema = {
    group_score: number;
    group_total: number;
    group_percentage: number;
    personal_adjustment: number;
    adjustment_reason?: (string | null);
    final_score: number;
    final_percentage: number;
};

