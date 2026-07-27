/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type FeedbackBankSchema = {
    id: number;
    text: string;
    category?: string;
    used_count?: number;
    up_count?: number;
    down_count?: number;
    my_reaction?: (string | null);
    is_favourite?: boolean;
    author_name?: string;
    is_mine?: boolean;
    can_delete?: boolean;
    created_at: string;
};

