# Skill 15 --- Multi-Agent Git Tree & Workspace Management

The project may be worked on by multiple AI agents and human developers
simultaneously.

Operate safely in a collaborative environment.

------------------------------------------------------------------------

## Workspace Isolation

Each Jira ticket must have its own isolated workspace.

Never work directly on another agent's branch.

Each implementation must have:

-   Dedicated Git branch
-   Dedicated working tree (Git Worktree preferred)
-   Dedicated build artifacts
-   Dedicated temporary files
-   Dedicated logs

Never share temporary files between agents.

------------------------------------------------------------------------

## Git Worktree Strategy

When multiple tickets are being implemented in parallel, create a
separate Git worktree for each ticket.

Example:

``` text
Repository
├── main/
├── worktrees/
│   ├── CRM-101/
│   ├── CRM-102/
│   ├── CRM-103/
│   └── CRM-104/
```

Each worktree contains:

-   Independent Git checkout
-   Independent branch
-   Independent dependencies (if required)
-   Independent build output
-   Independent environment configuration
-   Independent test execution

Never modify another worktree.

------------------------------------------------------------------------

## Branch Ownership

Every Jira ticket owns exactly one development branch.

Examples:

-   CRM-101 → feature/CRM-101-login-api
-   CRM-102 → feature/CRM-102-user-profile
-   CRM-103 → bugfix/CRM-103-payment-timeout
-   CRM-104 → refactor/CRM-104-auth-service

Never reuse branches across unrelated tickets.

------------------------------------------------------------------------

## Agent Ownership

Each agent owns:

-   One Jira ticket (or approved ticket group)
-   One Git branch
-   One Git worktree
-   One Pull Request

Agents must not modify another agent's files unless explicitly assigned.

------------------------------------------------------------------------

## Dependency Awareness

Before starting implementation, check whether another ticket:

-   Modifies the same files
-   Changes the same database tables
-   Updates the same APIs
-   Changes shared components
-   Alters shared services
-   Introduces conflicting migrations

If a dependency exists:

-   Document it
-   Notify the user
-   Wait for coordination before proceeding

Never overwrite another agent's work.

------------------------------------------------------------------------

## File Lock Awareness

Treat modified files as temporarily owned by the active ticket.

If another active branch changes the same file:

-   Detect the overlap
-   Explain the conflict
-   Suggest the merge order
-   Avoid conflicting edits

------------------------------------------------------------------------

## Merge Order

Merge Pull Requests in dependency order:

1.  Shared Infrastructure
2.  Database Migrations
3.  Backend Services
4.  API Layer
5.  Frontend
6.  Documentation

Never merge dependent work before prerequisites.

------------------------------------------------------------------------

## Pull Request Isolation

Each Pull Request must:

-   Reference one Jira ticket (unless explicitly approved otherwise)
-   Contain only related changes
-   Avoid unrelated formatting or refactoring
-   Be independently reviewable

------------------------------------------------------------------------

## Continuous Synchronization

While working:

-   Fetch latest changes regularly
-   Rebase or merge from the target branch
-   Resolve conflicts immediately
-   Keep the branch current

------------------------------------------------------------------------

## Conflict Resolution

If conflicts are detected:

1.  Stop implementation.
2.  Identify conflicting files.
3.  Explain the cause.
4.  Suggest the safest merge strategy.
5.  Resume only after resolution.

Never overwrite code automatically.

------------------------------------------------------------------------

## Multi-Agent Safety Rules

Always:

-   Work only within your assigned ticket.
-   Work only within your assigned branch.
-   Work only within your assigned Git worktree.
-   Keep changes isolated.
-   Avoid cross-ticket modifications.
-   Coordinate shared code changes.
-   Preserve complete traceability.

Workflow:

**Jira Ticket → Assigned Agent → Git Worktree → Git Branch → Commits →
Pull Request → Code Review → Merge → Deployment → Jira Done**

When multiple AI agents are active, always detect conflicts before
making changes and prioritize collaboration over parallel modification
of the same code.
