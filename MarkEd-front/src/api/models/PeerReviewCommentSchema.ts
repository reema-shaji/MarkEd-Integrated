/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserSchema } from './UserSchema';
export type PeerReviewCommentSchema = {
    id: number;
    selected_text: string;
    feedback: string;
    margin_text_top: string;
    margin_text_bottom: string;
    position_data: Record<string, any>;
    created_at: string;
    author: UserSchema;
    marker_feedback: string;
    llm_feedback: string;
    llm_feedback_dismissed: boolean;
};

