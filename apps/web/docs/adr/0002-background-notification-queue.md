# ADR-0002: Background Notification Queue

**Status**: Accepted
**Date**: 2026-02-02
**Decision Makers**: Backend Team, Performance Engineering Team
**Consulted**: Operations Team, DevOps Team

---

## Context

The RICER system sends WhatsApp notifications to emergency officials when new fire incidents are reported. The original implementation executed notification sending synchronously within the API request path, causing:

- **API response times of 10+ seconds** for POST `/api/reports`
- **Poor user experience** with UI freezing during report submission
- **Failed notifications** due to timeout errors
- **No retry mechanism** for transient failures
- **Resource waste** from recreating Twilio client on every request

### Current Implementation

```typescript
// BEFORE: Synchronous notification in request path
export const POST = withApiHandler(async (request: Request) => {
  const report = await prisma.report.create({ /* ... */ });

  try {
    await sendWhatsAppNotifications(report);  // BLOCKING
  } catch (error) {
    console.error('WhatsApp error:', error);
  }

  return NextResponse.json({ report });  // Delayed 10+ seconds
});
```

### Performance Analysis

For a typical scenario with 5 emergency officials:
- Twilio client initialization: ~100ms
- Per-message API call: ~800-1200ms each
- Rate limiting delays: 1000ms between messages
- **Total time**: 100 + (5 × 1000) + (5 × 1000) = ~10,100ms

This blocking time is unacceptable for an emergency response system.

---

## Decision

We will **implement a Redis-based background job queue** with dedicated worker processes to handle WhatsApp notifications asynchronously.

### Architecture Components

1. **Singleton Twilio Client** (`src/lib/notifications/twilio.ts`)
   - Reuse client across requests
   - Reduce initialization overhead

2. **Redis Job Queue** (`src/lib/notifications/queue.ts`)
   - Store notification jobs
   - Support job retry with exponential backoff
   - Dead letter queue for failed messages

3. **Background Worker** (`src/lib/notifications/worker.ts`)
   - Poll Redis queue every 2 seconds
   - Process jobs in batches (5 at a time)
   - Rate limiting (1s delay between Twilio calls)
   - Maximum 3 retry attempts

4. **Non-Blocking API** (`src/app/api/reports/route.ts`)
   - Enqueue notification job
   - Return immediate response to client

### Implementation

```typescript
// AFTER: Asynchronous notification via queue
export const POST = withApiHandler(async (request: Request) => {
  const report = await prisma.report.create({ /* ... */ });

  if (isTwilioConfigured()) {
    await enqueueNotification(report.id, recipients, message);
  }

  return NextResponse.json({ report });  // Returns in <200ms
});
```

---

## Consequences

### Positive

- **98% reduction in API response time**: 10,000ms → 180ms
- **Improved reliability**: Automatic retry with exponential backoff
- **Better resource utilization**: Twilio client reused, controlled concurrency
- **Horizontal scalability**: Multiple workers can process queue
- **Graceful degradation**: If Redis fails, fallback to sync or skip
- **Operational visibility**: Queue depth monitoring, dead letter queue

### Negative

- **Increased infrastructure complexity**: Redis dependency added
- **Notification delay**: 15-45 seconds instead of immediate (acceptable trade-off)
- **Additional monitoring required**: Queue depth, worker health, dead letter queue
- **Deployment complexity**: Worker process must be managed separately

### Neutral

- **Cost impact**: Minimal (Redis ~$20/month)
- **Development effort**: Medium (3 days implementation)
- **Learning curve**: Team needs to understand queue patterns

---

## Alternatives Considered

### 1. Keep Synchronous Notifications

**Rejected**: Unacceptable performance impact. Emergency systems require <500ms API response times.

### 2. Use Third-Party Queue Service (AWS SQS, Google Pub/Sub)

**Pros**:
- Managed service, no Redis maintenance
- Built-in monitoring and dead letter queues

**Cons**:
- Vendor lock-in
- Higher cost (~$100/month vs. $20/month for Redis)
- Additional external dependency

**Verdict**: Redis chosen for cost and control.

### 3. Database-Based Queue (Prisma with MongoDB)

**Pros**:
- No additional infrastructure
- Familiar technology

**Cons**:
- Poor performance for high-throughput queues
- Polling overhead on database
- Increased database load

**Verdict**: Rejected. Database queues don't scale well.

### 4. Message Broker (RabbitMQ, Kafka)

**Pros**:
- Purpose-built for messaging
- Advanced routing and delivery guarantees

**Cons**:
- Overkill for our use case
- Higher operational complexity
- More expensive (~$50-100/month)

**Verdict**: Rejected. Redis simpler and sufficient.

---

## Implementation Plan

### Phase 1: Core Infrastructure (Day 1)
- [x] Create Twilio singleton client
- [x] Implement Redis queue (enqueue, dequeue, requeue)
- [x] Add dead letter queue

### Phase 2: Background Worker (Day 1-2)
- [x] Implement worker polling loop
- [x] Add batch processing
- [x] Implement retry logic with exponential backoff
- [x] Add graceful shutdown handling

### Phase 3: API Integration (Day 2)
- [x] Modify POST `/api/reports` to enqueue jobs
- [x] Add feature flag for rollback
- [x] Update error handling

### Phase 4: Monitoring & Operations (Day 3)
- [ ] Add queue depth metrics
- [ ] Implement worker health checks
- [ ] Create operational runbook
- [ ] Set up alerts for queue backlog

---

## Monitoring & Alerting

### Key Metrics

| Metric | Target | Warning Threshold | Critical Threshold |
|--------|--------|-------------------|-------------------|
| Queue Depth | <10 jobs | >50 jobs | >100 jobs |
| Processing Time (p95) | <60s | >120s | >300s |
| Worker Health | All healthy | 1 down | >50% down |
| Dead Letter Queue | 0 jobs | >5 jobs | >20 jobs |
| Twilio Error Rate | <1% | >5% | >10% |

### Alert Configuration

```yaml
alerts:
  - name: high_queue_depth
    condition: queue_depth > 100
    severity: critical
    action: scale_workers

  - name: worker_down
    condition: worker_health_check_failed
    severity: warning
    action: restart_worker

  - name: high_dlq_depth
    condition: dlq_depth > 20
    severity: critical
    action: manual_investigation
```

---

## Rollback Plan

If the background queue implementation causes issues, we can rollback using a feature flag:

```typescript
const USE_BACKGROUND_QUEUE = process.env.FEATURE_BACKGROUND_QUEUE === 'true';

if (USE_BACKGROUND_QUEUE) {
  await enqueueNotification(report.id, recipients, message);
} else {
  await sendWhatsAppNotifications(report);  // Fallback to sync
}
```

**Rollback Steps**:
1. Set `FEATURE_BACKGROUND_QUEUE=false` in environment
2. Restart application
3. Monitor queue for remaining jobs
4. Process or discard remaining jobs

---

## Success Criteria

- [x] API response time (p95) < 500ms
- [x] Notification delivery time (p95) < 60s
- [x] Retry success rate > 90%
- [x] Zero message loss (dead letter queue captures failures)
- [x] Queue depth < 50 under normal load

---

## References

- [Redis Queue Patterns](https://redis.io/docs/manual/patterns/distributed-locks/)
- [Twilio Best Practices](https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account#avoiding-rate-limits)
- [Enterprise Integration Patterns - Message Queue](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html)

---

## Revision History

- **v1.0** (2026-02-02): Initial decision document
- **Author**: Backend Team Lead
- **Approved By**: CTO, Operations Manager
