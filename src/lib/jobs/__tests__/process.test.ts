import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the job processor routing logic.
// We mock the claim module and handlers to test the orchestration.

const mockClaimJobs = vi.fn();
const mockSucceedJob = vi.fn();
const mockFailJob = vi.fn();
const mockHandleGeneratePost = vi.fn();
const mockHandleCrewComment = vi.fn();
const mockHandleRecalcEngagement = vi.fn();

vi.mock("../claim", () => ({
  claimJobs: (...args: unknown[]) => mockClaimJobs(...args),
  succeedJob: (...args: unknown[]) => mockSucceedJob(...args),
  failJob: (...args: unknown[]) => mockFailJob(...args),
}));

vi.mock("../handlers/generatePost", () => ({
  handleGeneratePost: (...args: unknown[]) => mockHandleGeneratePost(...args),
}));

vi.mock("../handlers/crewComment", () => ({
  handleCrewComment: (...args: unknown[]) => mockHandleCrewComment(...args),
}));

vi.mock("../handlers/recalcEngagement", () => ({
  handleRecalcEngagement: (...args: unknown[]) => mockHandleRecalcEngagement(...args),
}));

const { processJobs } = await import("../process");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processJobs", () => {
  it("returns zero counts when no jobs are available", async () => {
    mockClaimJobs.mockResolvedValue([]);

    const result = await processJobs(10);

    expect(result).toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    });
  });

  it("routes GENERATE_POST to the correct handler", async () => {
    mockClaimJobs.mockResolvedValue([
      { id: "j1", type: "GENERATE_POST", botId: "bot-1", status: "RUNNING" },
    ]);
    mockHandleGeneratePost.mockResolvedValue(undefined);
    mockSucceedJob.mockResolvedValue(undefined);

    const result = await processJobs(10);

    expect(mockHandleGeneratePost).toHaveBeenCalledWith("bot-1");
    expect(mockSucceedJob).toHaveBeenCalledWith("j1");
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("routes CREW_COMMENT to the correct handler", async () => {
    mockClaimJobs.mockResolvedValue([
      { id: "j2", type: "CREW_COMMENT", botId: null, status: "RUNNING" },
    ]);
    mockHandleCrewComment.mockResolvedValue(undefined);
    mockSucceedJob.mockResolvedValue(undefined);

    const result = await processJobs(10);

    expect(mockHandleCrewComment).toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
  });

  it("routes RECALC_ENGAGEMENT to the correct handler", async () => {
    mockClaimJobs.mockResolvedValue([
      { id: "j3", type: "RECALC_ENGAGEMENT", botId: null, status: "RUNNING" },
    ]);
    mockHandleRecalcEngagement.mockResolvedValue(undefined);
    mockSucceedJob.mockResolvedValue(undefined);

    const result = await processJobs(10);

    expect(mockHandleRecalcEngagement).toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
  });

  it("calls failJob when a handler throws", async () => {
    mockClaimJobs.mockResolvedValue([
      { id: "j4", type: "GENERATE_POST", botId: "bot-2", status: "RUNNING" },
    ]);
    mockHandleGeneratePost.mockRejectedValue(new Error("API timeout"));
    mockFailJob.mockResolvedValue(undefined);

    const result = await processJobs(10);

    expect(mockFailJob).toHaveBeenCalledWith("j4", "API timeout");
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("API timeout");
  });

  it("fails GENERATE_POST without botId", async () => {
    mockClaimJobs.mockResolvedValue([
      { id: "j5", type: "GENERATE_POST", botId: null, status: "RUNNING" },
    ]);
    mockFailJob.mockResolvedValue(undefined);

    const result = await processJobs(10);

    expect(mockFailJob).toHaveBeenCalledWith("j5", "GENERATE_POST requires botId");
    expect(result.failed).toBe(1);
  });

  it("processes mixed jobs and counts correctly", async () => {
    mockClaimJobs.mockResolvedValue([
      { id: "j6", type: "GENERATE_POST", botId: "bot-a", status: "RUNNING" },
      { id: "j7", type: "CREW_COMMENT", botId: null, status: "RUNNING" },
      { id: "j8", type: "GENERATE_POST", botId: "bot-b", status: "RUNNING" },
    ]);
    mockHandleGeneratePost.mockResolvedValueOnce(undefined);
    mockHandleCrewComment.mockResolvedValue(undefined);
    mockHandleGeneratePost.mockRejectedValueOnce(new Error("Flux down"));
    mockSucceedJob.mockResolvedValue(undefined);
    mockFailJob.mockResolvedValue(undefined);

    const result = await processJobs(10);

    expect(result.processed).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("respects the limit parameter", async () => {
    mockClaimJobs.mockResolvedValue([]);

    await processJobs(5);

    expect(mockClaimJobs).toHaveBeenCalledWith(5);
  });
});
