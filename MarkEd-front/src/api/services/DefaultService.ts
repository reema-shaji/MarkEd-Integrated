/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AllSubmissionSchema } from '../models/AllSubmissionSchema';
import type { AssignmentSchema } from '../models/AssignmentSchema';
import type { AssignmentStatistics } from '../models/AssignmentStatistics';
import type { CommentCreate } from '../models/CommentCreate';
import type { CourseSchema } from '../models/CourseSchema';
import type { CreationResponse } from '../models/CreationResponse';
import type { DismissedLLMFeedbackResponse } from '../models/DismissedLLMFeedbackResponse';
import type { DismissLLMFeedbackRequest } from '../models/DismissLLMFeedbackRequest';
import type { FileAccessResponse } from '../models/FileAccessResponse';
import type { FileUploadResponse } from '../models/FileUploadResponse';
import type { MarkerCommentUpdate } from '../models/MarkerCommentUpdate';
import type { PeerAssignmentCreationResponse } from '../models/PeerAssignmentCreationResponse';
import type { PeerAssignmentRequest } from '../models/PeerAssignmentRequest';
import type { PeerMatch } from '../models/PeerMatch';
import type { PeerReviewCommentAction } from '../models/PeerReviewCommentAction';
import type { PeerReviewCommentSchema } from '../models/PeerReviewCommentSchema';
import type { PeerReviewCompletion } from '../models/PeerReviewCompletion';
import type { PeerReviewSchema } from '../models/PeerReviewSchema';
import type { PeerReviewSchemaWithStudent } from '../models/PeerReviewSchemaWithStudent';
import type { PeersLastSubmissionResponse } from '../models/PeersLastSubmissionResponse';
import type { SubmissionRequest } from '../models/SubmissionRequest';
import type { SubmissionResponse } from '../models/SubmissionResponse';
import type { SubmissionSchema } from '../models/SubmissionSchema';
import type { UserSchema } from '../models/UserSchema';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Health
     * @returns any OK
     * @throws ApiError
     */
    public static markEdApiRoutesHealthHealth(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/health/health',
        });
    }
    /**
     * Ping
     * @returns any OK
     * @throws ApiError
     */
    public static markEdApiRoutesHealthPing(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/health/ping',
        });
    }
    /**
     * Get Current User
     * @returns UserSchema OK
     * @throws ApiError
     */
    public static getCurrentUser(): CancelablePromise<UserSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/current-user',
        });
    }
    /**
     * Get Users Online
     * @returns UserSchema OK
     * @throws ApiError
     */
    public static getUsersOnline(): CancelablePromise<Array<UserSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/users-online',
        });
    }
    /**
     * Get Users Online Count
     * @returns number OK
     * @throws ApiError
     */
    public static getUsersOnlineCount(): CancelablePromise<number> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/users-online-count',
        });
    }
    /**
     * Get Course
     * @param courseId
     * @returns CourseSchema OK
     * @throws ApiError
     */
    public static getCourse(
        courseId: number,
    ): CancelablePromise<CourseSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/courses/{course_id}',
            path: {
                'course_id': courseId,
            },
        });
    }
    /**
     * List Assignments
     * @returns AssignmentSchema OK
     * @throws ApiError
     */
    public static getAssignments(): CancelablePromise<Array<AssignmentSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/',
        });
    }
    /**
     * Get Assignment
     * @param assignmentId
     * @returns AssignmentSchema OK
     * @throws ApiError
     */
    public static getAssignment(
        assignmentId: number,
    ): CancelablePromise<AssignmentSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Create Peer Assignment
     * @param courseId
     * @param requestBody
     * @returns PeerAssignmentCreationResponse OK
     * @throws ApiError
     */
    public static createPeerAssignment(
        courseId: number,
        requestBody: PeerAssignmentRequest,
    ): CancelablePromise<PeerAssignmentCreationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/create-peer-assignment/{course_id}',
            path: {
                'course_id': courseId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Matched Peers
     * @param assignmentId
     * @returns PeerMatch OK
     * @throws ApiError
     */
    public static getMatchedPeers(
        assignmentId: number,
    ): CancelablePromise<Array<PeerMatch>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/matched-peers',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Trigger Peer Review Matching
     * @param assignmentId
     * @returns CreationResponse OK
     * @throws ApiError
     */
    public static triggerPeerReviewMatching(
        assignmentId: number,
    ): CancelablePromise<CreationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/{assignment_id}/trigger-peer-review-matching',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Assignment Statistics
     * @param assignmentId
     * @returns AssignmentStatistics OK
     * @throws ApiError
     */
    public static getAssignmentStatistics(
        assignmentId: number,
    ): CancelablePromise<AssignmentStatistics> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/statistics',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Peer Reviews
     * @param assignmentId
     * @returns PeerReviewSchema OK
     * @throws ApiError
     */
    public static getPeerReviews(
        assignmentId: number,
    ): CancelablePromise<Array<PeerReviewSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/peer-reviews/{assignment_id}/reviews',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Submit Peer Review
     * @param assignmentId
     * @param submissionId
     * @returns CreationResponse OK
     * @throws ApiError
     */
    public static markEdApiRoutesPeerReviewsSubmitPeerReview(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<CreationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/peer-reviews/{assignment_id}/submit-review',
            path: {
                'assignment_id': assignmentId,
            },
            query: {
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Create Peer Review Comment
     * @param assignmentId
     * @param submissionId
     * @param requestBody
     * @returns PeerReviewCommentSchema OK
     * @throws ApiError
     */
    public static createPeerReviewComment(
        assignmentId: number,
        submissionId: number,
        requestBody: CommentCreate,
    ): CancelablePromise<PeerReviewCommentSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Peer Review Comments
     * @param assignmentId
     * @param submissionId
     * @returns PeerReviewCommentSchema OK
     * @throws ApiError
     */
    public static getPeerReviewComments(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<Array<PeerReviewCommentSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Delete Peer Review Comment
     * @param assignmentId
     * @param submissionId
     * @param commentId
     * @returns PeerReviewCommentAction OK
     * @throws ApiError
     */
    public static deletePeerReviewComment(
        assignmentId: number,
        submissionId: number,
        commentId: number,
    ): CancelablePromise<PeerReviewCommentAction> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments/{comment_id}',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
                'comment_id': commentId,
            },
        });
    }
    /**
     * Update Peer Review Comment
     * @param assignmentId
     * @param submissionId
     * @param commentId
     * @param requestBody
     * @returns PeerReviewCommentAction OK
     * @throws ApiError
     */
    public static updatePeerReviewComment(
        assignmentId: number,
        submissionId: number,
        commentId: number,
        requestBody: CommentCreate,
    ): CancelablePromise<PeerReviewCommentAction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments/{comment_id}',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
                'comment_id': commentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Peer Review Complete
     * @param assignmentId
     * @param submissionId
     * @returns PeerReviewCompletion OK
     * @throws ApiError
     */
    public static isPeerReviewComplete(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<PeerReviewCompletion> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/complete',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Complete Peer Review
     * @param assignmentId
     * @param submissionId
     * @returns PeerReviewCompletion OK
     * @throws ApiError
     */
    public static togglePeerReviewCompleteness(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<PeerReviewCompletion> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/completenessToggle',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Dismiss Llm Feedback
     * @param assignmentId
     * @param submissionId
     * @param commentId
     * @param requestBody
     * @returns DismissedLLMFeedbackResponse OK
     * @throws ApiError
     */
    public static dismissLlmFeedback(
        assignmentId: number,
        submissionId: number,
        commentId: number,
        requestBody: DismissLLMFeedbackRequest,
    ): CancelablePromise<DismissedLLMFeedbackResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments/{comment_id}/dismiss-llm',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
                'comment_id': commentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Update Marker Comment
     * @param assignmentId
     * @param submissionId
     * @param commentId
     * @param requestBody
     * @returns PeerReviewCommentAction OK
     * @throws ApiError
     */
    public static updateMarkerComment(
        assignmentId: number,
        submissionId: number,
        commentId: number,
        requestBody: MarkerCommentUpdate,
    ): CancelablePromise<PeerReviewCommentAction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments/{comment_id}/marker',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
                'comment_id': commentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Marker Allocations
     * Get peer reviews allocated to this marker
     * @param assignmentId
     * @returns PeerReviewSchemaWithStudent OK
     * @throws ApiError
     */
    public static getMarkerAllocations(
        assignmentId: number,
    ): CancelablePromise<Array<PeerReviewSchemaWithStudent>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/peer-reviews/{assignment_id}/marker-allocations',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * List Submissions
     * @returns SubmissionSchema OK
     * @throws ApiError
     */
    public static listSubmissions(): CancelablePromise<Array<SubmissionSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/',
        });
    }
    /**
     * Create Submission
     * @param requestBody
     * @returns SubmissionResponse OK
     * @throws ApiError
     */
    public static createSubmission(
        requestBody: SubmissionRequest,
    ): CancelablePromise<SubmissionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/submissions/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Submission
     * @param submissionId
     * @returns SubmissionSchema OK
     * @throws ApiError
     */
    public static getSubmission(
        submissionId: number,
    ): CancelablePromise<SubmissionSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/{submission_id}',
            path: {
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Get Last Submission
     * @param assignmentId
     * @returns SubmissionSchema OK
     * @throws ApiError
     */
    public static getLastSubmission(
        assignmentId: number,
    ): CancelablePromise<SubmissionSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/assignment/{assignment_id}/last',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Peers Last Submission
     * @param assignmentId
     * @param submissionId
     * @returns PeersLastSubmissionResponse OK
     * @throws ApiError
     */
    public static getPeersLastSubmission(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<PeersLastSubmissionResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/assignment/{assignment_id}/peer-review/{submission_id}',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Get All Submissions
     * Get all submissions for an assignment, ordered by most recent first
     * @param assignmentId
     * @returns AllSubmissionSchema OK
     * @throws ApiError
     */
    public static getAllSubmissions(
        assignmentId: number,
    ): CancelablePromise<Array<AllSubmissionSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/{assignment_id}/all',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Submission For Marking
     * Get a specific submission for marking
     * @param assignmentId
     * @param submissionId
     * @returns PeersLastSubmissionResponse OK
     * @throws ApiError
     */
    public static getSubmissionForMarking(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<PeersLastSubmissionResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/assignment/{assignment_id}/submission/{submission_id}',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Get Submission File Access Url
     * Get the presigned URL for a submission file
     * @param assignmentId
     * @param filename
     * @returns FileAccessResponse OK
     * @throws ApiError
     */
    public static getSubmissionFileAccessUrl(
        assignmentId: number,
        filename: string,
    ): CancelablePromise<FileAccessResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/files/get-submission-file-access-url',
            query: {
                'assignment_id': assignmentId,
                'filename': filename,
            },
        });
    }
    /**
     * Get Instruction File Access Url
     * Get the presigned URL for a file
     * TODO: Check permissions of user to access the file. They need to be enrolled in the course and the assingment must be open
     * @param assignmentId
     * @param filename
     * @returns FileAccessResponse OK
     * @throws ApiError
     */
    public static getInstructionFileAccessUrl(
        assignmentId: number,
        filename: string,
    ): CancelablePromise<FileAccessResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/files/get-instruction-file-access-url',
            query: {
                'assignment_id': assignmentId,
                'filename': filename,
            },
        });
    }
    /**
     * Get Upload Url
     * @param filename
     * @param type
     * @param contentType
     * @returns FileUploadResponse OK
     * @throws ApiError
     */
    public static getUploadUrl(
        filename: string,
        type: 'submission' | 'instruction',
        contentType: string,
    ): CancelablePromise<FileUploadResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/files/get-upload-url',
            query: {
                'filename': filename,
                'type': type,
                'content_type': contentType,
            },
        });
    }
}
