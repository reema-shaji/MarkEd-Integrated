/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupMemberSchema } from './GroupMemberSchema';
export type GroupSchema = {
    id: number;
    course_id: number;
    group_set_id?: (number | null);
    name: string;
    description?: (string | null);
    members?: Array<GroupMemberSchema>;
};

