import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the failJob retry logic without needing a real database.
// We mock Prisma to verify the backoff math and status transitions.

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../prisma", () => ({
  prisma: {
    job: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Import after mocking
const { failJob, succeedJob } = await import("../claim");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("failJob", () => {
  it("schedules a retry with exponential backoff when attempts < maxAttempts", async () => {
    mockFindUnique.mockResolvedValue({
      id: "job-1",
      attempts: 1,
      maxAttempts: 5,
    });
    mockUpdate.mockResolvedValue({});

    await failJob("job-1", "Something broke");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: "RETRY",
          lockedAt: null,
          lastError: "Something broke",
          runAt: expect.any(Date),
        }),
      })
    );

    // Verify backoff: attempt 1 → 30s * 2^0 = 30s
    const retryData = mockUpdate.mock.calls[0][0].data;
    const retryDelay = retryData.runAt.getTime() - Date.now();
    // Should be approximately 30 seconds (±5s for test timing)
    expect(retryDelay).toBeGreaterThan(25_000);
    expect(retryDelay).toBeLessThan(35_000);
  });

  it("applies exponential backoff: attempt 3 → 120s delay", async () => {
    mockFindUnique.mockResolvedValue({
      id: "job-2",
      attempts: 3,
      maxAttempts: 5,
    });
    mockUpdate.mockResolvedValue({});

    await failJob("job-2", "Still broken");

    const retryData = mockUpdate.mock.calls[0][0].data;
    const retryDelay = retryData.runAt.getTime() - Date.now();
    // Attempt 3 → 30s * 2^2 = 120s
    expect(retryDelay).toBeGreaterThan(115_000);
    expect(retryDelay).toBeLessThan(125_000);
  });

  it("marks as FAILED when all attempts exhausted", async () => {
    mockFindUnique.mockResolvedValue({
      id: "job-3",
      attempts: 5,
      maxAttempts: 5,
    });
    mockUpdate.mockResolvedValue({});

    await failJob("job-3", "Permanently broken");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-3" },
        data: expect.objectContaining({
          status: "FAILED",
          lockedAt: null,
          lastError: "Permanently broken",
        }),
      })
    );

    // No runAt = no retry
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.runAt).toBeUndefined();
  });

  it("does nothing if job not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    await failJob("nonexistent", "error");

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("succeedJob", () => {
  it("marks job as SUCCEEDED and clears lock", async () => {
    mockUpdate.mockResolvedValue({});

    await succeedJob("job-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "SUCCEEDED",
        lockedAt: null,
      },
    });
  });
});
