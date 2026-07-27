/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupResultSchema } from './GroupResultSchema';
/**
 * A student's group result for an assignment, resolved by assignment id.
 *
 * `finalised` reflects whether the marker has finalised the adjustment; until
 * then the breakdown is provisional and should be presented as such.
 */
export type MyGroupResultSchema = {
    group_name: string;
    submission_version: number;
    finalised: boolean;
    released?: boolean;
    breakdown: GroupResultSchema;
};

